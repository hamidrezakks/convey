package convey

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
	"time"
)

func BenchmarkGenerateULID(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = GenerateULID()
	}
}

func BenchmarkGenerateTraceparent(b *testing.B) {
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = GenerateTraceparent()
	}
}

func BenchmarkVerifyWebhookSignature(b *testing.B) {
	secret := "whsec_super_secret_benchmark_key"
	payload := []byte(`{"id":"evt_01J8K9P2X","type":"message.delivered","timestamp":1724800000}`)
	timestamp := time.Now().Unix()

	signedContent := []byte(fmt.Sprintf("%d.%s", timestamp, string(payload)))
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(signedContent)
	sig := hex.EncodeToString(mac.Sum(nil))
	header := fmt.Sprintf("t=%d,v1=%s", timestamp, sig)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		if !VerifyWebhookSignature(payload, header, secret, 300*time.Second) {
			b.Fatal("signature verification failed in benchmark")
		}
	}
}
