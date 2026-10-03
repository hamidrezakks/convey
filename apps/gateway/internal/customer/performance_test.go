package customer

import (
	"context"
	"encoding/json"
	"github.com/hamidrezakks/convey/apps/gateway/internal/outbound"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func BenchmarkHTTPBatching(b *testing.B) {
	var calls atomic.Int64
	scope := Scope{TenantID: "tenant", Team: "orders"}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		var input struct {
			UserIDs []string `json:"userIds"`
		}
		json.NewDecoder(r.Body).Decode(&input)
		records := make([]record, 0, len(input.UserIDs))
		for id, recipient := range contacts(input.UserIDs) {
			records = append(records, record{Scope: scope, UserID: id, Recipients: recipient})
		}
		json.NewEncoder(w).Encode(map[string]any{"customers": records})
	}))
	defer server.Close()
	for _, name := range []string{"unbatched", "batched"} {
		b.Run(name, func(b *testing.B) {
			c := outbound.New()
			defer c.CloseIdleConnections()
			var resolver Resolver = &HTTP{Client: c, BaseURL: server.URL, Mode: "bulk", Path: "/resolve"}
			if name == "batched" {
				batch := NewBatcher(resolver, BatchWait)
				defer closeBatch(b, batch)
				resolver = batch
			}
			calls.Store(0)
			b.ReportAllocs()
			b.ResetTimer()
			for range b.N {
				runBurst(b, resolver, 100, scope)
			}
			b.StopTimer()
			b.ReportMetric(float64(calls.Load())/float64(b.N), "HTTPcalls/100requests")
		})
	}
}

func TestBulkHTTPBatchPreservesValidNeighbour(t *testing.T) {
	scope := Scope{TenantID: "t", Team: "orders"}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"customers": []record{{Scope: scope, UserID: "good", Recipients: contacts([]string{"good"})["good"]}}})
	}))
	defer server.Close()
	c := outbound.New()
	defer c.CloseIdleConnections()
	h := &HTTP{Client: c, BaseURL: server.URL, Mode: "bulk", Path: "/resolve"}
	out, err := h.Resolve(context.Background(), scope, []string{"good", "missing"})
	if err != ErrNotFound || out["good"] == nil {
		t.Fatalf("partial records lost %v %v", out, err)
	}
}
