import type { DocSection } from './quickstart';

export const sdksDoc: DocSection = {
  id: 'sdks',
  title: 'Client SDKs & Integration Libraries',
  description:
    'Official production client libraries for TypeScript/Node/Bun, Python AsyncIO, Go, and webhook cryptographic verification.',
  headings: [
    { id: 'typescript-sdk', title: 'TypeScript / Node / Bun Client SDK', level: 2 },
    { id: 'python-sdk', title: 'Python Client SDK (AsyncIO)', level: 2 },
    { id: 'go-sdk', title: 'Go Client SDK', level: 2 },
    { id: 'webhook-verification', title: 'Inbound Webhook Cryptographic Verification', level: 2 },
  ],
  content: `
## TypeScript / Node / Bun Client SDK

Install the official client package:

\`\`\`bash
bun add @convey/client
# or
npm install @convey/client
\`\`\`

### Initializing the Client & Sending a Message
\`\`\`typescript
import { ConveyClient, MessagePriority } from '@convey/client';

const convey = new ConveyClient({
  apiKey: process.env.CONVEY_API_KEY!,
  baseUrl: 'https://api.convey.internal',
  timeoutMs: 5000,
  maxRetries: 3,
});

// Transactional Send with Automatic Idempotency & Tracing
const result = await convey.messages.send({
  channel: 'email',
  recipient: 'developer@enterprise.com',
  priority: MessagePriority.HIGH,
  idempotencyKey: 'inv_10492_dispatch',
  content: {
    subject: 'Your API Access Key Has Been Generated',
    body: 'Hello! Your new production API key is ready in the dashboard.',
  },
  routing: {
    strategy: 'SMART_SCORECARD',
    primaryProvider: 'resend',
    fallbackChain: ['aws-ses', 'sendgrid'],
  },
});

console.log(\`Message Accepted: \${result.publicId} (Latency: \${result.latencyMs}ms)\`);
\`\`\`

---

## Python Client SDK (AsyncIO)

Install via pip:

\`\`\`bash
pip install convey-python
\`\`\`

### Asynchronous Message Dispatch
\`\`\`python
import asyncio
import os
from convey import AsyncConveyClient, MessagePriority

async def main():
    async with AsyncConveyClient(
        api_key=os.environ["CONVEY_API_KEY"],
        base_url="https://api.convey.internal"
    ) as client:
        response = await client.messages.send(
            channel="sms",
            recipient="+14155552671",
            priority=MessagePriority.HIGH,
            idempotency_key="auth_otp_99218",
            content={
                "body": "Your security verification code is 492019."
            },
            routing={
                "strategy": "SMART_SCORECARD",
                "primary_provider": "twilio",
                "fallback_chain": ["vonage", "infobip"]
            }
        )
        print(f"Accepted: {response.public_id} status={response.status}")

asyncio.run(main())
\`\`\`

---

## Go Client SDK

Install via go get:

\`\`\`bash
go get github.com/convey/convey-go
\`\`\`

### Example Go Implementation
\`\`\`go
package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/convey/convey-go/convey"
)

func main() {
	client := convey.NewClient(
		"cv_live_9f8a3c1e2b4d5e6f",
		convey.WithBaseURL("https://api.convey.internal"),
		convey.WithTimeout(5*time.Second),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	msg, err := client.Messages.Send(ctx, &convey.SendMessageRequest{
		Channel:        convey.ChannelEmail,
		Recipient:      "platform-team@company.com",
		Priority:       convey.PriorityCritical,
		IdempotencyKey: "deploy_alert_9182",
		Content: convey.MessageContent{
			Subject: "Production Cluster Deployment Finished",
			Body:    "All 20 Kubernetes replicas updated successfully.",
		},
	})
	if err != nil {
		log.Fatalf("Convey send failed: %v", err)
	}

	fmt.Printf("Accepted message %s (Latency: %dms)\n", msg.PublicID, msg.LatencyMs)
}
\`\`\`

---

## Inbound Webhook Cryptographic Verification

Convey signs all outbound customer webhooks with HMAC-SHA256 in the \`x-convey-signature\` header.

### Verification in TypeScript / Node.js
\`\`\`typescript
import crypto from 'node:crypto';

export function verifyWebhookSignature(
  payloadRawBody: string,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadRawBody, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedSignature)
  );
}
\`\`\`
`,
};
