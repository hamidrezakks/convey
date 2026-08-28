package convey

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

func TestLiveE2E(t *testing.T) {
	baseURL := os.Getenv("CONVEY_BASE_URL")
	apiKey := os.Getenv("CONVEY_API_KEY")

	if baseURL == "" {
		t.Skip("CONVEY_BASE_URL not set; skipping live E2E server test")
	}
	if apiKey == "" {
		apiKey = "cv_live_secret_key_e2e_testing_99887766554433221100"
	}

	client := NewClient(apiKey,
		WithBaseURL(baseURL),
		WithTimeout(10*time.Second),
		WithSandbox(true),
		WithMaxRetries(2),
	)

	ctx := context.Background()

	// 1. Live Telemetry
	t.Run("1. Live Telemetry & Health", func(t *testing.T) {
		telemetry, err := client.Admin.GetLiveTelemetry(ctx)
		if err != nil {
			t.Fatalf("Admin.GetLiveTelemetry failed: %v", err)
		}
		if telemetry.Subsystems == nil && telemetry.SystemHealth == "" {
			t.Errorf("expected subsystems or systemHealth to be present")
		}
	})

	// 2. Single Message Send
	t.Run("2. Messages Send", func(t *testing.T) {
		res, err := client.Messages.Send(ctx, SendMessageRequest{
			Channel:   ChannelEmail,
			Recipient: "go_e2e@example.com",
			Priority:  PriorityHigh,
			Content: &MessageContent{
				Subject: "Go SDK E2E Live Test",
				HTML:    "<p>Testing live Convey server integration with Go SDK</p>",
			},
			Category: "TESTING",
		})
		if err != nil {
			t.Fatalf("Messages.Send failed: %v", err)
		}
		if !strings.HasPrefix(res.PublicID, "msg_") {
			t.Errorf("expected publicId starting with 'msg_', got %s", res.PublicID)
		}
		if res.Status != StatusAccepted {
			t.Errorf("expected status ACCEPTED, got %s", res.Status)
		}
	})

	// 3. Bulk Messages
	t.Run("3. Bulk Messages Send", func(t *testing.T) {
		bulk, err := client.Messages.SendBulk(ctx, []SendMessageRequest{
			{Channel: ChannelEmail, Recipient: "go_bulk_1@example.com", Content: &MessageContent{Body: "B1"}},
			{Channel: ChannelEmail, Recipient: "go_bulk_2@example.com", Content: &MessageContent{Body: "B2"}},
		})
		if err != nil {
			t.Fatalf("Messages.SendBulk failed: %v", err)
		}
		if bulk.Total != 2 || len(bulk.Items) != 2 {
			t.Errorf("expected 2 items, got total=%d, len=%d", bulk.Total, len(bulk.Items))
		}
	})

	// 4. Template Preview
	t.Run("4. Template Preview", func(t *testing.T) {
		preview, err := client.Messages.PreviewTemplate(ctx, TemplatePreviewRequest{
			Template:  "Hello {{user}}, your order {{orderNum}} is confirmed.",
			Variables: map[string]interface{}{"user": "GoGopher", "orderNum": "#G99"},
			Recipient: "go_e2e@example.com",
		})
		if err != nil {
			t.Fatalf("Messages.PreviewTemplate failed: %v", err)
		}
		if preview.Rendered != "Hello GoGopher, your order #G99 is confirmed." {
			t.Errorf("unexpected rendered template: %s", preview.Rendered)
		}
	})

	// 5. Suppressions Add & List
	t.Run("5. Suppressions Management", func(t *testing.T) {
		sup, err := client.Suppressions.Add(ctx, AddSuppressionRequest{
			Recipient: "go_blocked@example.com",
			Channel:   ChannelEmail,
			Reason:    SuppressionManualBlock,
		})
		if err != nil {
			t.Fatalf("Suppressions.Add failed: %v", err)
		}
		if sup.Recipient != "go_blocked@example.com" {
			t.Errorf("expected recipient 'go_blocked@example.com', got %s", sup.Recipient)
		}

		listing, err := client.Suppressions.List(ctx, &ListSuppressionsQuery{Limit: 10})
		if err != nil {
			t.Fatalf("Suppressions.List failed: %v", err)
		}
		if listing.Total < 1 {
			t.Errorf("expected at least 1 suppression in listing")
		}
	})

	// 6. Sandbox Inspect & Clear
	t.Run("6. Sandbox Clear", func(t *testing.T) {
		_, err := client.Sandbox.ListMessages(ctx)
		if err != nil {
			t.Fatalf("Sandbox.ListMessages failed: %v", err)
		}
		clearRes, err := client.Sandbox.ClearMessages(ctx)
		if err != nil {
			t.Fatalf("Sandbox.ClearMessages failed: %v", err)
		}
		if !clearRes.Success {
			t.Errorf("expected clearRes.Success == true")
		}
	})
}
