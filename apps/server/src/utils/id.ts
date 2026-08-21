/**
 * Generates an RFC 9562 compliant UUID v7 string using Bun's native generator.
 * UUID v7 encodes a 48-bit Unix millisecond timestamp followed by random bits,
 * providing time-ordered lexicographical sortability.
 */
export function generateUuidV7(): string {
  return Bun.randomUUIDv7();
}

/**
 * Generates an opaque, time-ordered public message ID using native Bun UUID v7.
 * Format: msg_<UUIDv7> (e.g. msg_019ff136-5b97-7000-91ed-8766f497b8ab)
 */
export function generateMessageId(): string {
  return `msg_${generateUuidV7()}`;
}

/**
 * Parses the embedded creation timestamp from a UUID v7 or msg_<UUIDv7> string.
 * Returns a JS Date object.
 */
export function parseMessageIdTimestamp(messageId: string): Date {
  if (!messageId || typeof messageId !== 'string') return new Date();
  const cleanId = messageId.replace(/^msg_/, '').replace(/-/g, '');
  const timestampHex = cleanId.slice(0, 12);

  if (!/^[0-9a-f]{12}$/i.test(timestampHex)) {
    return new Date();
  }

  const timestampMs = Number.parseInt(timestampHex, 16);

  // Sanity check: must fall between 2020-01-01 and year 2100
  if (Number.isNaN(timestampMs) || timestampMs < 1577836800000 || timestampMs > 4102444800000) {
    return new Date();
  }

  return new Date(timestampMs);
}
