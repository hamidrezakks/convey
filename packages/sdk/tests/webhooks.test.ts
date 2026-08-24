import { describe, expect, it } from 'bun:test';
import { Convey, ConveySecurityError } from '../src';
import { computeHmacSha256Hex } from '../src/utils/crypto';

describe('Webhook HMAC-SHA256 Cryptographic Verification', () => {
  const SECRET = 'whsec_test_secret_key_8492019482';
  const PAYLOAD = JSON.stringify({
    id: 'evt_01J9X8K',
    type: 'message.delivered',
    timestamp: '2026-08-24T20:00:00Z',
    tenantId: 'tenant_1',
    team: 'team_1',
    data: { messageId: 'msg_01J9X8K', provider: 'sendgrid' },
  });

  it('should verify a valid raw hex HMAC-SHA256 signature', async () => {
    const signature = await computeHmacSha256Hex(SECRET, PAYLOAD);
    const isValid = await Convey.webhooks.verifySignature(PAYLOAD, signature, SECRET);
    expect(isValid).toBe(true);
  });

  it('should verify a standard formatted t=...,v1=... signature header', async () => {
    const nowUnix = Math.floor(Date.now() / 1000);
    const signedContent = `${nowUnix}.${PAYLOAD}`;
    const hex = await computeHmacSha256Hex(SECRET, signedContent);
    const header = `t=${nowUnix},v1=${hex}`;

    const isValid = await Convey.webhooks.verifySignature(PAYLOAD, header, SECRET, 300);
    expect(isValid).toBe(true);
  });

  it('should reject when payload is tampered', async () => {
    const signature = await computeHmacSha256Hex(SECRET, PAYLOAD);
    const tamperedPayload = PAYLOAD.replace('sendgrid', 'twilio');
    const isValid = await Convey.webhooks.verifySignature(tamperedPayload, signature, SECRET);
    expect(isValid).toBe(false);
  });

  it('should reject when secret is incorrect', async () => {
    const signature = await computeHmacSha256Hex(SECRET, PAYLOAD);
    const isValid = await Convey.webhooks.verifySignature(PAYLOAD, signature, 'wrong_secret');
    expect(isValid).toBe(false);
  });

  it('should reject when timestamp exceeds tolerance window', async () => {
    const oldUnix = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago (tolerance is 300)
    const signedContent = `${oldUnix}.${PAYLOAD}`;
    const hex = await computeHmacSha256Hex(SECRET, signedContent);
    const header = `t=${oldUnix},v1=${hex}`;

    const isValid = await Convey.webhooks.verifySignature(PAYLOAD, header, SECRET, 300);
    expect(isValid).toBe(false);
  });

  it('should deserialize typed event payload successfully on valid signature', async () => {
    const nowUnix = Math.floor(Date.now() / 1000);
    const signedContent = `${nowUnix}.${PAYLOAD}`;
    const hex = await computeHmacSha256Hex(SECRET, signedContent);
    const header = `t=${nowUnix},v1=${hex}`;

    const event = await Convey.webhooks.constructEvent<{ messageId: string; provider: string }>(
      PAYLOAD,
      header,
      SECRET,
    );

    expect(event.id).toBe('evt_01J9X8K');
    expect(event.type).toBe('message.delivered');
    expect(event.data.messageId).toBe('msg_01J9X8K');
    expect(event.data.provider).toBe('sendgrid');
  });

  it('should throw ConveySecurityError when signature is invalid in constructEvent', async () => {
    expect(Convey.webhooks.constructEvent(PAYLOAD, 'v1=bad_signature_hex', SECRET)).rejects.toBeInstanceOf(
      ConveySecurityError,
    );
  });
});
