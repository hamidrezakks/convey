package customer

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/hamidrezakks/convey/apps/gateway/internal/outbound"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestHTTPModesAndScopeValidation(t *testing.T) {
	for _, mode := range []string{"single", "bulk"} {
		t.Run(mode, func(t *testing.T) {
			var calls atomic.Int32
			scope := Scope{TenantID: "tenant", Team: "orders", Sandbox: true}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				if r.Header.Get("Authorization") != "Bearer directory-token" || r.Header.Get("X-Convey-Tenant-Id") != "tenant" || r.Header.Get("X-Convey-Team") != "orders" || r.Header.Get("X-Convey-Sandbox") != "true" {
					t.Error("incorrect trusted headers")
				}
				if mode == "single" {
					if r.URL.Query().Get("team") != "orders" {
						t.Error("missing team")
					}
					id := strings.TrimPrefix(r.URL.Path, "/customers/")
					fmt.Fprintf(w, `{"tenantId":"tenant","team":"orders","isSandbox":true,"userId":%q,"recipients":{"email":"demo@example.test"}}`, id)
				} else {
					var body struct {
						Scope
						UserIDs []string `json:"userIds"`
					}
					if json.NewDecoder(r.Body).Decode(&body) != nil || body.Scope != scope || len(body.UserIDs) != 2 {
						t.Error("bad bulk body")
					}
					fmt.Fprint(w, `{"customers":[{"tenantId":"tenant","team":"orders","isSandbox":true,"userId":"a","recipients":{"phone":"+12025550123"}},{"tenantId":"tenant","team":"orders","isSandbox":true,"userId":"b","recipients":{"phone":"+12025550124"}}]}`)
				}
			}))
			defer server.Close()
			path := "/customers/{userId}"
			if mode == "bulk" {
				path = "/resolve"
			}
			adapter := HTTP{Client: outbound.New(), BaseURL: server.URL, Token: "directory-token", Mode: mode, Path: path}
			out, err := adapter.Resolve(context.Background(), scope, []string{"a", "b"})
			if err != nil || len(out) != 2 {
				t.Fatalf("%v %v", out, err)
			}
			want := int32(2)
			if mode == "bulk" {
				want = 1
			}
			if calls.Load() != want {
				t.Fatal(calls.Load())
			}
		})
	}
}
func TestCustomerFailures(t *testing.T) {
	for _, body := range []string{`{}`, `{"tenantId":"other","team":"orders","userId":"a","recipients":{"email":"leak"}}`, `{"tenantId":"tenant","team":"orders","userId":"wrong","recipients":{"email":"leak"}}`} {
		s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, body) }))
		h := HTTP{Client: outbound.New(), BaseURL: s.URL, Mode: "single", Path: "/customers/{userId}"}
		_, err := h.Resolve(context.Background(), Scope{TenantID: "tenant", Team: "orders"}, []string{"a"})
		s.Close()
		if err == nil {
			t.Fatal("untrusted response accepted")
		}
	}
}
func TestBulkRejectsDuplicateMissingAndForeignUsers(t *testing.T) {
	for _, ids := range [][]string{{"a", "a"}, {"a"}, {"a", "foreign"}} {
		records := []record{}
		for _, id := range ids {
			records = append(records, record{Scope: Scope{TenantID: "t", Team: "x"}, UserID: id, Recipients: Recipients{"email": json.RawMessage(`"test@example.test"`)}})
		}
		b, _ := json.Marshal(map[string]any{"customers": records})
		s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write(b) }))
		h := HTTP{Client: outbound.New(), BaseURL: s.URL, Mode: "bulk", Path: "/resolve"}
		_, err := h.Resolve(context.Background(), Scope{TenantID: "t", Team: "x"}, []string{"a", "b"})
		s.Close()
		if err == nil {
			t.Fatal("bad bulk response accepted")
		}
	}
}
func TestSingleLookupConcurrencyIsBounded(t *testing.T) {
	var active, peak atomic.Int32
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := active.Add(1)
		defer active.Add(-1)
		for {
			old := peak.Load()
			if n <= old || peak.CompareAndSwap(old, n) {
				break
			}
		}
		time.Sleep(time.Millisecond * 5)
		id := strings.TrimPrefix(r.URL.Path, "/customers/")
		fmt.Fprintf(w, `{"tenantId":"t","team":"x","userId":%q,"recipients":{"email":"a@example.test"}}`, id)
	}))
	defer s.Close()
	ids := make([]string, 30)
	for i := range ids {
		ids[i] = fmt.Sprint(i)
	}
	h := HTTP{Client: outbound.New(), BaseURL: s.URL, Mode: "single", Path: "/customers/{userId}"}
	_, err := h.Resolve(context.Background(), Scope{TenantID: "t", Team: "x"}, ids)
	if err != nil || peak.Load() > 8 {
		t.Fatalf("peak=%d err=%v", peak.Load(), err)
	}
}
