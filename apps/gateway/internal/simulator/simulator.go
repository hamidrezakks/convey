// Package simulator runs the real gateway against loopback-only mock services.
// It simulates acceptance and idempotency, not Convey workers or vendor delivery.
package simulator

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/hamidrezakks/convey/apps/gateway/internal/customer"
	"github.com/hamidrezakks/convey/apps/gateway/internal/gateway"
)

//go:embed customers.json
var fixture []byte

type stored struct {
	Body json.RawMessage
	Hash [32]byte
	ID   string
}
type Harness struct {
	conveyRequests    atomic.Int64
	URL               string
	Mode              string
	directory, convey *httptest.Server
	app               *fiber.App
	listener          net.Listener
	client            *http.Client
	outboundClose     func()
	serveDone         chan error
	mu                sync.Mutex
	customers         map[string]customer.Recipients
	messages          map[string]stored
	keys              map[string]string
	lookupRequests    atomic.Int64
	lookupUsers       atomic.Int64
	submissions       atomic.Int64
	faults            atomic.Int64
	closed            sync.Once
}
type response struct {
	Status int
	Body   []byte
	Header http.Header
}

func Start(mode string) (*Harness, error) {
	if mode != "single" && mode != "bulk" {
		return nil, fmt.Errorf("unknown lookup mode %q", mode)
	}
	h := &Harness{Mode: mode, client: &http.Client{Timeout: 3 * time.Second}, messages: map[string]stored{}, keys: map[string]string{}, serveDone: make(chan error, 1)}
	if err := json.Unmarshal(fixture, &h.customers); err != nil {
		return nil, err
	}
	h.directory = httptest.NewServer(http.HandlerFunc(h.customerHandler))
	h.convey = httptest.NewServer(http.HandlerFunc(h.conveyHandler))
	path := "/v1/customers/{userId}"
	if mode == "bulk" {
		path = "/v1/customers/resolve"
	}
	cfg := gateway.Config{ConveyURL: h.convey.URL, CustomerURL: h.directory.URL, CustomerToken: "mock-directory-secret", CustomerMode: mode, CustomerPath: path, Timeout: time.Second, BatchWait: customer.BatchWait}
	out := gateway.NewClient()
	h.outboundClose = out.CloseIdleConnections
	resolver, err := gateway.NewResolver(cfg, out)
	if err != nil {
		h.Close()
		return nil, err
	}
	previousClose := h.outboundClose
	h.outboundClose = func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if closer, ok := resolver.(interface{ Close(context.Context) error }); ok {
			_ = closer.Close(ctx)
		}
		previousClose()
	}
	h.app = gateway.NewApp(cfg, out, resolver)
	h.listener, err = net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		h.Close()
		return nil, err
	}
	h.URL = "http://" + h.listener.Addr().String()
	go func() { h.serveDone <- h.app.Listener(h.listener, fiber.ListenConfig{DisableStartupMessage: true}) }()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		r, e := h.do("GET", "/healthz", nil, "")
		if e == nil && r.Status == 200 {
			return h, nil
		}
		time.Sleep(10 * time.Millisecond)
	}
	h.Close()
	return nil, fmt.Errorf("gateway did not become ready")
}
func (h *Harness) Close() {
	h.closed.Do(func() {
		if h.app != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			_ = h.app.ShutdownWithContext(ctx)
			cancel()
		}
		if h.listener != nil {
			_ = h.listener.Close()
			select {
			case <-h.serveDone:
			case <-time.After(2 * time.Second):
			}
		}
		if h.directory != nil {
			h.directory.Close()
		}
		if h.convey != nil {
			h.convey.Close()
		}
		h.client.CloseIdleConnections()
		if h.outboundClose != nil {
			h.outboundClose()
		}
	})
}
func send(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func (h *Harness) customerHandler(w http.ResponseWriter, r *http.Request) {
	h.lookupRequests.Add(1)
	if r.Header.Get("Authorization") != "Bearer mock-directory-secret" || r.Header.Get("X-Convey-Tenant-Id") != "demo-tenant" || r.Header.Get("X-Convey-Team") != "orders" {
		h.faults.Add(1)
		send(w, 403, map[string]string{"error": "scope violation"})
		return
	}
	scope := customer.Scope{TenantID: "demo-tenant", Team: "orders", Sandbox: r.Header.Get("X-Convey-Sandbox") == "true"}
	var ids []string
	if r.Method == "POST" {
		var b struct {
			customer.Scope
			UserIDs []string `json:"userIds"`
		}
		if json.NewDecoder(r.Body).Decode(&b) != nil || b.Scope != scope {
			h.faults.Add(1)
			w.WriteHeader(400)
			return
		}
		ids = b.UserIDs
	} else {
		ids = []string{strings.TrimPrefix(r.URL.Path, "/v1/customers/")}
	}
	records := []map[string]any{}
	for _, id := range ids {
		h.lookupUsers.Add(1)
		switch id {
		case "unavailable":
			w.WriteHeader(503)
			return
		case "malformed":
			_, _ = w.Write([]byte(`{"broken":`))
			return
		case "slow":
			select {
			case <-r.Context().Done():
				return
			case <-time.After(2 * time.Second):
			}
			w.WriteHeader(504)
			return
		}
		h.mu.Lock()
		recipient, ok := h.customers[id]
		h.mu.Unlock()
		if id == "wrong-scope" {
			ok = true
			recipient = customer.Recipients{"email": json.RawMessage(`"wrong@example.test"`)}
		}
		if !ok {
			w.WriteHeader(404)
			return
		}
		tenant := scope.TenantID
		if id == "wrong-scope" {
			tenant = "other-tenant"
		}
		records = append(records, map[string]any{"tenantId": tenant, "team": scope.Team, "isSandbox": scope.Sandbox, "userId": id, "recipients": recipient})
	}
	if r.Method == "POST" {
		send(w, 200, map[string]any{"customers": records})
	} else {
		send(w, 200, records[0])
	}
}
func (h *Harness) conveyHandler(w http.ResponseWriter, r *http.Request) {
	h.conveyRequests.Add(1)
	key := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if key == "" {
		key = r.Header.Get("X-API-Key")
	}
	if key != "demo-key" && key != "sandbox-key" && key != "readonly-key" {
		w.WriteHeader(401)
		return
	}
	sandbox := key == "sandbox-key" || r.Header.Get("X-Convey-Sandbox") == "true"
	role := "DEVELOPER"
	if key == "readonly-key" {
		role = "AUDITOR"
	}
	if r.URL.Path == "/v1/auth/session" {
		send(w, 200, map[string]any{"tenantId": "demo-tenant", "team": "orders", "role": role, "isSandbox": sandbox})
		return
	}
	path := strings.TrimSuffix(r.URL.Path, "/")
	if path == "/v1/messages" || path == "/v1/messages/bulk" {
		if r.Method != "POST" {
			w.WriteHeader(405)
			return
		}
		h.submissions.Add(1)
		b, err := io.ReadAll(io.LimitReader(r.Body, 4<<20))
		if err != nil {
			w.WriteHeader(400)
			return
		}
		var items []json.RawMessage
		if path == "/v1/messages" {
			items = []json.RawMessage{b}
		} else if len(b) > 0 && b[0] == '[' {
			_ = json.Unmarshal(b, &items)
		} else {
			var envelope struct {
				Messages []json.RawMessage `json:"messages"`
			}
			_ = json.Unmarshal(b, &envelope)
			items = envelope.Messages
		}
		responses := []map[string]string{}
		h.mu.Lock()
		defer h.mu.Unlock()
		for _, body := range items {
			var m map[string]json.RawMessage
			if json.Unmarshal(body, &m) != nil {
				w.WriteHeader(400)
				return
			}
			var idempotency string
			_ = json.Unmarshal(m["idempotencyKey"], &idempotency)
			encoded, _ := json.Marshal(m)
			hash := sha256.Sum256(encoded)
			scopeKey := fmt.Sprintf("%t:%s", sandbox, idempotency)
			id, exists := h.keys[scopeKey]
			if exists && h.messages[id].Hash != hash {
				send(w, 409, map[string]string{"error": "idempotency conflict"})
				return
			}
			if !exists {
				id = fmt.Sprintf("msg_%026d", len(h.messages)+1)
				h.keys[scopeKey] = id
				h.messages[id] = stored{Body: encoded, Hash: hash, ID: id}
			}
			responses = append(responses, map[string]string{"messageId": id, "state": "accepted"})
		}
		if path == "/v1/messages" {
			send(w, 202, responses[0])
		} else {
			send(w, 202, map[string]any{"total": len(responses), "items": responses})
		}
		return
	}
	if path == "/v1/messages/mock-rate-limit" {
		w.Header().Set("Retry-After", "2")
		send(w, 429, map[string]string{"error": "mock throttling"})
		return
	}
	if r.Method == "GET" && strings.HasPrefix(path, "/v1/messages/") {
		h.mu.Lock()
		m, ok := h.messages[strings.TrimPrefix(path, "/v1/messages/")]
		h.mu.Unlock()
		if !ok {
			w.WriteHeader(404)
			return
		}
		send(w, 200, map[string]string{"messageId": m.ID, "state": "accepted"})
		return
	}
	send(w, 200, map[string]string{"mock": "passthrough", "method": r.Method, "path": r.URL.Path})
}
func (h *Harness) do(method, path string, payload any, key string) (response, error) {
	var b []byte
	if payload != nil {
		var err error
		b, err = json.Marshal(payload)
		if err != nil {
			return response{}, err
		}
	}
	req, err := http.NewRequest(method, h.URL+path, bytes.NewReader(b))
	if err != nil {
		return response{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
	r, err := h.client.Do(req)
	if err != nil {
		return response{}, err
	}
	defer r.Body.Close()
	body, err := io.ReadAll(r.Body)
	return response{r.StatusCode, body, r.Header}, err
}
func message(id, key string) map[string]any {
	return map[string]any{"userId": id, "idempotencyKey": key, "category": "transactional", "country": "US", "channels": []any{map[string]any{"channel": "email", "content": map[string]string{"subject": "Mock notification", "text": "This is simulated."}}}}
}
func (h *Harness) count() int { h.mu.Lock(); defer h.mu.Unlock(); return len(h.messages) }
func (h *Harness) body(id string) map[string]any {
	h.mu.Lock()
	defer h.mu.Unlock()
	var m map[string]any
	_ = json.Unmarshal(h.messages[id].Body, &m)
	return m
}
func responseID(r response) string {
	var b struct {
		MessageID string `json:"messageId"`
	}
	_ = json.Unmarshal(r.Body, &b)
	return b.MessageID
}

// Run checks real HTTP round trips through the actual Fiber gateway in both modes.
func Run(ctx context.Context, out io.Writer) error {
	for _, mode := range []string{"single", "bulk"} {
		h, err := Start(mode)
		if err != nil {
			return err
		}
		err = h.scenarios(ctx, out)
		h.Close()
		if err != nil {
			return fmt.Errorf("%s: %w", mode, err)
		}
	}
	return nil
}
func (h *Harness) scenarios(ctx context.Context, out io.Writer) error {
	checks := 0
	check := func(name string, condition bool) error {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if !condition {
			return fmt.Errorf("scenario failed: %s", name)
		}
		checks++
		fmt.Fprintf(out, "PASS [%s] %s\n", h.Mode, name)
		return nil
	}
	submit := func(m map[string]any) (response, error) { return h.do("POST", "/v1/messages", m, "demo-key") }
	r, err := submit(message("alice", "single"))
	if err != nil {
		return err
	}
	if err = check("single lookup and acceptance", r.Status == 202); err != nil {
		return err
	}
	id := responseID(r)
	recipients := h.body(id)["recipients"].(map[string]any)
	if err = check("resolved address forwarded", recipients["email"] == "alice@example.test"); err != nil {
		return err
	}
	again, err := submit(message("alice", "single"))
	if err != nil {
		return err
	}
	if err = check("identical retry reuses acceptance", again.Status == 202 && responseID(again) == id && h.count() == 1); err != nil {
		return err
	}
	status, err := h.do("GET", "/v1/messages/"+id, nil, "demo-key")
	if err != nil {
		return err
	}
	if err = check("status API passthrough", status.Status == 200 && responseID(status) == id); err != nil {
		return err
	}
	h.mu.Lock()
	h.customers["alice"]["email"] = json.RawMessage(`"changed@example.test"`)
	h.mu.Unlock()
	changed, err := submit(message("alice", "single"))
	if err != nil {
		return err
	}
	if err = check("changed profile conflicts without duplicate", changed.Status == 409 && h.count() == 1); err != nil {
		return err
	}
	m := message("missing", "explicit")
	m["recipients"] = map[string]string{"email": "override@example.test"}
	lookups := h.lookupRequests.Load()
	r, err = submit(m)
	if err != nil {
		return err
	}
	if err = check("explicit address skips customer lookup", r.Status == 202 && h.lookupRequests.Load() == lookups); err != nil {
		return err
	}
	m = message("alice", "all-channels")
	channels := []any{}
	for _, channel := range []string{"email", "sms", "whatsapp", "telegram", "slack", "fcm", "apns"} {
		content := map[string]string{"text": "mock"}
		if channel == "email" {
			content["subject"] = "Mock email"
		}
		if channel == "fcm" || channel == "apns" {
			content = map[string]string{"title": "Mock push", "body": "Simulated notification"}
		}
		channels = append(channels, map[string]any{"channel": channel, "content": content})
	}
	m["channels"] = channels
	r, err = submit(m)
	if err != nil {
		return err
	}
	if err = check("all seven recipient fields", r.Status == 202 && len(h.body(responseID(r))["recipients"].(map[string]any)) == 7); err != nil {
		return err
	}
	m = message("bob", "fallback")
	m["fallback"] = map[string]any{"rules": []any{map[string]any{"when": map[string]string{"channel": "email", "event": "failed"}, "send": []any{map[string]any{"channel": "sms", "content": map[string]string{"text": "mock fallback"}}}}}}
	r, err = submit(m)
	if err != nil {
		return err
	}
	if err = check("fallback phone enrichment", r.Status == 202 && h.body(responseID(r))["recipients"].(map[string]any)["phone"] == "+12025550102"); err != nil {
		return err
	}
	m = message("bob", "cascade")
	m["cascade"] = map[string]any{"enabled": true, "steps": []any{map[string]any{"channel": "email"}, map[string]any{"channel": "sms", "condition": "if_undelivered"}}}
	r, err = submit(m)
	if err != nil {
		return err
	}
	if err = check("cascade phone enrichment", r.Status == 202 && h.body(responseID(r))["recipients"].(map[string]any)["phone"] == "+12025550102"); err != nil {
		return err
	}
	before := h.lookupUsers.Load()
	batch := []any{message("bob", "bulk-1"), message("bob", "bulk-2"), message("alice", "bulk-3")}
	r, err = h.do("POST", "/v1/messages/bulk", map[string]any{"messages": batch}, "demo-key")
	if err != nil {
		return err
	}
	if err = check("bulk deduplicates customer IDs", r.Status == 202 && h.lookupUsers.Load()-before == 2); err != nil {
		return err
	}
	r, err = h.do("POST", "/v1/messages/bulk", []any{message("bob", "bare-bulk")}, "demo-key")
	if err != nil {
		return err
	}
	if err = check("bare-array bulk request", r.Status == 202); err != nil {
		return err
	}
	before = h.submissions.Load()
	r, err = h.do("POST", "/v1/messages/bulk", map[string]any{"messages": []any{message("alice", "must-not-send"), message("missing", "missing")}}, "demo-key")
	if err != nil {
		return err
	}
	if err = check("failed bulk lookup forwards nothing", r.Status == 422 && h.submissions.Load() == before); err != nil {
		return err
	}
	for _, test := range []struct {
		id     string
		status int
	}{{"missing", 422}, {"unavailable", 502}, {"malformed", 502}, {"wrong-scope", 502}, {"slow", 502}} {
		before = h.submissions.Load()
		r, err = submit(message(test.id, "fault-"+test.id))
		if err != nil {
			return err
		}
		if err = check("customer fault: "+test.id, r.Status == test.status && h.submissions.Load() == before); err != nil {
			return err
		}
	}
	for _, key := range []string{"", "invalid-key", "readonly-key"} {
		before = h.lookupRequests.Load()
		r, err = h.do("POST", "/v1/messages", message("alice", "unauthorized"), key)
		if err != nil {
			return err
		}
		want := 401
		if key == "readonly-key" {
			want = 403
		}
		if err = check("rejected credential: "+key, r.Status == want && h.lookupRequests.Load() == before); err != nil {
			return err
		}
	}
	m = message("alice", "other-team")
	m["team"] = "other"
	before = h.lookupRequests.Load()
	r, err = submit(m)
	if err != nil {
		return err
	}
	if err = check("cross-team rejected before lookup", r.Status == 403 && h.lookupRequests.Load() == before); err != nil {
		return err
	}
	r, err = h.do("POST", "/v1/messages", message("alice", "single"), "sandbox-key")
	if err != nil {
		return err
	}
	if err = check("sandbox scope has separate acceptance", r.Status == 202 && responseID(r) != id); err != nil {
		return err
	}
	r, err = h.do("GET", "/v1/admin/providers", nil, "demo-key")
	if err != nil {
		return err
	}
	if err = check("admin APIs blocked", r.Status == 404); err != nil {
		return err
	}
	r, err = h.do("GET", "/v1/messages/mock-rate-limit", nil, "demo-key")
	if err != nil {
		return err
	}
	if err = check("upstream throttling preserved", r.Status == 429 && r.Header.Get("Retry-After") == "2"); err != nil {
		return err
	}
	// Exercise concurrent network submissions against one shared gateway and pool.
	beforeOversized := h.conveyRequests.Load()
	oversizedStatus, oversizeErr := h.oversizedRequest()
	if oversizeErr != nil {
		return oversizeErr
	}
	if err = check("real HTTP oversized body returns 413", oversizedStatus == 413 && h.conveyRequests.Load() == beforeOversized); err != nil {
		return err
	}
	beforeCount := h.count()
	beforeLookups := h.lookupRequests.Load()
	var concurrent sync.WaitGroup
	failures := make(chan error, 40)
	for i := range 40 {
		concurrent.Go(func() {
			reply, err := submit(message("bob", fmt.Sprintf("concurrent-%d", i)))
			if err != nil {
				failures <- err
			} else if reply.Status != 202 {
				failures <- fmt.Errorf("concurrent status %d", reply.Status)
			}
		})
	}
	concurrent.Wait()
	close(failures)
	for err := range failures {
		return err
	}
	if err = check("40 concurrent HTTP submissions", h.count() == beforeCount+40); err != nil {
		return err
	}
	if err = check("concurrent lookups coalesced", h.lookupRequests.Load()-beforeLookups < 40); err != nil {
		return err
	}
	fmt.Fprintf(out, "%s: 40 concurrent requests used %d customer HTTP calls\n", h.Mode, h.lookupRequests.Load()-beforeLookups)
	if err = check("no customer scope/credential violations", h.faults.Load() == 0); err != nil {
		return err
	}
	fmt.Fprintf(out, "%s: %d scenarios passed; %d simulated acceptances, zero vendor sends\n", h.Mode, checks, h.count())
	return nil
}

// Send only headers for a body whose announced size exceeds the gateway limit.
// This verifies early rejection without racing a body writer against server close.
func (h *Harness) oversizedRequest() (int, error) {
	conn, err := net.DialTimeout("tcp", strings.TrimPrefix(h.URL, "http://"), time.Second)
	if err != nil {
		return 0, err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(3 * time.Second))
	_, err = fmt.Fprintf(conn, "POST /v1/messages HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nAuthorization: Bearer demo-key\r\nContent-Length: %d\r\nConnection: close\r\n\r\n", (4<<20)+1)
	if err != nil {
		return 0, err
	}
	resp, err := http.ReadResponse(bufio.NewReader(conn), nil)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	_, err = io.Copy(io.Discard, resp.Body)
	return resp.StatusCode, err
}
