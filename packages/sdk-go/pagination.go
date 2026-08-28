package convey

import "context"

// PageFetcher is a callback function that retrieves a single page of items.
// Returns items, hasMore flag, and error.
type PageFetcher[T any] func(ctx context.Context, offset int, page int) (items []T, hasMore bool, err error)

// AutoPaginator provides streaming iteration over paginated API resources.
type AutoPaginator[T any] struct {
	fetcher     PageFetcher[T]
	limit       int
	offset      int
	page        int
	buffer      []T
	bufferIndex int
	hasMore     bool
	started     bool
}

// NewAutoPaginator creates an AutoPaginator for type T.
func NewAutoPaginator[T any](fetcher PageFetcher[T], limit int) *AutoPaginator[T] {
	if limit <= 0 {
		limit = 50
	}
	return &AutoPaginator[T]{
		fetcher: fetcher,
		limit:   limit,
		offset:  0,
		page:    1,
		hasMore: true,
	}
}

// Next returns the next item in the sequence. If the end is reached, returns nil, nil.
func (p *AutoPaginator[T]) Next(ctx context.Context) (*T, error) {
	if p.bufferIndex < len(p.buffer) {
		item := p.buffer[p.bufferIndex]
		p.bufferIndex++
		return &item, nil
	}

	if !p.hasMore && p.started {
		return nil, nil
	}

	p.started = true
	items, hasMore, err := p.fetcher(ctx, p.offset, p.page)
	if err != nil {
		return nil, err
	}

	p.buffer = items
	p.bufferIndex = 0
	p.hasMore = hasMore
	p.offset += len(items)
	p.page++

	if len(p.buffer) == 0 {
		return nil, nil
	}

	item := p.buffer[p.bufferIndex]
	p.bufferIndex++
	return &item, nil
}

// All fetches all remaining items into a single slice.
func (p *AutoPaginator[T]) All(ctx context.Context) ([]T, error) {
	var result []T
	for {
		item, err := p.Next(ctx)
		if err != nil {
			return nil, err
		}
		if item == nil {
			break
		}
		result = append(result, *item)
	}
	return result, nil
}

// Take fetches up to n items into a slice.
func (p *AutoPaginator[T]) Take(ctx context.Context, n int) ([]T, error) {
	var result []T
	for len(result) < n {
		item, err := p.Next(ctx)
		if err != nil {
			return nil, err
		}
		if item == nil {
			break
		}
		result = append(result, *item)
	}
	return result, nil
}
