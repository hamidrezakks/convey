import { describe, expect, it } from 'bun:test';
import type { ProviderHealthDto } from '@convey/shared';
import { app } from '../src/index';

describe('Convey Admin & Telemetry API Test Suite', () => {
  it('GET /v1/admin/overview returns planetary metrics and subsystem health', async () => {
    const response = await app.handle(new Request('http://localhost:3000/v1/admin/overview'));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBeDefined();
    expect(body.uptimeSeconds).toBeGreaterThan(0);
    expect(body.deliverySuccessRatePercent).toBeDefined();
    expect(body.metrics24h).toBeDefined();
    expect(body.latencyPercentiles.p50Ms).toBeDefined();
    expect(body.queues.activeWorkers).toBeDefined();
    expect(body.runtime.heapUsedMb).toBeDefined();
  });

  it('GET /v1/admin/telemetry/live returns real-time live snapshot', async () => {
    const response = await app.handle(new Request('http://localhost:3000/v1/admin/telemetry/live'));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.timestamp).toBeDefined();
    expect(body.throughputRps).toBeGreaterThan(0);
    expect(body.latency.p95Ms).toBeGreaterThan(0);
    expect(body.queues.providerSendDepth).toBeDefined();
    expect(body.runtimeGuard.heapGuardThresholdPercent).toBe(85.0);
    expect(body.subsystems.postgresPool.status).toBe('healthy');
  });

  it('GET /v1/admin/messages lists messages with pagination and filtering', async () => {
    const response = await app.handle(new Request('http://localhost:3000/v1/admin/messages?page=1&limit=10'));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.messages).toBeInstanceOf(Array);
    expect(body.total).toBeDefined();
    expect(body.page).toBe(1);
    expect(body.limit).toBe(10);
  });

  it('GET /v1/admin/messages/:id returns message detail with W3C distributed trace spans', async () => {
    const response = await app.handle(
      new Request('http://localhost:3000/v1/admin/messages/msg_01JAX71R1234567890ABCDEFGH'),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.publicId).toBe('msg_01JAX71R1234567890ABCDEFGH');
    expect(body.traceparent).toBeDefined();
    expect(body.spans).toBeInstanceOf(Array);
    expect(body.spans.length).toBeGreaterThan(0);
    expect(body.encryption.algorithm).toBe('AES-256-GCM');
  });

  it('GET /v1/admin/providers returns full matrix of providers', async () => {
    const response = await app.handle(new Request('http://localhost:3000/v1/admin/providers'));
    expect(response.status).toBe(200);

    const body: ProviderHealthDto[] = await response.json();
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBeGreaterThan(5);

    const ses = body.find((p) => p.providerId === 'aws-ses');
    expect(ses).toBeDefined();
    expect(ses?.channel).toBe('EMAIL');
  });

  it('POST /v1/admin/providers/:providerId/circuit overrides circuit breaker state', async () => {
    const response = await app.handle(
      new Request('http://localhost:3000/v1/admin/providers/twilio-sms/circuit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'FORCE_HALF_OPEN', rampPercentage: 20 }),
      }),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.providerId).toBe('twilio-sms');
    expect(body.action).toBe('FORCE_HALF_OPEN');
  });

  it('POST /v1/admin/dlq/replay simulates dry-run replay with blast radius estimation', async () => {
    const response = await app.handle(
      new Request('http://localhost:3000/v1/admin/dlq/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      }),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.dryRun).toBe(true);
    expect(body.simulation.estimatedSuccessRatePercent).toBeDefined();
    expect(body.simulation.riskLevel).toBe('LOW');
  });

  it('GET /v1/admin/suppressions & POST /v1/admin/suppressions manage recipient suppressions', async () => {
    // Add suppression
    const addRes = await app.handle(
      new Request('http://localhost:3000/v1/admin/suppressions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: 'team_admin_test',
          recipient: 'spam-trap@testdomain.com',
          channel: 'EMAIL',
          reason: 'SPAM_COMPLAINT',
        }),
      }),
    );
    expect(addRes.status).toBe(200);
    const created = await addRes.json();
    expect(created.id).toBeDefined();

    // List suppressions
    const listRes = await app.handle(new Request('http://localhost:3000/v1/admin/suppressions'));
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody).toBeInstanceOf(Array);

    // Delete suppression
    const delRes = await app.handle(
      new Request(`http://localhost:3000/v1/admin/suppressions/${created.id}`, { method: 'DELETE' }),
    );
    expect(delRes.status).toBe(200);
  });

  it('POST /v1/admin/composer/send-test accepts test sandbox message', async () => {
    const response = await app.handle(
      new Request('http://localhost:3000/v1/admin/composer/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'EMAIL',
          recipient: 'test@example.com',
          payload: { subject: 'Hello', html: '<p>World</p>' },
        }),
      }),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.publicId).toBeDefined();
    expect(body.status).toBe('ACCEPTED');
  });
});
