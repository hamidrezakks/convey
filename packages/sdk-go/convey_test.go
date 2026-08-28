package convey

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func createMockServer(t *testing.T) (*httptest.Server, *Client) {
	mux := http.NewServeMux()

	// Messages
	mux.HandleFunc("/v1/messages", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			var body map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&body)

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"messageId": "msg_01J8K9P2X",
				"publicId":  "msg_01J8K9P2X",
				"state":     "accepted",
				"status":    "ACCEPTED",
				"createdAt": time.Now().UTC().Format(time.RFC3339),
			})
			return
		}
		http.NotFound(w, r)
	})

	mux.HandleFunc("/v1/messages/bulk", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"total": 2,
				"items": []map[string]interface{}{
					{"publicId": "msg_01", "state": "accepted"},
					{"publicId": "msg_02", "state": "accepted"},
				},
			})
			return
		}
		http.NotFound(w, r)
	})

	mux.HandleFunc("/v1/messages/msg_01J8K9P2X", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(MessageDetailDto{
				PublicID:  "msg_01J8K9P2X",
				Channel:   "EMAIL",
				Recipient: "alex@example.com",
				Status:    StatusDelivered,
				CostUSD:   0.001,
			})
			return
		}
		http.NotFound(w, r)
	})

	mux.HandleFunc("/v1/messages/msg_01J8K9P2X/timeline", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(MessageTimelineResponse{
			MessageID: "msg_01J8K9P2X",
			Timeline: []map[string]interface{}{
				{"status": "ACCEPTED", "timestamp": "2026-08-28T10:00:00Z"},
			},
		})
	})

	mux.HandleFunc("/v1/messages/msg_01J8K9P2X/trace", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(MessageTraceResponse{
			MessageID:       "msg_01J8K9P2X",
			Traceparent:     "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
			TotalDurationMs: 42.5,
			Spans: []TraceSpan{
				{Name: "outbox.relay", DurationMs: 12.0, Timestamp: "2026-08-28T10:00:00Z"},
			},
		})
	})

	// Batches
	mux.HandleFunc("/v1/batches", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost {
			_ = json.NewEncoder(w).Encode(CreateBatchResponse{
				Success: true,
				Batch:   BatchDto{ID: "batch_123", State: BatchStateInitializing, TotalCount: 10},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(ListBatchesResponse{
			Success: true,
			Batches: []BatchDto{{ID: "batch_123", State: BatchStateProcessing}},
		})
	})

	// Suppressions
	mux.HandleFunc("/v1/suppressions", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"suppression": SuppressionDto{
					ID:        "sup_1",
					Recipient: "blocked@example.com",
					Reason:    SuppressionHardBounce,
				},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"items": []SuppressionDto{
				{ID: "sup_1", Recipient: "blocked@example.com", Reason: SuppressionHardBounce},
			},
			"total": 1,
		})
	})

	// DLQ
	mux.HandleFunc("/v1/dlq", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"items": []MessageDetailDto{
				{PublicID: "msg_failed_1", Status: StatusFailed},
			},
			"total": 1,
		})
	})

	// Sandbox
	mux.HandleFunc("/v1/sandbox/messages", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodDelete {
			_ = json.NewEncoder(w).Encode(ClearSandboxMessagesResponse{
				Success: true,
				Cleared: 5,
			})
			return
		}
		_ = json.NewEncoder(w).Encode(ListSandboxMessagesResponse{
			Success:  true,
			Messages: []map[string]interface{}{{"publicId": "sandbox_msg_1"}},
		})
	})

	// Admin Telemetry
	mux.HandleFunc("/v1/admin/telemetry/live", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(LiveTelemetrySnapshot{
			HeapSaturation:  0.42,
			ActiveWorkers:   16,
			P95LatencyMs:    12.4,
			SystemHealth:    "HEALTHY",
			CircuitBreakers: map[string]string{"resend": "CLOSED"},
		})
	})

	server := httptest.NewServer(mux)
	client := NewClient("sk_test_mock_key",
		WithBaseURL(server.URL),
		WithTimeout(2*time.Second),
	)

	return server, client
}

func TestMessagesResource(t *testing.T) {
	server, client := createMockServer(t)
	defer server.Close()

	ctx := context.Background()

	// 1. Send Single
	res, err := client.Messages.Send(ctx, SendMessageRequest{
		Channel:   ChannelEmail,
		Recipient: "alex@example.com",
		Content: &MessageContent{
			Subject: "Test",
			Body:    "Hello World",
		},
		Priority: PriorityHigh,
	})
	if err != nil {
		t.Fatalf("Messages.Send failed: %v", err)
	}
	if res.PublicID != "msg_01J8K9P2X" {
		t.Errorf("expected publicId 'msg_01J8K9P2X', got %s", res.PublicID)
	}
	if res.Status != StatusAccepted {
		t.Errorf("expected status ACCEPTED, got %s", res.Status)
	}

	// 2. Send Bulk
	bulk, err := client.Messages.SendBulk(ctx, []SendMessageRequest{
		{Channel: ChannelEmail, Recipient: "u1@example.com"},
		{Channel: ChannelEmail, Recipient: "u2@example.com"},
	})
	if err != nil {
		t.Fatalf("Messages.SendBulk failed: %v", err)
	}
	if bulk.Total != 2 || len(bulk.Items) != 2 {
		t.Errorf("expected 2 items, got total=%d items=%d", bulk.Total, len(bulk.Items))
	}

	// 3. Get Details
	detail, err := client.Messages.Get(ctx, "msg_01J8K9P2X")
	if err != nil {
		t.Fatalf("Messages.Get failed: %v", err)
	}
	if detail.Status != StatusDelivered {
		t.Errorf("expected status DELIVERED, got %s", detail.Status)
	}

	// 4. Timeline
	timeline, err := client.Messages.GetTimeline(ctx, "msg_01J8K9P2X")
	if err != nil {
		t.Fatalf("Messages.GetTimeline failed: %v", err)
	}
	if len(timeline.Timeline) == 0 {
		t.Errorf("expected non-empty timeline")
	}

	// 5. Trace
	trace, err := client.Messages.GetTrace(ctx, "msg_01J8K9P2X")
	if err != nil {
		t.Fatalf("Messages.GetTrace failed: %v", err)
	}
	if trace.TotalDurationMs != 42.5 {
		t.Errorf("expected 42.5ms duration, got %f", trace.TotalDurationMs)
	}
}

func TestBatchesAndSuppressions(t *testing.T) {
	server, client := createMockServer(t)
	defer server.Close()

	ctx := context.Background()

	// Batches create
	batchRes, err := client.Batches.Create(ctx, CreateBatchRequest{
		Name:     "Promo Batch",
		Messages: []SendMessageRequest{{Channel: ChannelEmail, Recipient: "u1@example.com"}},
	})
	if err != nil {
		t.Fatalf("Batches.Create failed: %v", err)
	}
	if batchRes.Batch.ID != "batch_123" {
		t.Errorf("expected batch ID batch_123, got %s", batchRes.Batch.ID)
	}

	// Suppressions list
	supps, err := client.Suppressions.List(ctx, nil)
	if err != nil {
		t.Fatalf("Suppressions.List failed: %v", err)
	}
	if len(supps.Items) != 1 {
		t.Errorf("expected 1 suppression, got %d", len(supps.Items))
	}
}

func TestLiveTelemetry(t *testing.T) {
	server, client := createMockServer(t)
	defer server.Close()

	ctx := context.Background()
	telemetry, err := client.Admin.GetLiveTelemetry(ctx)
	if err != nil {
		t.Fatalf("Admin.GetLiveTelemetry failed: %v", err)
	}
	if telemetry.HeapSaturation != 0.42 {
		t.Errorf("expected heap saturation 0.42, got %f", telemetry.HeapSaturation)
	}
}
