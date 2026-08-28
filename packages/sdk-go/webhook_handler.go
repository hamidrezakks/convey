package convey

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// WebhookEvent is an alias for untyped Webhook event payloads.
type WebhookEvent = ConveyWebhookEvent[map[string]interface{}]

// WebhookEventHandler is a callback function for processing incoming webhook events.
type WebhookEventHandler func(event *WebhookEvent) error

// NewWebhookHandler creates a standard http.HandlerFunc that verifies signatures and routes events.
func NewWebhookHandler(secret string, handlers map[string]WebhookEventHandler, toleranceSeconds ...int) http.HandlerFunc {
	tolerance := 300 * time.Second
	if len(toleranceSeconds) > 0 && toleranceSeconds[0] > 0 {
		tolerance = time.Duration(toleranceSeconds[0]) * time.Second
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		signature := r.Header.Get("convey-signature")
		if signature == "" {
			signature = r.Header.Get("x-convey-signature")
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		event, err := ConstructWebhookEvent[map[string]interface{}](body, signature, secret, tolerance)
		if err != nil {
			http.Error(w, fmt.Sprintf("Webhook Verification Failed: %v", err), http.StatusBadRequest)
			return
		}

		if handler, ok := handlers[event.Type]; ok {
			if err := handler(event); err != nil {
				http.Error(w, fmt.Sprintf("Handler error: %v", err), http.StatusInternalServerError)
				return
			}
		}

		if wildcard, ok := handlers["*"]; ok {
			if err := wildcard(event); err != nil {
				http.Error(w, fmt.Sprintf("Wildcard handler error: %v", err), http.StatusInternalServerError)
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"received": true,
			"eventId":  event.ID,
		})
	}
}

// GenerateTestWebhookEvent generates a cryptographically signed mock webhook payload and signature header.
func GenerateTestWebhookEvent(secret string, eventType string, payload interface{}, timestamp ...int64) ([]byte, string, error) {
	ts := time.Now().Unix()
	if len(timestamp) > 0 && timestamp[0] > 0 {
		ts = timestamp[0]
	}

	event := map[string]interface{}{
		"id":        fmt.Sprintf("evt_test_%d", ts),
		"type":      eventType,
		"createdAt": time.Unix(ts, 0).UTC().Format(time.RFC3339),
		"teamId":    "team_test",
		"data":      payload,
	}

	rawBody, err := json.Marshal(event)
	if err != nil {
		return nil, "", err
	}

	signedContent := fmt.Sprintf("%d.%s", ts, string(rawBody))
	sigHex, err := ComputeHMACSHA256Hex(secret, []byte(signedContent))
	if err != nil {
		return nil, "", err
	}

	signatureHeader := fmt.Sprintf("t=%d,v1=%s", ts, sigHex)
	return rawBody, signatureHeader, nil
}
