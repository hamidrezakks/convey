import { Gauge, type Registry } from 'prom-client';
import { queryClient } from '../db';
import { providerCircuitBreaker } from '../modules/providers/core/circuit-breaker';

export function createOperationalMetrics(registry: Registry) {
  const gauge = (name: string, help: string) => new Gauge({ name: `convey_${name}`, help, registers: [registry] });
  const available = gauge('operational_metrics_available', 'Whether the latest database metrics refresh succeeded');
  const backlog = gauge('outbox_due_messages', 'Outbox records due for relay, including claimed records');
  const age = gauge('outbox_oldest_due_seconds', 'Age since the oldest pending outbox record became due');
  const delivered = gauge(
    'messages_delivered_last_hour',
    'Messages created in the last hour with a successful delivery state',
  );
  const failed = gauge('messages_failed_last_hour', 'Messages created in the last hour with a failed or bounced state');
  const retries = gauge(
    'retry_attempts_last_hour',
    'Provider attempts created in the last hour with attempt number above one',
  );
  const openCircuits = gauge('provider_circuits_open', 'Provider circuits currently open in this process');
  let refreshedAt = 0;
  let pending: Promise<void> | undefined;
  async function collect() {
    openCircuits.set(providerCircuitBreaker.getCounts().open);
    try {
      const rows = await queryClient.begin(async (sql) => {
        await sql`SET LOCAL statement_timeout = '2000ms'`;
        return sql`SELECT
          (SELECT count(*) FROM outbox WHERE state IN ('pending', 'processing') AND available_at <= now()) AS backlog,
          (SELECT coalesce(extract(epoch FROM now() - min(available_at)), 0) FROM outbox WHERE state IN ('pending', 'processing') AND available_at <= now()) AS age,
          (SELECT count(*) FROM messages WHERE created_at >= now() - interval '1 hour' AND state IN ('delivered', 'opened', 'read')) AS delivered,
          (SELECT count(*) FROM messages WHERE created_at >= now() - interval '1 hour' AND state IN ('failed', 'bounced')) AS failed,
          (SELECT count(*) FROM message_attempts WHERE created_at >= now() - interval '1 hour' AND attempt_no > 1) AS retries`;
      });
      const row = rows[0];
      backlog.set(Number(row.backlog));
      age.set(Number(row.age));
      delivered.set(Number(row.delivered));
      failed.set(Number(row.failed));
      retries.set(Number(row.retries));
      available.set(1);
    } catch {
      available.set(0);
    }
    refreshedAt = Date.now();
  }
  return async () => {
    if (pending) return pending;
    if (Date.now() - refreshedAt < 15000) return;
    pending = collect().finally(() => {
      pending = undefined;
    });
    return pending;
  };
}
