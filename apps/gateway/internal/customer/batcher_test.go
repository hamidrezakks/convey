package customer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type resolverFunc func(context.Context, Scope, []string) (map[string]Recipients, error)

func (f resolverFunc) Resolve(ctx context.Context, s Scope, ids []string) (map[string]Recipients, error) {
	return f(ctx, s, ids)
}
func contacts(ids []string) map[string]Recipients {
	out := make(map[string]Recipients)
	for _, id := range ids {
		out[id] = Recipients{"email": json.RawMessage(`"mock@example.test"`), "phone": json.RawMessage(`"+12025550101"`)}
	}
	return out
}
func closeBatch(t testing.TB, b *Batcher) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := b.Close(ctx); err != nil {
		t.Fatal(err)
	}
}
func runBurst(t testing.TB, b Resolver, n int, scope Scope) {
	t.Helper()
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := range n {
		wg.Go(func() {
			<-start
			out, err := b.Resolve(context.Background(), scope, []string{fmt.Sprint(i)})
			if err != nil || len(out) != 1 {
				t.Errorf("resolve: %v %v", out, err)
			}
		})
	}
	close(start)
	wg.Wait()
}
func TestBatchThresholdAndDedupe(t *testing.T) {
	var calls atomic.Int32
	b := NewBatcher(resolverFunc(func(_ context.Context, _ Scope, ids []string) (map[string]Recipients, error) {
		calls.Add(1)
		if len(ids) != 100 {
			t.Errorf("got %d users", len(ids))
		}
		return contacts(ids), nil
	}), time.Second)
	defer closeBatch(t, b)
	start := time.Now()
	runBurst(t, b, 100, Scope{Team: "orders"})
	if calls.Load() != 1 || time.Since(start) > 900*time.Millisecond {
		t.Fatalf("threshold did not flush: calls=%d elapsed=%s", calls.Load(), time.Since(start))
	}
	// One hundred requests for the same user must also trigger the request threshold.
	calls.Store(0)
	b.resolver = resolverFunc(func(_ context.Context, _ Scope, ids []string) (map[string]Recipients, error) {
		calls.Add(1)
		if len(ids) != 1 {
			t.Errorf("dedupe: %d", len(ids))
		}
		return contacts(ids), nil
	})
	var wg sync.WaitGroup
	for range 100 {
		wg.Go(func() {
			_, err := b.Resolve(context.Background(), Scope{}, []string{"same"})
			if err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	if calls.Load() != 1 {
		t.Fatal(calls.Load())
	}
}
func TestBatchTimerAndScopeIsolation(t *testing.T) {
	var mu sync.Mutex
	seen := map[Scope]int{}
	b := NewBatcher(resolverFunc(func(_ context.Context, s Scope, ids []string) (map[string]Recipients, error) {
		mu.Lock()
		seen[s]++
		mu.Unlock()
		return contacts(ids), nil
	}), BatchWait)
	defer closeBatch(t, b)
	scopes := []Scope{{TenantID: "a", Team: "x"}, {TenantID: "b", Team: "x"}, {TenantID: "a", Team: "y"}, {TenantID: "a", Team: "x", Sandbox: true}}
	var wg sync.WaitGroup
	start := time.Now()
	for _, scope := range scopes {
		wg.Go(func() {
			_, err := b.Resolve(context.Background(), scope, []string{"same"})
			if err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	if time.Since(start) < BatchWait || time.Since(start) > 2*time.Second || len(seen) != 4 {
		t.Fatalf("elapsed=%s scopes=%v", time.Since(start), seen)
	}
}
func TestBatchCancellationAndPartialResults(t *testing.T) {
	b := NewBatcher(resolverFunc(func(_ context.Context, _ Scope, ids []string) (map[string]Recipients, error) {
		out := contacts(ids)
		delete(out, "missing")
		return out, ErrNotFound
	}), 40*time.Millisecond)
	defer closeBatch(t, b)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := b.Resolve(ctx, Scope{}, []string{"cancelled"}); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for _, id := range []string{"good", "missing"} {
		wg.Go(func() {
			out, err := b.Resolve(context.Background(), Scope{}, []string{id})
			if id == "good" && (err != nil || out[id] == nil) {
				t.Errorf("good user poisoned: %v", err)
			}
			if id == "missing" && !errors.Is(err, ErrNotFound) {
				t.Errorf("missing user: %v", err)
			}
		})
	}
	wg.Wait()
	short, stop := context.WithTimeout(context.Background(), 5*time.Millisecond)
	defer stop()
	if _, err := b.Resolve(short, Scope{}, []string{"short"}); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatal(err)
	}
}
func TestBatchChunksAndOwnership(t *testing.T) {
	var calls atomic.Int32
	b := NewBatcher(resolverFunc(func(_ context.Context, _ Scope, ids []string) (map[string]Recipients, error) {
		calls.Add(1)
		if len(ids) > 100 {
			t.Errorf("oversized lookup %d", len(ids))
		}
		return contacts(ids), nil
	}), time.Second)
	defer closeBatch(t, b)
	ids := make([]string, 500)
	for i := range ids {
		ids[i] = fmt.Sprint(i)
	}
	out, err := b.Resolve(context.Background(), Scope{}, ids)
	if err != nil || len(out) != 500 || calls.Load() != 5 {
		t.Fatalf("%d %d %v", len(out), calls.Load(), err)
	}
	// Returned JSON must survive scratch reuse and caller mutation.
	out["0"]["email"][1] = 'X'
	next, err := b.Resolve(context.Background(), Scope{}, ids)
	if err != nil || string(next["0"]["email"]) != `"mock@example.test"` {
		t.Fatal("pooled result aliases a caller")
	}
}
func TestBatchCapacityAndShutdown(t *testing.T) {
	release := make(chan struct{})
	var active, peak atomic.Int32
	b := NewBatcher(resolverFunc(func(_ context.Context, _ Scope, ids []string) (map[string]Recipients, error) {
		n := active.Add(1)
		defer active.Add(-1)
		for old := peak.Load(); n > old; old = peak.Load() {
			if peak.CompareAndSwap(old, n) {
				break
			}
		}
		<-release
		return contacts(ids), nil
	}), time.Second)
	var wg sync.WaitGroup
	for i := range BatchCapacity {
		wg.Go(func() {
			_, err := b.Resolve(context.Background(), Scope{Team: fmt.Sprint(i)}, []string{"a"})
			if err != nil {
				t.Error(err)
			}
		})
	}
	deadline := time.Now().Add(3 * time.Second)
	for len(b.slots) != BatchCapacity && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if len(b.slots) != BatchCapacity {
		close(release)
		closeBatch(t, b)
		wg.Wait()
		t.Fatal("admission did not fill")
	}
	if _, err := b.Resolve(context.Background(), Scope{}, []string{"extra"}); !errors.Is(err, ErrBusy) {
		t.Errorf("overload: %v", err)
	}
	close(release)
	closeBatch(t, b)
	wg.Wait()
	if peak.Load() > BatchWorkers {
		t.Fatal("unbounded workers", peak.Load())
	}
	if _, err := b.Resolve(context.Background(), Scope{}, []string{"closed"}); !errors.Is(err, ErrClosed) {
		t.Fatal(err)
	}
	if len(b.slots) != 0 {
		t.Fatal("admission leaked")
	}
}
func BenchmarkLookupBurst(b *testing.B) {
	for _, batched := range []bool{false, true} {
		b.Run(fmt.Sprintf("batch=%v", batched), func(b *testing.B) {
			var calls atomic.Int64
			raw := resolverFunc(func(_ context.Context, _ Scope, ids []string) (map[string]Recipients, error) {
				calls.Add(1)
				return contacts(ids), nil
			})
			var resolver Resolver = raw
			if batched {
				batch := NewBatcher(raw, BatchWait)
				defer closeBatch(b, batch)
				resolver = batch
			}
			b.ReportAllocs()
			b.ResetTimer()
			for range b.N {
				runBurst(b, resolver, 100, Scope{Team: "orders"})
			}
			b.StopTimer()
			b.ReportMetric(float64(calls.Load())/float64(b.N), "lookups/100requests")
		})
	}
}
