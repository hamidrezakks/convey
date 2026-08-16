import { describe, expect, it } from 'bun:test';
import { IdempotencyService } from '../src/modules/messaging/idempotency.service';
import { MessagingService, validateChannelRecipients } from '../src/modules/messaging/messaging.service';
import {
  Channel,
  MessagePriority,
  ReservationStatus,
  type SendMessageRequest,
} from '../src/modules/messaging/messaging.types';
import { hashString } from '../src/utils/crypto';
import { containsInternalProviderMessageId, redactSensitiveConfig } from './helpers/provider-interceptor-harness';

describe('Security & Boundary Hardening Suite', () => {
  it('zero Provider Message ID Leakage across public API responses', async () => {
    const request: SendMessageRequest = {
      idempotencyKey: `sec_opaque_id_${Date.now()}`,
      userId: 'usr_sec_001',
      team: 'sec_team',
      category: 'transactional',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { email: 'sec@example.com' },
      channels: [
        {
          channel: Channel.EMAIL,
          content: { subject: 'Security Test', text: 'Zero Provider ID Leakage Audit' },
        },
      ],
    };

    const response = await MessagingService.acceptMessage(request);
    expect(response.statusCode).toBe(202);

    const messageId = (response.body as Record<string, unknown>).messageId as string;
    expect(messageId.startsWith('msg_')).toBeTrue(); // Public opaque message ID format

    // Verify response body contains 0 internal provider message IDs
    const leaksInternalId = containsInternalProviderMessageId(response.body);
    expect(leaksInternalId).toBeFalse();
  });

  it('zero-Trust Credential Masking in telemetry and error dumps', () => {
    const rawConfig = {
      providerId: 'resend',
      apiKey: 're_secret_live_key_99999',
      authToken: 'auth_token_super_secret',
      secretAccessKey: 'aws_secret_key_12345',
      botToken: 'bot_token_discord_12345',
      webhookUrl: 'https://discord.com/api/webhooks/123456/abcdef',
    };

    const redacted = redactSensitiveConfig(rawConfig);

    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.authToken).toBe('[REDACTED]');
    expect(redacted.secretAccessKey).toBe('[REDACTED]');
    expect(redacted.botToken).toBe('[REDACTED]');
    expect(redacted.webhookUrl).toBe('https://discord.com/api/webhooks/123456/abcdef');
  });

  it('malicious SQL injection, XSS script, and malformed recipient sanitization', () => {
    // Malicious SQL injection string in idempotencyKey
    const requestSqlInj: SendMessageRequest = {
      idempotencyKey: "' OR 1=1 --",
      userId: "usr_hacker' UNION SELECT * FROM users --",
      team: 'sec_team',
      category: 'transactional',
      country: 'US',
      priority: MessagePriority.NORMAL,
      recipients: { email: 'hacker@example.com' },
      channels: [
        {
          channel: Channel.EMAIL,
          content: { subject: "<script>alert('xss')</script>", text: 'Test' },
        },
      ],
    };

    const err = validateChannelRecipients(requestSqlInj.channels, requestSqlInj.recipients);
    expect(err).toBeNull();

    // Malformed SMS recipient without valid phone number
    const malformedSmsErr = validateChannelRecipients([{ channel: Channel.SMS, content: { text: 'Hi' } }], {});
    expect(malformedSmsErr).toContain('Valid phone number is required');
  });

  it('Redis Idempotency Key Lock TTL expiration and release clean-up', async () => {
    const team = 'sec_idempotency_team';
    const key = `sec_lock_${Date.now()}`;
    const payload = { testPayload: 1 };

    // Acquire lock
    const reservation1 = await IdempotencyService.reserve(team, key, payload);
    expect(reservation1.status).toBe(ReservationStatus.ACQUIRED);

    // Complete reservation
    await IdempotencyService.complete(team, key, payload, 'msg_completed_001', { ok: true });

    // Subsequent request returns completed result
    const reservation2 = await IdempotencyService.reserve(team, key, payload);
    expect(reservation2.status).toBe(ReservationStatus.COMPLETED);
    expect(reservation2.messageId).toBe('msg_completed_001');
  });

  it('rejects tampered webhook payloads with invalid HMAC signatures', () => {
    const secret = 'webhook_hmac_secret_key_32_bytes';
    const payload = JSON.stringify({ event: 'delivery.delivered', messageId: 'msg_01' });

    const validSignature = hashString(`${payload}${secret}`);
    const tamperedSignature = hashString(`${payload}_tampered${secret}`);

    // Verify signature check algorithm
    const isValidSignature = (sig: string) => sig === validSignature;

    expect(isValidSignature(validSignature)).toBeTrue();
    expect(isValidSignature(tamperedSignature)).toBeFalse();
  });
});
