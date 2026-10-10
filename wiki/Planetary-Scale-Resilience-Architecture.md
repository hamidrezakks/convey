# Resilience and operational tools

Convey's current qualification targets a single regional deployment. The historical filename of this page is retained for existing links. It does not imply verified planetary-scale operation, active-active failover, consensus guarantees or a throughput SLA.

## Implemented delivery path

The API accepts messages through a transactional outbox. Workers relay durable records, dispatch channels, call providers and process later receipts. Recovery and retry behavior must account for uncertain provider acceptance: a timeout is not proof that no notification was sent, and retries cannot promise exactly-once delivery across a third-party network.

Use these maintained references:

- [Architecture](../docs/architecture.md) and [queue topology](../docs/queue-topology.md)
- [V1 contract candidate](../docs/operations/v1-contracts.md)
- [Qualification evidence and remaining requirements](../docs/operations/v1-qualification.md)
- [Incident runbook](../docs/operations/incident-runbook.md)
- [Metrics and alerting](../docs/operations/metrics.md)

Experimental resilience utilities and isolated microbenchmarks are not evidence that they are integrated into every production path. Do not use older illustrative latency, capacity, failover or savings figures as deployment guarantees.

## Operational commands

The inspection and report scripts belong to the server workspace. From the repository root:

```sh
bun --filter @convey/server jobs:dump
bun --filter @convey/server benchmark:report
```

The first inspects configured queues and database records. The second generates load and must run only against isolated test infrastructure and appropriately configured mock providers. It is not a read-only health check. Configure the server environment before invoking either command.

Root benchmark scripts include `bun run bench:api`, `bun run bench:engine` and `bun run bench:pipeline`. Read [benchmark methodology](../docs/benchmarks.md) before interpreting results; workloads, machine, concurrency and provider mode matter.

## Gateway batching

The optional Go gateway batches scoped customer lookups, not notification submissions. Its default collection window is 300 ms with 100-request/100-user flush thresholds. A low-traffic request may pay that delay; use `CUSTOMER_BATCH_WAIT` to tune it. The [gateway performance report](../apps/gateway/PERFORMANCE.md) records resource limits, reproducible local measurements and qualification scope.
