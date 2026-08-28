# Convey Go SDK (`packages/sdk-go`)

Official zero-dependency, high-performance Go client for the [Convey](https://github.com/hamidrezakks/convey) omnichannel communication platform.

## Features

- 🚀 **Zero External Dependencies**: Standard Go library with tuned `http.Transport` connection pooling and HTTP/2 multiplexing.
- 🔄 **Resilient Full-Jitter Exponential Backoff**: Automatic retry handling for HTTP 429 and transient 5xx errors with `Retry-After` header parsing.
- 🔒 **Zero Provider Exposure**: Public ULIDs (`msg_<ULID>`) hide provider message IDs.
- 🆔 **Automatic Idempotency Keying**: Monotonic ULID injection for mutating requests.
- 🌐 **W3C Distributed Tracing**: Native `traceparent` context generation and child span propagation.
- 🛡️ **Cryptographic Webhook Verification**: Constant-time HMAC-SHA256 verification and generic typed event deserialization.
- 📄 **Generic Auto-Pagination**: Memory-efficient streaming across large result sets.

---

## Installation

```bash
go get github.com/hamidrezakks/convey/packages/sdk-go
```

---

## Quickstart

```go
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/hamidrezakks/convey/packages/sdk-go"
)

func main() {
	client := convey.NewClient(os.Getenv("CONVEY_API_KEY"),
		convey.WithBaseURL("http://localhost:3000"),
		convey.WithTimeout(10*time.Second),
		convey.WithMaxRetries(3),
	)

	// Send an omnichannel message
	res, err := client.Messages.Send(context.Background(), convey.SendMessageRequest{
		Channel:   convey.ChannelEmail,
		Recipient: "alex@example.com",
		Priority:  convey.PriorityHigh,
		Content: &convey.MessageContent{
			Subject: "Your Monthly Statement",
			HTML:    "<p>Your monthly statement is now available.</p>",
		},
	})
	if err != nil {
		panic(err)
	}

	fmt.Printf("Accepted message ID: %s (Status: %s)\n", res.PublicID, res.Status)
}
```

---

## Webhook Signature Verification

```go
package main

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/hamidrezakks/convey/packages/sdk-go"
)

func handleWebhook(w http.ResponseWriter, r *http.Request) {
	secret := "whsec_..."
	signatureHeader := r.Header.Get("x-convey-signature")

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	event, err := convey.ConstructWebhookEvent[map[string]interface{}](body, signatureHeader, secret, 300*time.Second)
	if err != nil {
		http.Error(w, "Invalid signature", http.StatusUnauthorized)
		return
	}

	fmt.Printf("Verified event %s: %s\n", event.ID, event.Type)
	w.WriteHeader(http.StatusOK)
}
```

---

## Auto-Pagination

```go
paginator := client.Suppressions.ListAutoPaging(&convey.ListSuppressionsQuery{
	Reason: convey.SuppressionHardBounce,
})

for {
	item, err := paginator.Next(context.Background())
	if err != nil {
		log.Fatal(err)
	}
	if item == nil {
		break // End of results
	}
	fmt.Printf("Suppressed recipient: %s\n", item.Recipient)
}
```

---

## License

MIT © [Convey](https://github.com/hamidrezakks/convey)
