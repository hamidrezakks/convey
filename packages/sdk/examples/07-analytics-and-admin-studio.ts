/**
 * @convey/sdk Example 07: Reporting Analytics, Live Telemetry & Admin Controls
 *
 * Demonstrates querying delivery throughput, cost analytics, live telemetry queues,
 * dynamically overriding circuit breaker states, and triggering provider canary health checks.
 */

import { Convey } from '../src';

const convey = new Convey({
  apiKey: process.env.CONVEY_ADMIN_KEY || 'sk_live_admin_master_key',
});

async function main() {
  console.log('--- 1. Query Real-Time Platform Live Telemetry ---');

  const telemetry = await convey.admin.getLiveTelemetry();
  console.log(`Global Throughput: ${telemetry.throughputRps} msgs/sec`);
  console.log(`Outbox Relay Health: Active Outbox Backlog = ${telemetry.queues.outboxBacklog}`);
  console.log(`Active Provider Queues:`);
  for (const [qName, stats] of Object.entries(telemetry.queues.providerQueues)) {
    console.log(`  - Queue [${qName}]: Waiting=${stats.waiting}, Active=${stats.active}, Failed=${stats.failed}`);
  }
  console.log(
    `Runtime Guard: Heap ${telemetry.runtimeGuard.heapUsedMb}MB / ${telemetry.runtimeGuard.heapTotalMb}MB (Event Loop Lag: ${telemetry.runtimeGuard.eventLoopLagMs}ms)`,
  );

  console.log('\n--- 2. Team & Campaign Delivery Analytics ---');

  const overview = await convey.reports.getOverview({
    range: '7d',
    team: 'marketing',
  });

  console.log(`7-Day Summary for Team 'marketing':`);
  console.log(`  - Total Ingested:   ${overview.summary.totalSent}`);
  console.log(`  - Delivered:        ${overview.summary.totalDelivered} (${overview.summary.deliveryRate})`);
  console.log(`  - Hard Bounces:     ${overview.summary.totalBounced}`);
  console.log(`  - Total Cost (USD): $${overview.summary.totalCostUsd.toFixed(4)}`);
  console.log(`  - Avg Latency:      ${overview.summary.avgLatencyMs}ms`);

  console.log('\n--- 3. Provider Health & Circuit Breaker Overrides ---');

  const providers = await convey.admin.listProviders();
  console.log(`Configured Providers (${providers.providers.length}):`);
  for (const p of providers.providers) {
    const circuitBadge =
      p.circuitState === 'CLOSED' ? '🟢 CLOSED' : p.circuitState === 'HALF_OPEN' ? '🟡 HALF_OPEN' : '🔴 OPEN';
    console.log(`  - Provider [${p.id}]: Channel=${p.channel}, Circuit=${circuitBadge}, Latency=${p.latencyP95Ms}ms`);
  }

  // Manually trip circuit on provider during emergency maintenance
  const tripResult = await convey.admin.setCircuitState('resend', 'OPEN');
  console.log(`Manually Tripped Circuit for 'resend':`, tripResult);

  // Trigger canary synthetic test across all providers
  const canary = await convey.admin.triggerCanary();
  console.log(`Executed synthetic canary test: ${canary.status} across ${canary.testedProviders.length} providers.`);
}

main().catch(console.error);
