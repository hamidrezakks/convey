/**
 * @convey/sdk - Lightweight Monotonic ULID Generator
 * Universally Unique Lexicographically Sortable Identifier with zero external dependencies.
 * Spec: 48-bit timestamp (10 chars) + 80-bit cryptographic randomness (16 chars) = 26 chars.
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford's Base32
const ENCODING_LEN = ENCODING.length;
const RANDOM_LEN = 16;

let lastTime = 0;
const lastRandom: number[] = new Array(RANDOM_LEN).fill(0);

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
 * Generate a monotonic Crockford Base32 26-character ULID string.
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
    const randomBytes = new Uint8Array(RANDOM_LEN);
    getRandomValues(randomBytes);
    for (let i = 0; i < RANDOM_LEN; i++) {
      lastRandom[i] = randomBytes[i] % ENCODING_LEN;
    }
  }

  let randomStr = '';
  for (let i = 0; i < RANDOM_LEN; i++) {
    randomStr += ENCODING[lastRandom[i]];
  }

  return timeStr + randomStr;
}
