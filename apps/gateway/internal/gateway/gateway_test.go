package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/hamidrezakks/convey/apps/gateway/internal/customer"
	"go.uber.org/fx"
)

type resolverFunc func(context.Context, customer.Scope, []string) (map[string]customer.Recipients, error)

func (f resolverFunc) Resolve(c context.Context, s customer.Scope, ids []string) (map[string]customer.Recipients, error) {
	return f(c, s, ids)
}
func raw(s string) json.RawMessage { return json.RawMessage(s) }

const sample = `{"userId":"u1","idempotencyKey":"order-1","category":"transactional","country":"US","channels":[{"channel":"email","content":{"subject":"hello"}}],"metadata":{"large":9007199254740993}}`

func fixture(t *testing.T, resolve customer.Resolver, forward http.HandlerFunc) *fiber.App {
	t.Helper()
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/auth/session" {
			if r.Header.Get("Authorization") != "Bearer good" && r.Header.Get("X-API-Key") != "good" {
				w.WriteHeader(401)
				return
			}
			role := "DEVELOPER"
			if r.Header.Get("X-Convey-Environment") == "readonly" {
				role = "AUDITOR"
			}
			fmt.Fprintf(w, `{"tenantId":"t1","team":"orders","role":%q,"isSandbox":false}`, role)
			return
		}
		forward(w, r)
	}))
	t.Cleanup(up.Close)
	client := NewClient()
	t.Cleanup(client.CloseIdleConnections)
	return NewApp(Config{ConveyURL: up.URL, Timeout: time.Second}, client, resolve)
}
func call(t *testing.T, app *fiber.App, method, path, body, key string) (int, []byte, http.Header) {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, b, resp.Header
}
func TestEnrichmentAndTransparentResponse(t *testing.T) {
	calls := 0
	resolve := resolverFunc(func(_ context.Context, s customer.Scope, ids []string) (map[string]customer.Recipients, error) {
		calls++
		if s.Team != "orders" || s.TenantID != "t1" || len(ids) != 1 || ids[0] != "u1" {
			t.Fatalf("wrong scope/IDs: %+v %v", s, ids)
		}
		return map[string]customer.Recipients{"u1": {"email": raw(`"from-directory@example.test"`)}}, nil
	})
	app := fixture(t, resolve, func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		var m object
		_ = json.Unmarshal(b, &m)
		if str(m["team"]) != "orders" || !strings.Contains(string(m["recipients"]), "from-directory") || !strings.Contains(string(m["metadata"]), "9007199254740993") {
			t.Errorf("invalid enriched body %s", b)
		}
		if r.Header.Get("Authorization") != "Bearer good" {
			t.Error("lost credential")
		}
		w.Header().Set("Retry-After", "9")
		w.WriteHeader(429)
		_, _ = w.Write([]byte(`{"error":"throttled"}`))
	})
	code, b, h := call(t, app, "POST", "/v1/messages", sample, "good")
	if code != 429 || string(b) != `{"error":"throttled"}` || h.Get("Retry-After") != "9" || calls != 1 {
		t.Fatalf("%d %s %v calls=%d", code, b, h, calls)
	}
}
func TestRejectedRequestsNeverLookupOrSend(t *testing.T) {
	resolve := resolverFunc(func(context.Context, customer.Scope, []string) (map[string]customer.Recipients, error) {
		t.Error("unexpected lookup")
		return nil, nil
	})
	app := fixture(t, resolve, func(http.ResponseWriter, *http.Request) { t.Error("unexpected send") })
	cases := []struct {
		path, body, key string
		status          int
	}{
		{"/v1/messages", sample, "", 401}, {"/v1/messages", sample, "bad", 401},
		{"/v1/messages", strings.Replace(sample, `"userId":"u1"`, `"team":"other","userId":"u1"`, 1), "good", 403},
		{"/v1/messages", `null`, "good", 400}, {"/v1/messages/bulk", `{"messages":[]}`, "good", 400},
		{"/v1/admin/providers/register", sample, "good", 404}, {"/v1/messages/../admin/providers", sample, "good", 400},
		{"/v1/%61dmin/providers", sample, "good", 400}, {"/v1/messages//bulk", sample, "good", 400},
	}
	for _, tc := range cases {
		t.Run(tc.path+tc.key+tc.body[:min(8, len(tc.body))], func(t *testing.T) {
			code, b, _ := call(t, app, "POST", tc.path, tc.body, tc.key)
			if code != tc.status {
				t.Fatalf("got %d %s want %d", code, b, tc.status)
			}
		})
	}
	req := httptest.NewRequest("POST", "/v1/messages", strings.NewReader(sample))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer good")
	req.Header.Set("X-Convey-Environment", "readonly")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 403 {
		t.Fatal(resp.StatusCode)
	}
}
func TestBulkDeduplicatesAndFailsBeforeSending(t *testing.T) {
	var sends atomic.Int32
	calls := 0
	app := fixture(t, resolverFunc(func(_ context.Context, _ customer.Scope, ids []string) (map[string]customer.Recipients, error) {
		calls++
		if len(ids) != 1 {
			t.Errorf("not deduplicated: %v", ids)
		}
		return map[string]customer.Recipients{"u1": {"email": raw(`"a@example.test"`)}}, nil
	}), func(w http.ResponseWriter, r *http.Request) { sends.Add(1); w.WriteHeader(202) })
	code, b, _ := call(t, app, "POST", "/v1/messages/bulk", `{"messages":[`+sample+`,`+strings.Replace(sample, "order-1", "order-2", 1)+`]}`, "good")
	if code != 202 || sends.Load() != 1 || calls != 1 {
		t.Fatalf("%d %s", code, b)
	}
	app = fixture(t, resolverFunc(func(context.Context, customer.Scope, []string) (map[string]customer.Recipients, error) {
		return nil, customer.ErrNotFound
	}), func(http.ResponseWriter, *http.Request) { t.Error("partial batch sent") })
	code, _, _ = call(t, app, "POST", "/v1/messages/bulk", `[`+sample+`]`, "good")
	if code != 422 {
		t.Fatal(code)
	}
}
func TestAllRecipientKindsAndExplicitOverrides(t *testing.T) {
	scope := customer.Scope{TenantID: "t", Team: "team"}
	calls := 0
	resolver := resolverFunc(func(_ context.Context, _ customer.Scope, ids []string) (map[string]customer.Recipients, error) {
		calls++
		return map[string]customer.Recipients{"u1": {"email": raw(`"directory@example.test"`), "phone": raw(`"+12025550123"`), "whatsapp": raw(`"+12025550123"`), "telegramChatId": raw(`"123"`), "slack": raw(`{"channelId":"C1"}`), "fcmTokens": raw(`["fcm"]`), "apnsTokens": raw(`["apns"]`)}}, nil
	})
	body := `{"userId":"u1","idempotencyKey":"k","recipients":{"email":"override@example.test"},"channels":[{"channel":"email"}],"fallback":{"rules":[{"send":[{"channel":"sms"},{"channel":"whatsapp"}]}]},"cascade":{"steps":[{"channel":"telegram"},{"channel":"slack"},{"channel":"fcm"},{"channel":"apns"}]}}`
	b, err := enrich(context.Background(), resolver, scope, []byte(body), false)
	if err != nil {
		t.Fatal(err)
	}
	var m struct{ Recipients customer.Recipients }
	_ = json.Unmarshal(b, &m)
	if len(m.Recipients) != 7 || str(m.Recipients["email"]) != "override@example.test" || calls != 1 {
		t.Fatalf("%s calls=%d", b, calls)
	}
	calls = 0
	_, err = enrich(context.Background(), resolver, scope, []byte(strings.Replace(sample, `"userId":"u1"`, `"userId":"u1","recipients":{"email":"provided@example.test"}`, 1)), false)
	if err != nil || calls != 0 {
		t.Fatalf("explicit addresses looked up: %v", err)
	}
}
func TestRawCallbacksAndRedirects(t *testing.T) {
	payload := "{ \"event\": 1 }\n"
	app := fixture(t, resolverFunc(func(context.Context, customer.Scope, []string) (map[string]customer.Recipients, error) {
		t.Error("lookup for callback")
		return nil, nil
	}), func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		if string(b) != payload || r.URL.RawQuery != "token=a%2Bb" || r.Header.Get("X-Signature") != "signature" {
			t.Errorf("changed signed request: %s %s", b, r.URL)
		}
		w.Header().Set("Location", "https://example.test/next")
		w.WriteHeader(307)
	})
	req := httptest.NewRequest("POST", "/v1/webhooks/twilio/status?token=a%2Bb", strings.NewReader(payload))
	req.Header.Set("X-Signature", "signature")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 307 || resp.Header.Get("Location") == "" {
		t.Fatal("redirect followed")
	}
}
func TestRouteInventoryParity(t *testing.T) {
	b, err := os.ReadFile("../../../../docs/operations/api-access-matrix.md")
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]bool{}
	for _, line := range strings.Split(string(b), "\n") {
		parts := strings.Split(line, "|")
		if len(parts) < 4 {
			continue
		}
		method, path := strings.TrimSpace(parts[1]), strings.TrimSuffix(strings.TrimSpace(parts[2]), "/")
		if !strings.HasPrefix(path, "/v1/") || strings.HasPrefix(path, "/v1/admin/") {
			continue
		}
		want[method+" "+path] = true
		if !allowed(method, strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(path, ":messageId", "msg_test"), ":batchId", "batch_test"), ":provider", "twilio"), ":slug", "example"), ":token", "token"), ":id", "id")) {
			t.Errorf("missing route %s %s", method, path)
		}
	}
	for method, paths := range routes {
		for _, path := range paths {
			key := method + " " + path
			if !want[key] {
				t.Errorf("unexpected route %s", key)
			}
			delete(want, key)
		}
	}
	if len(want) > 0 {
		t.Fatal(want)
	}
}
func TestLookupDeadlineAndNoSend(t *testing.T) {
	app := fixture(t, resolverFunc(func(ctx context.Context, _ customer.Scope, _ []string) (map[string]customer.Recipients, error) {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(2 * time.Second):
			t.Error("deadline not propagated")
			return nil, nil
		}
	}), func(http.ResponseWriter, *http.Request) { t.Error("sent after timeout") })
	req := httptest.NewRequest("POST", "/v1/messages", strings.NewReader(sample))
	req.Header.Set("Authorization", "Bearer good")
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, fiber.TestConfig{Timeout: 3 * time.Second})
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 502 {
		t.Fatal(resp.StatusCode)
	}
}
func TestFxWiring(t *testing.T) {
	cfg := Config{Listen: "127.0.0.1:0", ConveyURL: "http://localhost:3000", CustomerURL: "http://localhost:4000", CustomerMode: "single", CustomerPath: "/v1/customers/{userId}", Timeout: time.Second}
	app := fx.New(fx.NopLogger, fx.Supply(cfg), fx.Provide(NewClient, NewResolver, NewApp), fx.Invoke(RegisterLifecycle))
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := app.Start(ctx); err != nil {
		t.Fatal(err)
	}
	if err := app.Stop(ctx); err != nil {
		t.Fatal(err)
	}
}

func TestHTTPAdapterEndToEndAndHeaderIsolation(t *testing.T) {
	directory := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer customer-only" || r.Header.Get("X-Convey-Tenant-Id") != "t1" || r.Header.Get("X-Convey-Team") != "orders" || r.Header.Get("Cookie") != "" {
			t.Error("customer credential or scope isolation failed")
		}
		fmt.Fprint(w, `{"tenantId":"t1","team":"orders","userId":"u1","recipients":{"email":"resolved@example.test","phone":"+12025550123"}}`)
	}))
	defer directory.Close()
	client := NewClient()
	defer client.CloseIdleConnections()
	resolve := &customer.HTTP{Client: client, BaseURL: directory.URL, Token: "customer-only", Mode: "single", Path: "/v1/customers/{userId}"}
	app := fixture(t, resolve, func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer good" || r.Header.Get("X-Convey-Tenant-Id") != "" || r.Header.Get("X-Convey-Team") != "" || r.Header.Get("X-Forwarded-Host") != "" {
			t.Error("spoofed scope forwarded")
		}
		b, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(b), "resolved@example.test") {
			t.Error("HTTP recipient not forwarded")
		}
		w.WriteHeader(202)
	})
	req := httptest.NewRequest("POST", "/v1/messages", strings.NewReader(sample))
	for k, v := range map[string]string{"Content-Type": "application/json", "Authorization": "Bearer good", "X-Convey-Tenant-Id": "evil", "X-Convey-Team": "other", "X-Forwarded-Host": "evil.test", "Cookie": "caller-secret"} {
		req.Header.Set(k, v)
	}
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 202 {
		t.Fatal(resp.StatusCode)
	}
}
func TestMissingFallbackContactRejectsWholeSubmission(t *testing.T) {
	app := fixture(t, resolverFunc(func(context.Context, customer.Scope, []string) (map[string]customer.Recipients, error) {
		return map[string]customer.Recipients{"u1": {"email": raw(`"a@example.test"`)}}, nil
	}), func(http.ResponseWriter, *http.Request) { t.Error("sent with missing fallback address") })
	body := strings.TrimSuffix(sample, "}") + `,"fallback":{"rules":[{"when":{"channel":"email","event":"failed"},"send":[{"channel":"sms","content":{"text":"fallback"}}]}]}}`
	code, b, _ := call(t, app, "POST", "/v1/messages", body, "good")
	if code != 422 || !strings.Contains(string(b), "RECIPIENT_MISSING") {
		t.Fatalf("%d %s", code, b)
	}
}
func TestConfigValidation(t *testing.T) {
	t.Setenv("CONVEY_URL", "http://localhost:3000")
	t.Setenv("CUSTOMER_URL", "http://localhost:4000")
	t.Setenv("CUSTOMER_LOOKUP_MODE", "bulk")
	t.Setenv("CUSTOMER_LOOKUP_PATH", "")
	c, err := LoadConfig()
	if err != nil || c.CustomerPath != "/v1/customers/resolve" {
		t.Fatalf("%+v %v", c, err)
	}
	for _, bad := range []string{"", "file:///tmp/service", "https://secret@example.test", "https://example.test/path", "https://example.test?q=1"} {
		t.Setenv("CONVEY_URL", bad)
		if _, err := LoadConfig(); err == nil {
			t.Errorf("accepted invalid origin %q", bad)
		}
	}
}
