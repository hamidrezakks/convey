package convey

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"
)

func TestEnvironmentsAndBaseURLResolution(t *testing.T) {
	// 1. Preset resolution
	url, err := ResolveEnvironmentURL("production")
	if err != nil || url != EnvProduction {
		t.Fatalf("expected EnvProduction, got %s, err: %v", url, err)
	}

	urlUS, err := ResolveEnvironmentURL(EnvUS)
	if err != nil || urlUS != EnvUS {
		t.Fatalf("expected EnvUS, got %s, err: %v", urlUS, err)
	}

	urlEU, err := ResolveEnvironmentURL("eu")
	if err != nil || urlEU != EnvEU {
		t.Fatalf("expected EnvEU, got %s, err: %v", urlEU, err)
	}

	// 2. Normalization
	normalized, err := NormalizeBaseURL("https://api.convey.dev///")
	if err != nil || normalized != "https://api.convey.dev" {
		t.Fatalf("failed normalization: %s", normalized)
	}

	// 3. Mandatory Base URL resolution
	prevEnv := os.Getenv("CONVEY_BASE_URL")
	_ = os.Unsetenv("CONVEY_BASE_URL")
	defer func() {
		if prevEnv != "" {
			_ = os.Setenv("CONVEY_BASE_URL", prevEnv)
		}
	}()

	client := NewClient("sk_test_123")
	var dummy map[string]interface{}
	err = client.http.Request(context.Background(), http.MethodGet, "/health", nil, nil, &dummy)
	if err == nil {
		t.Fatalf("expected error when no base URL is specified, got nil")
	}

	// Client with WithEnvironment
	clientWithEnv := NewClient("sk_test_123", WithEnvironment(EnvUS))
	if clientWithEnv.GetBaseURL() != EnvUS {
		t.Fatalf("expected base URL %s, got %s", EnvUS, clientWithEnv.GetBaseURL())
	}

	// Client dynamic SetBaseURL
	clientWithEnv.SetBaseURL(EnvEU)
	if clientWithEnv.GetBaseURL() != EnvEU {
		t.Fatalf("expected base URL %s, got %s", EnvEU, clientWithEnv.GetBaseURL())
	}
}

func TestGoMiddlewareInterceptors(t *testing.T) {
	var headerValue string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headerValue = r.Header.Get("x-test-middleware")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"ok": true})
	}))
	defer server.Close()

	customMw := func(req *http.Request, next func(*http.Request) (*http.Response, error)) (*http.Response, error) {
		req.Header.Set("x-test-middleware", "injected_val_42")
		return next(req)
	}

	client := NewClient("sk_test_123",
		WithBaseURL(server.URL),
		WithMiddleware(customMw),
	)

	var res map[string]interface{}
	err := client.http.Request(context.Background(), http.MethodGet, "/test", nil, nil, &res)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}

	if headerValue != "injected_val_42" {
		t.Errorf("expected header injected_val_42, got %s", headerValue)
	}
}

func TestGoFluentMessageBuilder(t *testing.T) {
	var capturedBody map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&capturedBody)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"publicId": "msg_go_builder_01",
			"status":   "ACCEPTED",
		})
	}))
	defer server.Close()

	client := NewClient("sk_test_123", WithBaseURL(server.URL))

	resp, err := client.Messages.Builder().
		To("alice@example.com").
		Email("Subject Test", "<p>Hello</p>").
		Priority(PriorityCritical).
		Team("team_eng").
		IdempotencyKey("idem_go_123").
		Send(context.Background())

	if err != nil {
		t.Fatalf("builder send failed: %v", err)
	}

	if resp.PublicID != "msg_go_builder_01" {
		t.Errorf("expected msg_go_builder_01, got %s", resp.PublicID)
	}

	if capturedBody["priority"] != "critical" {
		t.Errorf("expected priority critical, got %v", capturedBody["priority"])
	}
}

func TestGoPollingHelpers(t *testing.T) {
	var callCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.AddInt32(&callCount, 1)
		status := StatusSending
		if count >= 3 {
			status = StatusDelivered
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(MessageDetailDto{
			PublicID: "msg_poll_test",
			Status:   status,
		})
	}))
	defer server.Close()

	client := NewClient("sk_test_123", WithBaseURL(server.URL))

	detail, err := client.Messages.WaitForDelivery(context.Background(), "msg_poll_test",
		WithPollInterval(10*time.Millisecond),
		WithPollTimeout(2*time.Second),
	)

	if err != nil {
		t.Fatalf("wait for delivery failed: %v", err)
	}

	if detail.Status != StatusDelivered {
		t.Errorf("expected status DELIVERED, got %s", detail.Status)
	}

	if atomic.LoadInt32(&callCount) != 3 {
		t.Errorf("expected 3 polls, got %d", atomic.LoadInt32(&callCount))
	}
}

func TestGoWebhookHandler(t *testing.T) {
	secret := "whsec_test_secret_abc123"
	var receivedEventID string

	handler := NewWebhookHandler(secret, map[string]WebhookEventHandler{
		"message.delivered": func(event *WebhookEvent) error {
			receivedEventID = event.ID
			return nil
		},
	})

	body, signature, err := GenerateTestWebhookEvent(secret, "message.delivered", map[string]interface{}{
		"messageId": "msg_webhook_01",
	})
	if err != nil {
		t.Fatalf("failed to generate test webhook event: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/webhooks", httptest.NewRecorder().Body)
	req.Body = ioNopCloser(body)
	req.Header.Set("convey-signature", signature)

	rec := httptest.NewRecorder()
	handler(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	if receivedEventID == "" {
		t.Errorf("expected event ID to be populated")
	}
}

func ioNopCloser(b []byte) io.ReadCloser {
	return io.NopCloser(bytes.NewReader(b))
}
