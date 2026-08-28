package convey

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestHTTPClientRetries(t *testing.T) {
	var attempts int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		current := atomic.AddInt32(&attempts, 1)
		if current < 3 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":{"code":"RATE_LIMITED","message":"Too Many Requests"}}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"success":true}`))
	}))
	defer server.Close()

	client := NewClient("sk_test_123",
		WithBaseURL(server.URL),
		WithMaxRetries(3),
		WithTimeout(3*time.Second),
	)

	var result map[string]interface{}
	err := client.http.Request(context.Background(), http.MethodGet, "/test", nil, nil, &result)
	if err != nil {
		t.Fatalf("expected request to succeed after retries, got error: %v", err)
	}

	if atomic.LoadInt32(&attempts) != 3 {
		t.Errorf("expected 3 attempts, got %d", atomic.LoadInt32(&attempts))
	}
}

func TestHTTPClientErrorMappings(t *testing.T) {
	tests := []struct {
		statusCode   int
		responseBody string
		validateErr  func(err error) bool
	}{
		{
			statusCode:   400,
			responseBody: `{"error":{"code":"VALIDATION_ERROR","message":"Invalid recipient"}}`,
			validateErr: func(err error) bool {
				_, ok := IsValidationError(err)
				return ok
			},
		},
		{
			statusCode:   401,
			responseBody: `{"error":{"code":"UNAUTHORIZED","message":"Invalid API key"}}`,
			validateErr: func(err error) bool {
				_, ok := IsAuthenticationError(err)
				return ok
			},
		},
		{
			statusCode:   409,
			responseBody: `{"error":{"code":"CONFLICT","message":"Idempotency key mismatch"}}`,
			validateErr: func(err error) bool {
				_, ok := IsConflictError(err)
				return ok
			},
		},
		{
			statusCode:   429,
			responseBody: `{"error":{"code":"RATE_LIMITED","message":"Rate limit exceeded"}}`,
			validateErr: func(err error) bool {
				_, ok := IsRateLimitError(err)
				return ok
			},
		},
	}

	for _, tt := range tests {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(tt.statusCode)
			_, _ = w.Write([]byte(tt.responseBody))
		}))

		client := NewClient("sk_test_123",
			WithBaseURL(server.URL),
			WithMaxRetries(0),
		)

		var res map[string]interface{}
		err := client.http.Request(context.Background(), http.MethodPost, "/test", map[string]string{"foo": "bar"}, nil, &res)
		server.Close()

		if err == nil {
			t.Fatalf("expected error for HTTP %d, got nil", tt.statusCode)
		}
		if !tt.validateErr(err) {
			t.Errorf("failed validation for HTTP %d error: %v", tt.statusCode, err)
		}
	}
}

func TestHTTPClientContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewClient("sk_test_123", WithBaseURL(server.URL))

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	var res map[string]interface{}
	err := client.http.Request(ctx, http.MethodGet, "/test", nil, nil, &res)
	if err == nil {
		t.Fatalf("expected context timeout error, got nil")
	}
}
