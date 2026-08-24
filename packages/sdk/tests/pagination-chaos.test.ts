import { describe, expect, it } from 'bun:test';
import { AutoPaginator, type PageResult } from '../src';

describe('QA Auto-Pagination Streamer & Chaos Fault-Tolerance', () => {
  it('should stream a large multi-page dataset (1,000 items across 50 pages) smoothly', async () => {
    const TOTAL_ITEMS = 1000;
    const PAGE_SIZE = 20;

    const mockFetcher = async (offset: number, _page: number): Promise<PageResult<{ id: number; value: string }>> => {
      const items: { id: number; value: string }[] = [];
      const end = Math.min(offset + PAGE_SIZE, TOTAL_ITEMS);

      for (let i = offset; i < end; i++) {
        items.push({ id: i + 1, value: `item_${i + 1}` });
      }

      return {
        items,
        hasMore: end < TOTAL_ITEMS,
        nextOffset: end,
      };
    };

    const paginator = new AutoPaginator(mockFetcher);
    const collected: number[] = [];

    for await (const item of paginator) {
      collected.push(item.id);
    }

    expect(collected).toHaveLength(TOTAL_ITEMS);
    expect(collected[0]).toBe(1);
    expect(collected[TOTAL_ITEMS - 1]).toBe(TOTAL_ITEMS);
  });

  it('should propagate mid-stream API exceptions and abort iteration immediately', async () => {
    let fetchCount = 0;
    const failingFetcher = async (offset: number): Promise<PageResult<string>> => {
      fetchCount++;
      if (fetchCount === 3) {
        throw new Error('Mid-stream network disconnection at page 3');
      }

      return {
        items: [`item_${offset + 1}`, `item_${offset + 2}`],
        hasMore: true,
        nextOffset: offset + 2,
      };
    };

    const paginator = new AutoPaginator(failingFetcher);
    const collected: string[] = [];

    let caughtError: unknown;
    try {
      for await (const item of paginator) {
        collected.push(item);
      }
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect((caughtError as Error).message).toContain('Mid-stream network disconnection');
    // Items collected before page 3 failure were yielded
    expect(collected).toHaveLength(4);
    expect(fetchCount).toBe(3);
  });

  it('should respect exact max limits with autoPagingToArray boundaries', async () => {
    const infiniteFetcher = async (offset: number): Promise<PageResult<number>> => {
      return {
        items: [offset + 1, offset + 2, offset + 3, offset + 4, offset + 5],
        hasMore: true,
        nextOffset: offset + 5,
      };
    };

    const paginator = new AutoPaginator(infiniteFetcher);

    // Limit 0 returns empty array
    const limitZero = await paginator.autoPagingToArray(0);
    expect(limitZero).toEqual([]);

    // Limit 1 returns exactly 1 item
    const limitOne = await paginator.autoPagingToArray(1);
    expect(limitOne).toEqual([1]);

    // Limit 7 cuts off mid-second-page (5 + 2)
    const limitSeven = await paginator.autoPagingToArray(7);
    expect(limitSeven).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('should terminate cleanly when hasMore is true but returned items array is empty', async () => {
    const buggyFetcher = async (): Promise<PageResult<string>> => {
      return {
        items: [],
        hasMore: true, // Backend anomaly: reports hasMore true but 0 items returned
      };
    };

    const paginator = new AutoPaginator(buggyFetcher);
    const collected: string[] = [];

    for await (const item of paginator) {
      collected.push(item);
    }

    // Should terminate gracefully without infinite looping
    expect(collected).toHaveLength(0);
  });

  it('should allow early break from for-await-of loop without hanging resources', async () => {
    let callCount = 0;
    const fetcher = async (offset: number): Promise<PageResult<number>> => {
      callCount++;
      return {
        items: [offset + 1, offset + 2],
        hasMore: true,
        nextOffset: offset + 2,
      };
    };

    const paginator = new AutoPaginator(fetcher);
    let target = 0;

    for await (const item of paginator) {
      if (item === 3) {
        target = item;
        break; // Early consumer exit
      }
    }

    expect(target).toBe(3);
    // Only 2 pages fetched before break
    expect(callCount).toBe(2);
  });
});
