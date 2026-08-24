import { describe, expect, it } from 'bun:test';
import { generateUlid } from '../src';

describe('QA ULID Monotonicity & High-Concurrency Stress', () => {
  const CROCKFORD_BASE32_REGEX = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

  it('should generate valid 26-character Crockford Base32 ULIDs', () => {
    for (let i = 0; i < 100; i++) {
      const ulid = generateUlid();
      expect(ulid).toHaveLength(26);
      expect(ulid).toMatch(CROCKFORD_BASE32_REGEX);
      // Ensure excluded ambiguous Crockford characters (I, L, O, U) are never present
      expect(ulid).not.toMatch(/[ILOU]/);
    }
  });

  it('should strictly maintain lexicographical monotonicity across 10,000 rapid iterations', () => {
    const COUNT = 10000;
    const generated: string[] = new Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      generated[i] = generateUlid();
    }

    // Verify all generated IDs are strictly unique and strictly increasing
    for (let i = 0; i < COUNT - 1; i++) {
      const current = generated[i];
      const next = generated[i + 1];

      expect(current).not.toBe(next);
      expect(current < next).toBe(true);
    }
  });

  it('should preserve monotonicity when called with fixed timestamp (simulating sub-millisecond bursts)', () => {
    const fixedTimestamp = 1724520000000;
    const BATCH = 500;
    const batchUlids: string[] = [];

    for (let i = 0; i < BATCH; i++) {
      batchUlids.push(generateUlid(fixedTimestamp));
    }

    // All ULIDs within same millisecond share identical timestamp prefix (first 10 chars)
    const firstPrefix = batchUlids[0].substring(0, 10);
    for (const id of batchUlids) {
      expect(id.substring(0, 10)).toBe(firstPrefix);
    }

    // But each random suffix is strictly monotonically increasing
    for (let i = 0; i < BATCH - 1; i++) {
      expect(batchUlids[i] < batchUlids[i + 1]).toBe(true);
    }
  });

  it('should correctly transition timestamp components across different timestamps', () => {
    const timeA = 1600000000000;
    const timeB = 1700000000000;

    const ulidA = generateUlid(timeA);
    const ulidB = generateUlid(timeB);

    expect(ulidA < ulidB).toBe(true);
    expect(ulidA.substring(0, 10)).not.toBe(ulidB.substring(0, 10));
  });
});
