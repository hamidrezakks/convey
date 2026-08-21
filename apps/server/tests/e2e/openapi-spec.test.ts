import { describe, expect, it } from 'bun:test';
import { app } from '../../src/index';

describe('OpenAPI 3.1 Specification & Multi-Channel Examples Test Suite', () => {
  it('GET /swagger returns Swagger UI HTML with 200 OK', async () => {
    const res = await app.fetch(new Request('http://localhost/swagger'));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.toLowerCase()).toContain('html');
  });

  it('GET /swagger/json returns valid OpenAPI 3.1 JSON schema document', async () => {
    const res = await app.fetch(new Request('http://localhost/swagger/json'));
    expect(res.status).toBe(200);
    const doc = (await res.json()) as {
      openapi: string;
      info: { title: string; version: string; description: string };
      servers: Array<{ url: string; description?: string }>;
      tags: Array<{ name: string; description?: string }>;
      paths: Record<string, Record<string, unknown>>;
      components: {
        schemas: Record<string, unknown>;
        securitySchemes?: Record<string, unknown>;
      };
    };

    expect(doc.openapi).toBeDefined();
    expect(doc.info.title).toContain('Convey');
    expect(doc.info.version).toBe('1.0.0');
    expect(doc.servers.length).toBeGreaterThanOrEqual(1);
    expect(doc.tags.length).toBeGreaterThanOrEqual(5);
    expect(doc.components.schemas).toBeDefined();
  });

  it('Verifies OpenAPI components.schemas contains all critical core definitions', async () => {
    const res = await app.fetch(new Request('http://localhost/swagger/json'));
    const doc = (await res.json()) as {
      components: {
        schemas: Record<string, unknown>;
        securitySchemes?: Record<string, unknown>;
      };
    };

    const schemaKeys = Object.keys(doc.components.schemas);
    expect(schemaKeys).toContain('ErrorResponse');
    expect(schemaKeys).toContain('RecipientSchema');
    expect(schemaKeys).toContain('SendMessageRequest');
    expect(schemaKeys).toContain('SendMessageAcceptedResponse');
    expect(schemaKeys).toContain('BulkSendMessageRequest');
    expect(schemaKeys).toContain('BulkSendMessageAcceptedResponse');
    expect(schemaKeys).toContain('MessageStatusResponse');
    expect(schemaKeys).toContain('DeliveryTraceResponse');
    expect(schemaKeys).toContain('BatchResponse');
    expect(schemaKeys).toContain('DlqReplayRequest');
    expect(schemaKeys).toContain('SuppressionRecord');
    expect(schemaKeys).toContain('WebhookSubscription');
    expect(schemaKeys).toContain('HealthCheckResponse');
  });

  it('Verifies POST /v1/messages contains all 12 channel variation examples in requestBody', async () => {
    const res = await app.fetch(new Request('http://localhost/swagger/json'));
    const doc = (await res.json()) as {
      paths: {
        '/v1/messages/': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  examples: Record<string, { summary: string; value: Record<string, unknown> }>;
                };
              };
            };
            responses: Record<string, { description: string }>;
          };
        };
      };
    };

    const postMessages = doc.paths['/v1/messages/']?.post;
    expect(postMessages).toBeDefined();

    const examples = postMessages.requestBody.content['application/json'].examples;
    expect(examples).toBeDefined();

    const exampleKeys = Object.keys(examples);
    expect(exampleKeys).toContain('sms_otp');
    expect(exampleKeys).toContain('email_html_receipt');
    expect(exampleKeys).toContain('email_template_shipping');
    expect(exampleKeys).toContain('whatsapp_utility_template');
    expect(exampleKeys).toContain('whatsapp_session_text');
    expect(exampleKeys).toContain('push_fcm_mobile');
    expect(exampleKeys).toContain('push_apns_ios');
    expect(exampleKeys).toContain('slack_incident_alert');
    expect(exampleKeys).toContain('telegram_bot_otp');
    expect(exampleKeys).toContain('multichannel_fallback_cascade');
    expect(exampleKeys).toContain('scheduled_campaign_delivery');
    expect(exampleKeys).toContain('sandbox_test_dispatch');

    // Verify SMS example structure
    expect(examples.sms_otp.value.recipients).toBeDefined();
    expect(examples.sms_otp.value.channels).toBeDefined();

    // Verify Email HTML example structure
    expect(examples.email_html_receipt.value.channels).toBeDefined();

    // Verify WhatsApp template example structure
    expect(examples.whatsapp_utility_template.value.channels).toBeDefined();
  });

  it('Verifies POST /v1/messages defines full status code taxonomy (202, 400, 401, 409, 422, 429, 500, 503)', async () => {
    const res = await app.fetch(new Request('http://localhost/swagger/json'));
    const doc = (await res.json()) as {
      paths: {
        '/v1/messages/': {
          post: {
            responses: Record<string, { description: string; content?: Record<string, { examples?: unknown }> }>;
          };
        };
      };
    };

    const responses = doc.paths['/v1/messages/'].post.responses;
    expect(responses['202']).toBeDefined();
    expect(responses['400']).toBeDefined();
    expect(responses['401']).toBeDefined();
    expect(responses['409']).toBeDefined();
    expect(responses['422']).toBeDefined();
    expect(responses['429']).toBeDefined();
    expect(responses['500']).toBeDefined();
    expect(responses['503']).toBeDefined();
  });

  it('Verifies complete API endpoint coverage across all modules in OpenAPI paths', async () => {
    const res = await app.fetch(new Request('http://localhost/swagger/json'));
    const doc = (await res.json()) as {
      paths: Record<string, Record<string, { tags?: string[]; summary?: string }>>;
    };

    const pathKeys = Object.keys(doc.paths);

    // Messages
    expect(pathKeys.some((p) => p.includes('/v1/messages'))).toBe(true);
    expect(pathKeys.some((p) => p.includes('/v1/messages/bulk'))).toBe(true);

    // Batches
    expect(pathKeys.some((p) => p.includes('/v1/batches'))).toBe(true);

    // DLQ
    expect(pathKeys.some((p) => p.includes('/v1/dlq'))).toBe(true);
    expect(pathKeys.some((p) => p.includes('/v1/dlq/replay'))).toBe(true);

    // Sandbox
    expect(pathKeys.some((p) => p.includes('/v1/sandbox/messages'))).toBe(true);

    // Suppressions
    expect(pathKeys.some((p) => p.includes('/v1/suppressions'))).toBe(true);

    // Webhooks & Tracking
    expect(pathKeys.some((p) => p.includes('/v1/webhooks'))).toBe(true);
    expect(pathKeys.some((p) => p.includes('/v1/t/'))).toBe(true);
    expect(pathKeys.some((p) => p.includes('/v1/receipts'))).toBe(true);
    expect(pathKeys.some((p) => p.includes('/v1/webhook-subscriptions'))).toBe(true);

    // Admin
    expect(pathKeys.some((p) => p.includes('/v1/admin/overview'))).toBe(true);
    expect(pathKeys.some((p) => p.includes('/v1/admin/telemetry/live'))).toBe(true);
    expect(pathKeys.some((p) => p.includes('/v1/admin/messages'))).toBe(true);
    expect(pathKeys.some((p) => p.includes('/v1/admin/providers'))).toBe(true);

    // Health
    expect(pathKeys).toContain('/health');
    expect(pathKeys).toContain('/health/readiness');
    expect(pathKeys).toContain('/health/liveness');
    expect(pathKeys).toContain('/metrics');
  });
});
