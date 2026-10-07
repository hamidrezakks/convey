# Gateway batching and performance

The gateway batches **customer lookups**, then enriches each original notification request and forwards it separately to Convey. Convey still owns notification acceptance, delivery, idempotency and budget accounting. No database changes or shared cache are needed.

## Defaults and resource bounds

- Customer lookup mode defaults to `bulk`: `POST /v1/customers/resolve`.
- Collect requests for up to **300 ms from the first request**, or flush when **100 requests** or **100 unique user IDs** are collected, whichever comes first. Traffic does not restart the timer.
- Batches are isolated by the full verified **tenant + team + sandbox** scope. A user ID in another scope is a separate lookup.
- Deduplicate IDs across those requests. Larger message submissions are split into customer calls containing at most **100 unique IDs** each; all contacts for an original submission must resolve before that submission reaches Convey.
- Admit at most **1,024 outstanding lookup submissions**, including queued and running work. Use **8 batch workers**. Overload or shutdown returns `503 CUSTOMER_BUSY` with `Retry-After: 1` rather than growing an unbounded work queue.
- `CUSTOMER_LOOKUP_MODE=single` uses the reference GET adapter with at most eight concurrent lookups per active batch worker (64 total). It can deduplicate repeated users, but cannot turn a single-only customer API into a native bulk API.
- `CUSTOMER_BATCH_WAIT=25ms` shortens the collection window. `0s` removes intentional waiting while retaining bounded workers; batching efficiency will be lower. Values must be between `0s` and `1s`.

A lone request can wait the full 300 ms before lookup. Worker contention and customer network time are additional, all within the original 15-second request deadline. Set a shorter wait for latency-sensitive notifications. The 100-request threshold is per scope and per gateway process; replicas do not coordinate batches.

## Correctness under concurrency

The batcher stores copied user IDs and request contexts, never a Fiber request context or borrowed body buffer. Cancelled queued callers are skipped. One caller's short deadline does not cancel neighbouring requests; a shared lookup uses the latest live deadline, capped at 15 seconds. Results are copied per caller before pooled scratch storage is cleared.

The customer adapter can return found users together with `ErrNotFound`. In the HTTP bulk contract, return 200 with missing users omitted: only submissions needing a missing user fail with 422. A whole-response 404, unavailable service, malformed record, duplicate record or foreign scope affects every submission depending on that lookup chunk. No automatic splitting/retry storm is attempted on these failures.

Explicit recipient overrides remain supported. Fully specified recipients skip the customer lookup and collection wait. Authentication occurs before batching and is not cached. Notification payloads, caller credentials and idempotency keys stay separate between callers.

During shutdown, the HTTP listener drains before the batcher closes. Closing the batcher flushes pending groups, rejects new work and waits for workers within the shutdown deadline. Cancelled callers can return immediately; already-running Fiber network calls finish or reach their socket deadline. There is no extra goroutine per outbound call to simulate immediate cancellation.

## CPU and memory choices

All production outbound calls—Convey authentication, customer lookup and Convey forwarding—use Fiber's client `DoDeadline` API over fasthttp. The clients are created once, with connection reuse, 128 connections per host per response-limit client, no redirects and a single network attempt. Raw signed callback bodies and paths are preserved.

Three clients enforce response limits during reading: 64 KiB for auth, 4 MiB for customers and 32 MiB for forwarded APIs. Incoming requests remain capped at 4 MiB. These are per-request limits, not a total process memory budget.

Two explicit `sync.Pool` instances reuse outbound request/response objects and batch scratch maps/slices. Body bytes are cleared before reuse. Buffers above 64 KiB are retired before fasthttp reset so they cannot enter its internal body pool. Oversized batch scratch is discarded. Pools contain temporary storage, not a cross-request customer cache; Go may discard pooled objects at any collection.

Per-request structured logging uses debug level, off by default, to avoid synchronous info-log formatting and writes on every request. Bodies, addresses and credentials are never logged.

## Measured results — 2026-10-03

Environment: Apple M5 Max, macOS arm64, Go 1.27.1, default GOMAXPROCS 18. All services ran locally with synthetic data and no vendor calls. These results describe this benchmark, not production throughput or a deployment sizing guarantee.

Three runs, two seconds each; median values:

| Benchmark | Without batching | With batching |
| --- | ---: | ---: |
| Customer HTTP calls per burst of 100 distinct users | 100 | 1 |
| Time per 100-request burst | 1.479 ms | 0.693 ms |
| Allocated bytes per burst | 578,384 | 400,732 |
| Allocations per burst | 8,656 | 3,186 |

This is 99% fewer customer calls, approximately 53% less elapsed time, 31% fewer allocated bytes and 63% fewer allocations. A full burst reaches the threshold, so it does not incur the 300 ms timer wait. Each case uses the same Fiber HTTP adapter and mock endpoint; only batching changes.

| Outbound GET benchmark | net/http comparison | Pooled Fiber |
| --- | ---: | ---: |
| Median time per call | 61.845 µs | 51.901 µs |
| Allocated bytes per call | 5,991 | 2,836 |
| Allocations per call | 68 | 31 |

The net/http comparison drains the response body; Fiber also constructs the response headers used by the gateway. Both reuse connections and include the same local mock server in the process.

A separate fixed-work run executed 1,000 bursts of 100 requests (100,000 requests) in each case:

| Process measurement | Unbatched | Batched |
| --- | ---: | ---: |
| Wall time | 1.78 s | 0.72 s |
| User + system CPU time | 17.09 s | 1.95 s |
| Maximum resident set | 33.08 MiB | 27.39 MiB |

CPU can exceed wall time across cores. This is a single fixed-work sample and includes the mock server and test harness, not just the gateway. CPU and heap profiles were also collected and inspected; they are diagnostic snapshots, not a long-running leak or production-load certification.

## Reproduce

From `apps/gateway`:

```sh
go test -race -count=1 ./...
go vet ./...
go run ./cmd/simulator
go test ./internal/customer -run '^$' -bench BenchmarkHTTPBatching -benchmem -benchtime=2s -count=3
go test ./internal/outbound -run '^$' -bench BenchmarkOutbound -benchmem -benchtime=2s -count=3

go test ./internal/customer -run '^$' -bench BenchmarkHTTPBatching \
  -benchtime=3s -cpuprofile=/tmp/convey-cpu.out \
  -memprofile=/tmp/convey-memory.out -o /tmp/convey-customer.test
go tool pprof -top /tmp/convey-customer.test /tmp/convey-cpu.out
go tool pprof -top -inuse_space /tmp/convey-customer.test /tmp/convey-memory.out

# macOS fixed-work measurements; the anchors exclude the other sub-benchmark.
/usr/bin/time -l /tmp/convey-customer.test -test.run='^$' \
  -test.bench='^BenchmarkHTTPBatching$/^unbatched$' -test.benchtime=1000x -test.benchmem
/usr/bin/time -l /tmp/convey-customer.test -test.run='^$' \
  -test.bench='^BenchmarkHTTPBatching$/^batched$' -test.benchtime=1000x -test.benchmem
```

Validation passed: uncached race tests, vet, configuration/overload checks, transport no-retry/redirect/deadline/body-limit/pool tests, and 56 simulator scenarios. Forty concurrent same-user requests used one customer HTTP call in each lookup mode. Linux Docker repeated all 56 scenarios; the production image passed single/bulk enrichment, rejection, raw callbacks, non-root/read-only operation and SIGTERM checks. See [SIMULATOR.md](SIMULATOR.md#batching-verification-2026-10-03) for the tested image. Hosted CI was not awaited.
