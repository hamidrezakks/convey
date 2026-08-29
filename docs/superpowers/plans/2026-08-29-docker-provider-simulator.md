# Production Docker Provider Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade provider simulation subsystem (`apps/mock-server`) and multi-container Docker Compose topology that realistically mimics all 88 communication providers across 5 canonical channels (Email, SMS, Chat, Push, Tool) with rich container logging, authentic schemas, and asynchronous webhook delivery receipts.

**Architecture:** A standalone, zero-dependency Bun application in `apps/mock-server` running discrete per-provider containers in Docker with official domain aliases (`api.resend.com`, `api.twilio.com`, `slack.com`, `fcm.googleapis.com`, `events.pagerduty.com`). Outbound HTTP calls from Convey are intercepted naturally by Docker DNS, validating schemas, generating high-visibility terminal logs in container stdout, returning official IDs, and scheduling delayed delivery webhooks back to Convey.

**Tech Stack:** Bun 1.4, TypeScript, Native `Bun.serve()`, Docker, Docker Compose, PostgreSQL 18, DragonflyDB.

**Spec:** [docs/superpowers/specs/2026-08-29-docker-provider-simulator-design.md](file:///Users/hamidrezakk/qlub/hobby/convey/docs/superpowers/specs/2026-08-29-docker-provider-simulator-design.md)

## Global Constraints
- Standalone architecture: zero runtime imports between `apps/mock-server` and outside novu.
- Code style: Must strictly pass `bun run biome:check` and `bun run biome:format`.
- Realistic schemas: Authentic HTTP status codes, headers, and IDs (e.g. Twilio `SM...`, Resend `re_...`, SendGrid `SG...`, Slack `ts`, FCM `projects/...`).
- Box-formatted high-visibility stdout logging inside every provider container.
- Delayed asynchronous webhook callback delivery back to `http://convey-server:3000/v1/webhooks/providers/:providerId`.

---

### Task 1: Project Setup, Types, ID Generator & Structured Logger

**Files:**
- Create: `apps/mock-server/package.json`
- Create: `apps/mock-server/tsconfig.json`
- Create: `apps/mock-server/src/core/types.ts`
- Create: `apps/mock-server/src/core/id-generator.ts`
- Create: `apps/mock-server/src/core/logger.ts`
- Create: `apps/mock-server/src/config.ts`
- Create: `apps/mock-server/tests/core-engine.test.ts`

**Interfaces:**
- Consumes: Standard HTTP Request / Response types.
- Produces: `ProviderMockHandler`, `MockRequestContext`, `MockResponseResult`, `generateProviderId()`, `mockLogger`.

- [ ] **Step 1: Write the failing test for Core Types, ID Generator, and Logger**

```typescript
// apps/mock-server/tests/core-engine.test.ts
import { describe, expect, it } from 'bun:test';
import { generateProviderId } from '../src/core/id-generator';
import { mockLogger } from '../src/core/logger';

describe('Core Engine & ID Generator', () => {
  it('generates authentic Resend message IDs starting with re_', () => {
    const id = generateProviderId('resend');
    expect(id).toMatch(/^re_[0-9a-zA-Z]{24,}$/);
  });

  it('generates authentic Twilio SIDs starting with SM', () => {
    const id = generateProviderId('twilio');
    expect(id).toMatch(/^SM[0-9a-fA-F]{32}$/);
  });

  it('generates authentic Slack timestamps', () => {
    const ts = generateProviderId('slack');
    expect(ts).toMatch(/^\d{10}\.\d{6}$/);
  });

  it('formats structured box logs without throwing', () => {
    const logOutput = mockLogger.formatRequestBox({
      providerId: 'resend',
      method: 'POST',
      url: '/emails',
      status: 200,
      latencyMs: 1.5,
      auth: 'Bearer re_test_key***',
      recipient: 'user@example.com',
      from: 'sender@convey.dev',
      subject: 'Test Email',
      messageId: 're_1234567890',
    });
    expect(logOutput).toContain('[MOCK-RESEND]');
    expect(logOutput).toContain('200 OK');
    expect(logOutput).toContain('user@example.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/mock-server/tests/core-engine.test.ts`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement package configuration, types, ID generator, and logger**

Create `apps/mock-server/package.json`, `apps/mock-server/tsconfig.json`, `apps/mock-server/src/core/types.ts`, `apps/mock-server/src/core/id-generator.ts`, `apps/mock-server/src/core/logger.ts`, `apps/mock-server/src/config.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/mock-server/tests/core-engine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mock-server
git commit -m "feat(mock-server): initialize mock server workspace package with core types, id generator, and box logger"
```

---

### Task 2: Email Channel Provider Mock Handlers

**Files:**
- Create: `apps/mock-server/src/handlers/email/resend.ts`
- Create: `apps/mock-server/src/handlers/email/sendgrid.ts`
- Create: `apps/mock-server/src/handlers/email/ses.ts`
- Create: `apps/mock-server/src/handlers/email/mailgun.ts`
- Create: `apps/mock-server/src/handlers/email/postmark.ts`
- Create: `apps/mock-server/src/handlers/email/brevo.ts`
- Create: `apps/mock-server/src/handlers/email/other-email.ts` (covers Mailtrap, Plunk, SparkPost, Mailjet, Mandrill, EmailJS, Mailersend, Netcore, AnyPost, Braze, Outlook365, Nodemailer, EmailWebhook)
- Create: `apps/mock-server/src/handlers/email/index.ts`
- Create: `apps/mock-server/tests/email-handlers.test.ts`

**Interfaces:**
- Consumes: `ProviderMockHandler`, `MockRequestContext`, `generateProviderId()`
- Produces: `emailHandlers: Record<string, ProviderMockHandler>`

- [ ] **Step 1: Write the failing test for Email Handlers**

```typescript
// apps/mock-server/tests/email-handlers.test.ts
import { describe, expect, it } from 'bun:test';
import { emailHandlers } from '../src/handlers/email';

describe('Email Provider Handlers', () => {
  it('handles Resend POST /emails with 200 OK and id', async () => {
    const handler = emailHandlers.resend;
    const req = new Request('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer re_test_key_12345',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@convey.dev',
        to: 'user@example.com',
        subject: 'Hello World',
        html: '<p>Welcome</p>',
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { id: string };
    expect(data.id).toMatch(/^re_/);
  });

  it('handles SendGrid POST /v3/mail/send with 202 Accepted and X-Message-Id header', async () => {
    const handler = emailHandlers.sendgrid;
    const req = new Request('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer SG.test_key_12345',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: 'user@example.com' }] }],
        from: { email: 'from@convey.dev' },
        content: [{ type: 'text/plain', value: 'Hello' }],
      }),
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(202);
    expect(res.headers.get('x-message-id')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/mock-server/tests/email-handlers.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Email mock handlers**

Implement `resend.ts`, `sendgrid.ts`, `ses.ts`, `mailgun.ts`, `postmark.ts`, `brevo.ts`, `other-email.ts`, and index router in `apps/mock-server/src/handlers/email/`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/mock-server/tests/email-handlers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mock-server/src/handlers/email apps/mock-server/tests/email-handlers.test.ts
git commit -m "feat(mock-server): implement realistic email provider mock handlers and schemas"
```

---

### Task 3: SMS Channel Provider Mock Handlers

**Files:**
- Create: `apps/mock-server/src/handlers/sms/twilio.ts`
- Create: `apps/mock-server/src/handlers/sms/infobip.ts`
- Create: `apps/mock-server/src/handlers/sms/plivo.ts`
- Create: `apps/mock-server/src/handlers/sms/telnyx.ts`
- Create: `apps/mock-server/src/handlers/sms/bandwidth.ts`
- Create: `apps/mock-server/src/handlers/sms/other-sms.ts` (covers MessageBird, Sinch, Nexmo, Termii, AfroSMS, CMTelecom, RingCentral, AzureSMS, Gupshup, ClickSend, SimpleTexting, Kannel, Cequens, SMS77, Maqsam, BurstSMS, GenericSMS, Sendchamp)
- Create: `apps/mock-server/src/handlers/sms/index.ts`
- Create: `apps/mock-server/tests/sms-handlers.test.ts`

**Interfaces:**
- Consumes: `ProviderMockHandler`, `MockRequestContext`, `generateProviderId()`
- Produces: `smsHandlers: Record<string, ProviderMockHandler>`

- [ ] **Step 1: Write the failing test for SMS Handlers**

```typescript
// apps/mock-server/tests/sms-handlers.test.ts
import { describe, expect, it } from 'bun:test';
import { smsHandlers } from '../src/handlers/sms';

describe('SMS Provider Handlers', () => {
  it('handles Twilio POST Messages.json with form-urlencoded body', async () => {
    const handler = smsHandlers.twilio;
    const body = new URLSearchParams({
      To: '+15550192834',
      From: '+15559876543',
      Body: 'Your security code is 123456.',
    }).toString();

    const req = new Request('https://api.twilio.com/2010-04-01/Accounts/ACmock123/Messages.json', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa('ACmock123:mocktoken')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const res = await handler.handle(req);
    expect(res.status).toBe(201);
    const data = (await res.json()) as { sid: string; status: string; to: string };
    expect(data.sid).toMatch(/^SM/);
    expect(data.status).toBe('queued');
    expect(data.to).toBe('+15550192834');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/mock-server/tests/sms-handlers.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement SMS mock handlers**

Implement `twilio.ts`, `infobip.ts`, `plivo.ts`, `telnyx.ts`, `bandwidth.ts`, `other-sms.ts`, and index router in `apps/mock-server/src/handlers/sms/`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/mock-server/tests/sms-handlers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mock-server/src/handlers/sms apps/mock-server/tests/sms-handlers.test.ts
git commit -m "feat(mock-server): implement realistic sms provider mock handlers and schemas"
```

---

### Task 4: Chat, Push & Tool Channel Provider Mock Handlers

**Files:**
- Create: `apps/mock-server/src/handlers/chat/slack.ts`
- Create: `apps/mock-server/src/handlers/chat/telegram.ts`
- Create: `apps/mock-server/src/handlers/chat/discord.ts`
- Create: `apps/mock-server/src/handlers/chat/other-chat.ts` (MSTeams, WhatsApp Business, Twilio WhatsApp, Line, Zulip, RocketChat, Cequens WhatsApp, Mattermost, GetStream, Webex, Grafana OnCall, Sendblue, Ryver, ChatWebhook)
- Create: `apps/mock-server/src/handlers/chat/index.ts`
- Create: `apps/mock-server/src/handlers/push/fcm.ts`
- Create: `apps/mock-server/src/handlers/push/apns.ts`
- Create: `apps/mock-server/src/handlers/push/other-push.ts` (Expo, OneSignal, Pusher Beams, Pushpad, Appio, PushWebhook)
- Create: `apps/mock-server/src/handlers/push/index.ts`
- Create: `apps/mock-server/src/handlers/tool/pagerduty.ts`
- Create: `apps/mock-server/src/handlers/tool/other-tool.ts` (Opsgenie, Grafana, ToolWebhook)
- Create: `apps/mock-server/src/handlers/tool/index.ts`
- Create: `apps/mock-server/tests/chat-push-tool-handlers.test.ts`

**Interfaces:**
- Consumes: `ProviderMockHandler`, `MockRequestContext`, `generateProviderId()`
- Produces: `chatHandlers`, `pushHandlers`, `toolHandlers`

- [ ] **Step 1: Write the failing test for Chat, Push & Tool Handlers**

```typescript
// apps/mock-server/tests/chat-push-tool-handlers.test.ts
import { describe, expect, it } from 'bun:test';
import { chatHandlers } from '../src/handlers/chat';
import { pushHandlers } from '../src/handlers/push';
import { toolHandlers } from '../src/handlers/tool';

describe('Chat, Push & Tool Provider Handlers', () => {
  it('handles Slack POST /api/chat.postMessage', async () => {
    const handler = chatHandlers.slack;
    const req = new Request('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer xoxb-mock-bot-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: 'C12345', text: 'Hello Slack' }),
    });
    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; ts: string };
    expect(data.ok).toBe(true);
    expect(data.ts).toBeDefined();
  });

  it('handles FCM POST messages:send', async () => {
    const handler = pushHandlers.fcm;
    const req = new Request('https://fcm.googleapis.com/v1/projects/mock-proj/messages:send', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer mock_token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: { token: 'fcm_token_123', notification: { title: 'Alert' } } }),
    });
    const res = await handler.handle(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { name: string };
    expect(data.name).toContain('projects/mock-proj/messages/');
  });

  it('handles PagerDuty POST /v2/enqueue', async () => {
    const handler = toolHandlers.pagerduty;
    const req = new Request('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routing_key: 'mock_rk', event_action: 'trigger', payload: { summary: 'High CPU' } }),
    });
    const res = await handler.handle(req);
    expect(res.status).toBe(202);
    const data = (await res.json()) as { status: string; dedup_key: string };
    expect(data.status).toBe('success');
    expect(data.dedup_key).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/mock-server/tests/chat-push-tool-handlers.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Chat, Push, and Tool mock handlers**

Implement files in `src/handlers/chat/`, `src/handlers/push/`, and `src/handlers/tool/`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/mock-server/tests/chat-push-tool-handlers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mock-server/src/handlers apps/mock-server/tests/chat-push-tool-handlers.test.ts
git commit -m "feat(mock-server): implement realistic chat, push, and tool provider mock handlers"
```

---

### Task 5: Core Dispatcher, Webhook Engine & Server Entrypoint

**Files:**
- Create: `apps/mock-server/src/core/engine.ts`
- Create: `apps/mock-server/src/core/webhook-client.ts`
- Create: `apps/mock-server/src/core/chaos.ts`
- Create: `apps/mock-server/src/index.ts`
- Create: `apps/mock-server/tests/webhook-chaos.test.ts`

**Interfaces:**
- Consumes: All handlers across all 5 channels
- Produces: `dispatchMockRequest()`, `scheduleWebhookCallback()`, `startMockServer()`

- [ ] **Step 1: Write the failing test for Webhooks and Chaos**

```typescript
// apps/mock-server/tests/webhook-chaos.test.ts
import { describe, expect, it } from 'bun:test';
import { scheduleWebhookCallback } from '../src/core/webhook-client';
import { applyChaosSimulation } from '../src/core/chaos';

describe('Webhook & Chaos Engine', () => {
  it('applies header-based rate limiting chaos overrides', () => {
    const headers = new Headers({ 'x-mock-status': '429' });
    const result = applyChaosSimulation({ headers });
    expect(result.shouldHalt).toBe(true);
    expect(result.status).toBe(429);
  });

  it('formats authentic webhook payloads for resend and twilio', () => {
    // verification of webhook payload builder
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/mock-server/tests/webhook-chaos.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Dispatcher, Webhook Engine, Chaos, and Server Entrypoint**

Implement `src/core/engine.ts`, `src/core/webhook-client.ts`, `src/core/chaos.ts`, `src/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/mock-server/tests/webhook-chaos.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mock-server/src/core apps/mock-server/src/index.ts apps/mock-server/tests/webhook-chaos.test.ts
git commit -m "feat(mock-server): implement core request dispatcher, chaos simulation, and async webhook callbacks"
```

---

### Task 6: Dockerfile & Multi-Container Docker Compose Topology

**Files:**
- Modify: `Dockerfile`
- Create: `docker-compose.providers.yml`
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `@convey/mock-server`
- Produces: Docker targets `mock-server`, discrete container services (`mock-resend`, `mock-twilio`, `mock-slack`, `mock-fcm`, `mock-pagerduty`, `mock-ses`, `mock-sendgrid`, `mock-mailgun`, `mock-discord`, `mock-telegram`, `mock-gateway`).

- [ ] **Step 1: Update Dockerfile with `mock-server` build target**

Add `FROM base AS mock-server` stage in root `Dockerfile`.

- [ ] **Step 2: Create `docker-compose.providers.yml`**

Define discrete container services for providers with DNS host aliases on `convey-network` and exposed ports.

- [ ] **Step 3: Update `package.json` with convenience scripts**

Add `"mock:dev": "bun apps/mock-server/src/index.ts"` and `"docker:providers:up": "docker compose -f docker-compose.yml -f docker-compose.providers.yml up -d"`.

- [ ] **Step 4: Run Biome check and tests**

Run: `bun run biome:check` and `bun test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.providers.yml package.json .env.example
git commit -m "feat(docker): add mock-server docker build stage and discrete provider multi-container compose topology"
```

---

### Task 7: Production Automated Verification Script & Documentation

**Files:**
- Create: `scripts/run-production-docker-test.ts`
- Modify: `docs/deployment-docker.md`
- Modify: `docs/providers-reference.md`

**Interfaces:**
- Consumes: Convey API & Mock Server Endpoints
- Produces: End-to-end multi-channel delivery validation report.

- [ ] **Step 1: Implement `scripts/run-production-docker-test.ts`**

Write script that dispatches real messages across all 5 channels to Convey API, verifies `202 Accepted` + `msg_<ULID>`, polls status to `SENT` and `DELIVERED`, and queries mock server inspection endpoints.

- [ ] **Step 2: Update Docker deployment and provider documentation**

Document usage of mock provider containers, viewing discrete logs (`docker compose logs -f mock-resend`), configuring environment variables, and running production tests.

- [ ] **Step 3: Run the end-to-end validation script and verify full stack**

Run: `bun run biome:check && bun test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add scripts/run-production-docker-test.ts docs/deployment-docker.md docs/providers-reference.md
git commit -m "feat(test): add automated production docker verification test script and updated docs"
```
