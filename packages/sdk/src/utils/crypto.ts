/**
 * @convey/sdk - Timing-Safe Cryptographic Utilities
 * Isomorphic HMAC-SHA256 signature generation and constant-time verification.
 */

import { ConveySecurityError } from '../errors';
import type { ConveyWebhookEvent } from '../types';

/**
 * Constant-time string equality check to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Compute HMAC-SHA256 hex digest using Web Crypto API.
 */
export async function computeHmacSha256Hex(secret: string, payload: string | Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = typeof payload === 'string' ? encoder.encode(payload) : payload;

  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyData as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signatureBuffer = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, data as BufferSource);
    const bytes = new Uint8Array(signatureBuffer);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Node.js fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('node:crypto');
  return nodeCrypto.createHmac('sha256', secret).update(Buffer.from(data)).digest('hex');
}

export interface WebhookSignatureParts {
  timestamp: number;
  signatures: string[];
}

/**
 * Parse standard header format: `t=1724520000,v1=abc...,v1=def...` or raw hex signature
 */
export function parseWebhookSignatureHeader(headerValue: string): WebhookSignatureParts {
  const parts = headerValue.split(',').map((p) => p.trim());
  let timestamp = -1;
  const signatures: string[] = [];

  for (const part of parts) {
    if (part.startsWith('t=')) {
      timestamp = Number.parseInt(part.slice(2), 10);
    } else if (part.startsWith('v1=')) {
      signatures.push(part.slice(3));
    } else if (part.length > 0 && !part.includes('=')) {
      // Direct raw signature hex
      signatures.push(part);
    }
  }

  return { timestamp, signatures };
}

/**
 * Synchronous/Asynchronous Verification helper for Convey webhook signatures.
 */
export async function verifyWebhookSignature(
  payload: string | Uint8Array,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!signatureHeader || !secret) {
    return false;
  }

  const { timestamp, signatures } = parseWebhookSignatureHeader(signatureHeader);
  if (signatures.length === 0) {
    return false;
  }

  // Verify timestamp drift if timestamp is provided in the signature header
  if (timestamp > 0 && toleranceSeconds > 0) {
    const currentUnix = Math.floor(Date.now() / 1000);
    if (Math.abs(currentUnix - timestamp) > toleranceSeconds) {
      return false;
    }
  }

  const payloadString = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
  const signedContent = timestamp > 0 ? `${timestamp}.${payloadString}` : payloadString;

  const expectedSignature = await computeHmacSha256Hex(secret, signedContent);

  for (const sig of signatures) {
    if (timingSafeEqual(sig.toLowerCase(), expectedSignature.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Parse and verify incoming webhook event payload.
 */
export async function constructWebhookEvent<T = ConveyWebhookEvent>(
  payload: string | Uint8Array,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): Promise<T> {
  const isValid = await verifyWebhookSignature(payload, signatureHeader, secret, toleranceSeconds);
  if (!isValid) {
    throw new ConveySecurityError(
      'Webhook signature verification failed: invalid signature or expired timestamp.',
    );
  }

  const rawText = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
  try {
    return JSON.parse(rawText) as T;
  } catch (err) {
    throw new ConveySecurityError(`Failed to parse webhook JSON payload: ${(err as Error).message}`);
  }
}
