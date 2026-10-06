package customer

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"
)

var ErrBusy = errors.New("customer lookup queue full")
var ErrClosed = errors.New("customer lookup batcher closed")

const BatchRequests = 100
const BatchUsers = 100
const BatchCapacity = 1024
const BatchWorkers = 8
const BatchWait = 300 * time.Millisecond

type result struct {
	recipients map[string]Recipients
	err        error
}
type lookup struct {
	ctx   context.Context
	ids   []string
	reply chan result
}
type batch struct {
	scope    Scope
	requests []*lookup
	users    map[string]struct{}
	timer    *time.Timer
}

// Batcher coalesces lookups within the same verified scope. Admission covers queued
// AND running work, preventing slow dependencies from growing queues without bound.
// It retains no contacts across batches. Call Close after draining the HTTP server.
type Batcher struct {
	resolver Resolver
	wait     time.Duration
	mu       sync.Mutex
	pending  map[Scope]*batch
	closed   bool
	slots    chan struct{}
	jobs     chan *batch
	workers  sync.WaitGroup
	done     chan struct{}
}

func NewBatcher(resolver Resolver, wait time.Duration) *Batcher {
	b := &Batcher{resolver: resolver, wait: wait, pending: make(map[Scope]*batch), slots: make(chan struct{}, BatchCapacity), jobs: make(chan *batch, BatchCapacity), done: make(chan struct{})}
	for range BatchWorkers {
		b.workers.Go(func() {
			for job := range b.jobs {
				b.execute(job)
			}
		})
	}
	return b
}
func (b *Batcher) Resolve(ctx context.Context, scope Scope, ids []string) (map[string]Recipients, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return map[string]Recipients{}, nil
	}
	if len(ids) > 500 {
		return nil, ErrBusy
	}
	select {
	case b.slots <- struct{}{}:
	default:
		return nil, ErrBusy
	}
	r := &lookup{ctx: ctx, ids: append([]string(nil), ids...), reply: make(chan result, 1)}
	b.mu.Lock()
	if b.closed {
		b.mu.Unlock()
		<-b.slots
		return nil, ErrClosed
	}
	group := b.pending[scope]
	if group == nil {
		group = &batch{scope: scope, users: make(map[string]struct{})}
		b.pending[scope] = group
		group.timer = time.AfterFunc(b.wait, func() { b.mu.Lock(); defer b.mu.Unlock(); b.flush(group) })
	}
	group.requests = append(group.requests, r)
	for _, id := range ids {
		group.users[id] = struct{}{}
	}
	if len(group.requests) >= BatchRequests || len(group.users) >= BatchUsers {
		b.flush(group)
	}
	b.mu.Unlock()
	select {
	case answer := <-r.reply:
		return answer.recipients, answer.err
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// Caller holds mu. Every queued batch owns at least one admission slot, so the
// queue cannot fill while this batch is pending; sending never blocks the timer.
func (b *Batcher) flush(group *batch) {
	if b.pending[group.scope] != group {
		return
	}
	delete(b.pending, group.scope)
	group.timer.Stop()
	b.jobs <- group
}

// scratch is only owned by one worker. Clear all reference-bearing storage on
// return; returned recipient maps/JSON are copied and never alias this pool.
type scratch struct {
	ids      []string
	seen     map[string]struct{}
	contacts map[string]Recipients
	failures map[string]error
}

var scratchPool = sync.Pool{New: func() any {
	return &scratch{ids: make([]string, 0, BatchUsers), seen: make(map[string]struct{}), contacts: make(map[string]Recipients), failures: make(map[string]error)}
}}

func (b *Batcher) execute(group *batch) {
	s := scratchPool.Get().(*scratch)
	defer func() {
		large := len(s.ids) > 500
		clear(s.ids)
		s.ids = s.ids[:0]
		clear(s.seen)
		clear(s.contacts)
		clear(s.failures)
		if !large {
			scratchPool.Put(s)
		}
	}()
	deadline := time.Now()
	for _, r := range group.requests {
		if r.ctx.Err() != nil {
			continue
		}
		d := time.Now().Add(15 * time.Second)
		if v, ok := r.ctx.Deadline(); ok && v.Before(d) {
			d = v
		}
		if d.After(deadline) {
			deadline = d
		}
		for _, id := range r.ids {
			if _, ok := s.seen[id]; !ok {
				s.seen[id] = struct{}{}
				s.ids = append(s.ids, id)
			}
		}
	}
	// A shorter-lived caller must not cancel its neighbours' lookup. The shared
	// operation uses the latest live deadline, capped at the gateway's 15 seconds.
	ctx, cancel := context.WithDeadline(context.Background(), deadline)
	defer cancel()
	for start := 0; start < len(s.ids); start += BatchUsers {
		ids := s.ids[start:min(start+BatchUsers, len(s.ids))]
		contacts, err := b.resolver.Resolve(ctx, group.scope, ids)
		for _, id := range ids {
			if err != nil && !errors.Is(err, ErrNotFound) {
				s.failures[id] = err
				continue
			}
			if contact := contacts[id]; contact != nil {
				s.contacts[id] = contact
			} else {
				s.failures[id] = ErrNotFound
			}
		}
	}
	for _, r := range group.requests {
		answer := result{err: r.ctx.Err()}
		if answer.err == nil {
			answer.recipients = make(map[string]Recipients, len(r.ids))
			for _, id := range r.ids {
				if err := s.failures[id]; err != nil {
					answer.err = err
					answer.recipients = nil
					break
				}
				contact := make(Recipients, len(s.contacts[id]))
				for key, value := range s.contacts[id] {
					contact[key] = append(json.RawMessage(nil), value...)
				}
				answer.recipients[id] = contact
			}
		}
		r.reply <- answer
		<-b.slots
	}
}
func (b *Batcher) Close(ctx context.Context) error {
	b.mu.Lock()
	if !b.closed {
		b.closed = true
		for _, group := range b.pending {
			b.flush(group)
		}
		close(b.jobs)
		go func() { b.workers.Wait(); close(b.done) }()
	}
	b.mu.Unlock()
	select {
	case <-b.done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
