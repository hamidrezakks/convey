import { describe, expect, it } from 'bun:test';
import { AutoPaginator } from '../src';

describe('AutoPaginator Async Iterator', () => {
  it('should stream all items across multiple pages with for await...of', async () => {
    const totalItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const pageSize = 3;

    const fetcher = async (offset: number) => {
      const slice = totalItems.slice(offset, offset + pageSize);
      return {
        items: slice,
        hasMore: offset + slice.length < totalItems.length,
        nextOffset: offset + slice.length,
      };
    };

    const paginator = new AutoPaginator<number>(fetcher, pageSize);
    const collected: number[] = [];

    for await (const item of paginator) {
      collected.push(item);
    }

    expect(collected).toEqual(totalItems);
  });

  it('should support autoPagingToArray with max limit constraint', async () => {
    const totalItems = Array.from({ length: 100 }, (_, i) => i + 1);
    const fetcher = async (offset: number) => {
      const slice = totalItems.slice(offset, offset + 10);
      return {
        items: slice,
        hasMore: offset + slice.length < totalItems.length,
      };
    };

    const paginator = new AutoPaginator<number>(fetcher, 10);
    const first25 = await paginator.autoPagingToArray(25);

    expect(first25.length).toBe(25);
    expect(first25[0]).toBe(1);
    expect(first25[24]).toBe(25);
  });

  it('should terminate immediately when initial page is empty', async () => {
    const fetcher = async () => {
      return {
        items: [],
        hasMore: false,
      };
    };

    const paginator = new AutoPaginator<string>(fetcher);
    const result = await paginator.autoPagingToArray();
    expect(result).toEqual([]);
  });
});
