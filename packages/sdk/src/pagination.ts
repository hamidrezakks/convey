/**
 * @convey/sdk - Auto-Pagination Async Iterator
 * Streams records across multi-page API responses effortlessly using `for await...of`
 * with minimal memory consumption.
 */

export interface PageResult<T> {
  items: T[];
  hasMore: boolean;
  nextOffset?: number;
  nextPage?: number;
}

export type PageFetcher<T> = (offset: number, page: number) => Promise<PageResult<T>>;

export class AutoPaginator<T> implements AsyncIterable<T> {
  private readonly fetcher: PageFetcher<T>;
  readonly pageSize: number;

  constructor(fetcher: PageFetcher<T>, pageSize = 50) {
    this.fetcher = fetcher;
    this.pageSize = pageSize;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let offset = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const pageResult = await this.fetcher(offset, page);
      const items = pageResult.items || [];

      for (const item of items) {
        yield item;
      }

      if (pageResult.hasMore && items.length > 0) {
        offset = pageResult.nextOffset ?? offset + items.length;
        page = pageResult.nextPage ?? page + 1;
      } else {
        hasMore = false;
      }
    }
  }

  /**
   * Drain the iterator into a concrete in-memory array up to an optional maximum limit.
   * Useful when eager loading is required while safeguarding against OOM.
   */
  async autoPagingToArray(max?: number): Promise<T[]> {
    const results: T[] = [];
    const limit = typeof max === 'number' && max > 0 ? max : Number.POSITIVE_INFINITY;

    for await (const item of this) {
      results.push(item);
      if (results.length >= limit) {
        break;
      }
    }

    return results;
  }
}
