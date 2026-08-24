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
  private readonly initialLimit: number;

  constructor(fetcher: PageFetcher<T>, initialLimit = 50) {
    this.fetcher = fetcher;
    this.initialLimit = initialLimit;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let offset = 0;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.fetcher(offset, page);
      for (const item of result.items) {
        yield item;
      }

      if (!result.hasMore || result.items.length === 0) {
        break;
      }

      if (result.nextOffset !== undefined) {
        offset = result.nextOffset;
      } else {
        offset += result.items.length;
      }

      if (result.nextPage !== undefined) {
        page = result.nextPage;
      } else {
        page += 1;
      }

      hasMore = result.hasMore;
    }
  }

  /**
   * Accumulate all paginated items up to an optional maximum count into a standard array.
   */
  async autoPagingToArray(maxItems = Number.POSITIVE_INFINITY): Promise<T[]> {
    const results: T[] = [];
    for await (const item of this) {
      results.push(item);
      if (results.length >= maxItems) {
        break;
      }
    }
    return results;
  }
}
