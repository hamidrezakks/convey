# HTTP observability

Scrape `/metrics` on the internal server address every 15 seconds. Restrict scraping at the network boundary. These metrics describe HTTP responses, not recipient delivery.

| Panel | PromQL |
| --- | --- |
| Request rate | `sum by (path) (rate(convey_http_requests_total[5m]))` |
| Rejected requests | `sum by (status) (rate(convey_http_requests_total{status=~"401|403|429"}[5m]))` |
| Server errors | `sum by (path) (rate(convey_http_requests_total{status=~"5.."}[5m]))` |
| Response p95 | `histogram_quantile(0.95, sum by (le,path) (rate(convey_http_request_duration_seconds_bucket[5m])))` |

Import `prometheus-rules.yml` as an initial alert configuration and tune thresholds to measured workload. Paths are registered route templates; unmatched requests share `__unmatched__`. Query strings, recipient addresses, and resource IDs are excluded. HTTP methods outside the standard set use `OTHER`.

The other declared counters in `index.ts` are not yet consistently wired to worker transitions. Do not derive delivery success, retry volume, or provider health alerts from their mere presence. Use the operational gauges below for backlog and recent outcomes. Acceptance p95 is not end-to-end delivery p95.

## Operational panels

Database gauges refresh at most every 15 seconds with a two-second SQL statement limit. Use `convey_outbox_due_messages` for backlog, `convey_outbox_oldest_due_seconds` for relay delay, `convey_messages_delivered_last_hour` and `convey_messages_failed_last_hour` for outcomes, and `convey_retry_attempts_last_hour` for retry volume. These are rolling-window gauges: do not apply `rate()` to them. Delivery outcomes refer to messages created in the last hour, not necessarily delivered within that hour. Alert only when `convey_operational_metrics_available == 1`; failed refreshes retain the previous values. Circuit gauges are per process, not a global provider SLA.
