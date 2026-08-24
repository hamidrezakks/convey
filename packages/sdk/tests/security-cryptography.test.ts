import { describe, expect, it } from 'bun:test';
import {
  Convey,
  ConveySecurityError,
  computeHmacSha256Hex,
  parseWebhookSignatureHeader,
  timingSafeEqual,
  verifyWebhookSignature,
} from '../src';

describe('QA Security & Cryptographic Audits', () => {
  const SECRET = 'sec_wh_01J9X8K72M9NPQR4567890ABCDEF';
  const RAW_PAYLOAD = JSON.stringify({
    id: 'evt_01J9X8K',
    type: 'message.delivered',
    data: { messageId: 'msg_01J9X8K', provider: 'sendgrid' },
  });

  describe('Webhook Header Parser Edge Cases', () => {
    it('should parse standard t=...,v1=... format', () => {
      const header = 't=1724520000,v1=abcdef1234567890';
      const parsed = parseWebhookSignatureHeader(header);
      expect(parsed.timestamp).toBe(1724520000);
      expect(parsed.signatures).toEqual(['abcdef1234567890']);
    });

    it('should parse multiple v1 signatures (key rolling / secret migration)', () => {
      const header = 't=1724520000,v1=signature_old,v1=signature_new';
      const parsed = parseWebhookSignatureHeader(header);
      expect(parsed.timestamp).toBe(1724520000);
      expect(parsed.signatures).toEqual(['signature_old', 'signature_new']);
    });

    it('should handle erratic whitespace around delimiters', () => {
      const header = '  t=1724520000  ,  v1=abcdef1234567890  ,  v1=123456  ';
      const parsed = parseWebhookSignatureHeader(header);
      expect(parsed.timestamp).toBe(1724520000);
      expect(parsed.signatures).toEqual(['abcdef1234567890', '123456']);
    });

    it('should ignore unrecognized future signature schemes (e.g. v2=...) without breaking', () => {
      const header = 't=1724520000,v2=ed25519_sig,v1=valid_hmac_hex';
      const parsed = parseWebhookSignatureHeader(header);
      expect(parsed.timestamp).toBe(1724520000);
      expect(parsed.signatures).toEqual(['valid_hmac_hex']);
    });

    it('should handle raw direct hex digest signatures without t= prefix', () => {
      const rawHex = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
      const parsed = parseWebhookSignatureHeader(rawHex);
      expect(parsed.timestamp).toBe(-1);
      expect(parsed.signatures).toEqual([rawHex]);
    });

    it('should safely parse empty, nullish or malformed header values', () => {
      expect(parseWebhookSignatureHeader('').signatures).toEqual([]);
      expect(parseWebhookSignatureHeader('   ').signatures).toEqual([]);
      expect(parseWebhookSignatureHeader('t=not_a_number').timestamp).toBeNaN();
    });
  });

  describe('Constant-Time String Comparison (timingSafeEqual)', () => {
    it('should return true for identical strings', () => {
      expect(timingSafeEqual('a4f8b2c1', 'a4f8b2c1')).toBe(true);
      expect(timingSafeEqual('', '')).toBe(true);
    });

    it('should return false for different strings of equal length', () => {
      expect(timingSafeEqual('a4f8b2c1', 'a4f8b2c2')).toBe(false);
      expect(timingSafeEqual('00000000', '11111111')).toBe(false);
    });

    it('should return false immediately for strings of different length', () => {
      expect(timingSafeEqual('short', 'longer_string')).toBe(false);
      expect(timingSafeEqual('', 'non_empty')).toBe(false);
    });
  });

  describe('Cryptographic Verification with Complex Payloads & Encodings', () => {
    it('should correctly verify multi-byte UTF-8 payload with emojis and special characters', async () => {
      const complexPayload = JSON.stringify({
        message: 'Order 📦 confirmation for user 🚀 & <special> chars €100 — مرحبا بالعالم 🌍',
        timestamp: new Date().toISOString(),
      });

      const nowUnix = Math.floor(Date.now() / 1000);
      const signedContent = `${nowUnix}.${complexPayload}`;
      const signature = await computeHmacSha256Hex(SECRET, signedContent);
      const header = `t=${nowUnix},v1=${signature}`;

      const isValid = await verifyWebhookSignature(complexPayload, header, SECRET);
      expect(isValid).toBe(true);

      const event = await Convey.webhooks.constructEvent(complexPayload, header, SECRET);
      expect(event).toBeDefined();
    });

    it('should verify Uint8Array binary payloads directly', async () => {
      const encoder = new TextEncoder();
      const binaryPayload = encoder.encode(RAW_PAYLOAD);

      const nowUnix = Math.floor(Date.now() / 1000);
      const signedContent = `${nowUnix}.${RAW_PAYLOAD}`;
      const signature = await computeHmacSha256Hex(SECRET, signedContent);
      const header = `t=${nowUnix},v1=${signature}`;

      const isValid = await verifyWebhookSignature(binaryPayload, header, SECRET);
      expect(isValid).toBe(true);
    });

    it('should support multi-signature verification when secret is rolling', async () => {
      const nowUnix = Math.floor(Date.now() / 1000);
      const signedContent = `${nowUnix}.${RAW_PAYLOAD}`;

      const activeSecret = 'sec_new_active_secret_key';
      const expiredSecret = 'sec_old_retiring_secret_key';

      const oldSig = await computeHmacSha256Hex(expiredSecret, signedContent);
      const newSig = await computeHmacSha256Hex(activeSecret, signedContent);

      const header = `t=${nowUnix},v1=${oldSig},v1=${newSig}`;

      // Server with active secret verifies successfully
      expect(await verifyWebhookSignature(RAW_PAYLOAD, header, activeSecret)).toBe(true);
      // Server still on old secret verifies successfully
      expect(await verifyWebhookSignature(RAW_PAYLOAD, header, expiredSecret)).toBe(true);
      // Server with bad secret fails
      expect(await verifyWebhookSignature(RAW_PAYLOAD, header, 'sec_invalid_key')).toBe(false);
    });

    it('should reject signature with clock skew at exact tolerance boundary + 1 second', async () => {
      const tolerance = 300;
      const nowUnix = Math.floor(Date.now() / 1000);
      const expiredUnix = nowUnix - (tolerance + 1);

      const signedContent = `${expiredUnix}.${RAW_PAYLOAD}`;
      const signature = await computeHmacSha256Hex(SECRET, signedContent);
      const header = `t=${expiredUnix},v1=${signature}`;

      const isValid = await verifyWebhookSignature(RAW_PAYLOAD, header, SECRET, tolerance);
      expect(isValid).toBe(false);
    });

    it('should accept signature at exact tolerance boundary - 1 second', async () => {
      const tolerance = 300;
      const nowUnix = Math.floor(Date.now() / 1000);
      const validPastUnix = nowUnix - (tolerance - 1);

      const signedContent = `${validPastUnix}.${RAW_PAYLOAD}`;
      const signature = await computeHmacSha256Hex(SECRET, signedContent);
      const header = `t=${validPastUnix},v1=${signature}`;

      const isValid = await verifyWebhookSignature(RAW_PAYLOAD, header, SECRET, tolerance);
      expect(isValid).toBe(true);
    });

    it('should throw ConveySecurityError when constructEvent receives non-JSON body even with valid signature', async () => {
      const nonJsonBody = 'This is raw unformatted text, not JSON';
      const nowUnix = Math.floor(Date.now() / 1000);
      const signedContent = `${nowUnix}.${nonJsonBody}`;
      const signature = await computeHmacSha256Hex(SECRET, signedContent);
      const header = `t=${nowUnix},v1=${signature}`;

      expect(Convey.webhooks.constructEvent(nonJsonBody, header, SECRET)).rejects.toBeInstanceOf(ConveySecurityError);
    });
  });
});
