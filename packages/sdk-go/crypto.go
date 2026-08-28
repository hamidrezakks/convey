package convey

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

// ParseWebhookSignatureHeader extracts the timestamp and v1 hex signatures from x-convey-signature.
func ParseWebhookSignatureHeader(headerValue string) (timestamp int64, signatures []string) {
	timestamp = -1
	signatures = make([]string, 0)

	parts := strings.Split(headerValue, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "t=") {
			if ts, err := strconv.ParseInt(part[2:], 10, 64); err == nil {
				timestamp = ts
			}
		} else if strings.HasPrefix(part, "v1=") {
			signatures = append(signatures, part[3:])
		} else if part != "" && !strings.Contains(part, "=") {
			signatures = append(signatures, part)
		}
	}

	return timestamp, signatures
}

// VerifyWebhookSignature verifies the HMAC-SHA256 signature against the raw payload.
func VerifyWebhookSignature(payload []byte, signatureHeader string, secret string, tolerance time.Duration) bool {
	if signatureHeader == "" || secret == "" {
		return false
	}

	timestamp, signatures := ParseWebhookSignatureHeader(signatureHeader)
	if len(signatures) == 0 {
		return false
	}

	if timestamp > 0 && tolerance > 0 {
		now := time.Now().Unix()
		diff := math.Abs(float64(now - timestamp))
		if diff > tolerance.Seconds() {
			return false
		}
	}

	var signedContent []byte
	if timestamp > 0 {
		signedContent = []byte(fmt.Sprintf("%d.%s", timestamp, string(payload)))
	} else {
		signedContent = payload
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(signedContent)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	for _, sig := range signatures {
		if subtle.ConstantTimeCompare([]byte(strings.ToLower(sig)), []byte(strings.ToLower(expectedSignature))) == 1 {
			return true
		}
	}

	return false
}

// ConstructWebhookEvent verifies the HMAC-SHA256 signature and deserializes the JSON event.
func ConstructWebhookEvent[T any](payload []byte, signatureHeader string, secret string, tolerance time.Duration) (*ConveyWebhookEvent[T], error) {
	if !VerifyWebhookSignature(payload, signatureHeader, secret, tolerance) {
		return nil, &SecurityError{
			BaseError: BaseError{
				Message: "webhook signature verification failed: invalid signature or timestamp drift exceeded",
			},
		}
	}

	var event ConveyWebhookEvent[T]
	if err := json.Unmarshal(payload, &event); err != nil {
		return nil, &SecurityError{
			BaseError: BaseError{
				Message: fmt.Sprintf("failed to parse webhook JSON payload: %s", err.Error()),
			},
		}
	}

	return &event, nil
}
