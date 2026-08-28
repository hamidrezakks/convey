package convey

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
	"time"
)

func TestVerifyWebhookSignature(t *testing.T) {
	secret := "whsec_test_secret_123"
	payload := []byte(`{"id":"evt_01J8K9P2X","type":"message.delivered","timestamp":1724800000,"data":{"messageId":"msg_01"}}`)
	timestamp := time.Now().Unix()

	// Compute valid signature
	signedContent := []byte(fmt.Sprintf("%d.%s", timestamp, string(payload)))
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(signedContent)
	validSig := hex.EncodeToString(mac.Sum(nil))

	header := fmt.Sprintf("t=%d,v1=%s", timestamp, validSig)

	// 1. Valid Signature
	if !VerifyWebhookSignature(payload, header, secret, 300*time.Second) {
		t.Errorf("expected valid signature to pass verification")
	}

	// 2. Tampered Payload
	tamperedPayload := []byte(`{"id":"evt_tampered"}`)
	if VerifyWebhookSignature(tamperedPayload, header, secret, 300*time.Second) {
		t.Errorf("expected tampered payload to fail verification")
	}

	// 3. Expired Timestamp
	expiredTimestamp := time.Now().Unix() - 600
	expiredSignedContent := []byte(fmt.Sprintf("%d.%s", expiredTimestamp, string(payload)))
	macExpired := hmac.New(sha256.New, []byte(secret))
	macExpired.Write(expiredSignedContent)
	expiredSig := hex.EncodeToString(macExpired.Sum(nil))
	expiredHeader := fmt.Sprintf("t=%d,v1=%s", expiredTimestamp, expiredSig)

	if VerifyWebhookSignature(payload, expiredHeader, secret, 300*time.Second) {
		t.Errorf("expected expired timestamp to fail verification")
	}

	// 4. ConstructWebhookEvent typed deserialization
	event, err := ConstructWebhookEvent[map[string]interface{}](payload, header, secret, 300*time.Second)
	if err != nil {
		t.Fatalf("ConstructWebhookEvent failed: %v", err)
	}
	if event.ID != "evt_01J8K9P2X" || event.Type != "message.delivered" {
		t.Errorf("unexpected deserialized event: %+v", event)
	}
}
