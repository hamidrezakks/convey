/**
 * @convey/sdk - Lightweight Monotonic ULID Generator
 * Universally Unique Lexicographically Sortable Identifier with zero external dependencies.
 * Spec: 48-bit timestamp + 80-bit cryptographic randomness.
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford's Base32
const ENCODING_LEN = ENCODING.length;

let lastTime = 0;
const lastRandom: number[] = new Array(10).fill(0);

function getRandomValues(buffer: Uint8Array): Uint8Array {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(buffer);
    return buffer;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('node:crypto');
    return nodeCrypto.randomFillSync(buffer);
  } catch {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
  }
}

/**
 * Generate a monotonic Crockford Base32 ULID string.
 */
export function generateUlid(now = Date.now()): string {
  let timeStr = '';
  let time = now;
  for (let i = 9; i >= 0; i--) {
    const mod = time % ENCODING_LEN;
    timeStr = ENCODING[mod] + timeStr;
    time = (time - mod) / ENCODING_LEN;
  }

  // Handle monotonicity within the same millisecond
  if (now <= lastTime) {
    for (let i = lastRandom.length - 1; i >= 0; i--) {
      lastRandom[i] = (lastRandom[i] + 1) % ENCODING_LEN;
      if (lastRandom[i] !== 0) {
        break;
      }
    }
  } else {
    lastTime = now;
    const randomBytes = new Uint8Array(10);
    getRandomValues(randomBytes);
    for (let i = 0; i < 10; i++) {
      lastRandom[i] = randomBytes[i] % ENCODING_LEN;
    }
  }

  let randomStr = '';
  for (let i = 0; i < 10; i++) {
    randomStr += ENCODING[lastRandom[i]];
  }

  return timeStr + randomStr;
}
