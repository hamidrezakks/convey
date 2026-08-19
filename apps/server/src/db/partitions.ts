import { queryClient } from './index';

/**
 * Ensures PostgreSQL range partitions exist for historical, current, and future months
 * for high-volume tables: messages, message_attempts, message_events, budget_ledger.
 */
export async function ensureMonthlyPartitions(monthsAhead = 6, monthsBehind = 3): Promise<void> {
  const tables = ['messages', 'message_attempts', 'message_events', 'budget_ledger'];
  const now = new Date();

  for (let i = -monthsBehind; i <= monthsAhead; i++) {
    const year = now.getFullYear();
    const month = now.getMonth() + i;

    const startDate = new Date(Date.UTC(year, month, 1));
    const endDate = new Date(Date.UTC(year, month + 1, 1));

    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);

    const partitionSuffix = `${startDate.getUTCFullYear()}_${String(startDate.getUTCMonth() + 1).padStart(2, '0')}`;

    for (const table of tables) {
      const partitionName = `${table}_${partitionSuffix}`;
      const query = `
        CREATE TABLE IF NOT EXISTS ${partitionName}
        PARTITION OF ${table}
        FOR VALUES FROM ('${startStr}') TO ('${endStr}');
      `;

      try {
        await queryClient.unsafe(query);
      } catch (err) {
        console.error(`Error creating partition ${partitionName}:`, err);
      }
    }
  }
}

let partitionLoopTimer: NodeJS.Timeout | null = null;

/**
 * Starts a 24-hour periodic maintenance loop to ensure PostgreSQL monthly partitions exist ahead of time.
 */
export function startPartitionMaintenanceLoop(intervalMs = 24 * 60 * 60 * 1000): void {
  if (partitionLoopTimer) return;
  partitionLoopTimer = setInterval(async () => {
    try {
      await ensureMonthlyPartitions(3);
    } catch (err) {
      console.error('Error during background partition maintenance loop:', err);
    }
  }, intervalMs);
}

export function stopPartitionMaintenanceLoop(): void {
  if (partitionLoopTimer) {
    clearInterval(partitionLoopTimer);
    partitionLoopTimer = null;
  }
}
