/**
 * @convey/sdk Example 07: Reporting Analytics, Live Telemetry & Admin Controls
 *
 * Demonstrates querying delivery throughput, cost analytics, live telemetry queues,
 * dynamically overriding circuit breaker states, and triggering provider canary health checks.
 */

import { CircuitState, Convey } from '../src';

const convey = new Convey({
  apiKey: process.env.CONVEY_ADMIN_KEY || 'sk_live_admin_master_key',
  baseUrl: process.env.CONVEY_BASE_URL || 'https://api.convey.dev',
});

async function main() {
  console.log('--- 1. Query Real-Time Platform Live Telemetry ---');

  const telemetry = await convey.admin.getLiveTelemetry();
  console.log(`Global Throughput: ${telemetry.throughputRps} msgs/sec`);
  console.log(`Outbox Relay Health: Relay Depth = ${telemetry.queues.outboxRelayDepth}`);
  console.log(`Message Dispatch Depth: ${telemetry.queues.messageDispatchDepth}`);
  console.log(
    `Runtime Guard: Heap ${telemetry.runtimeGuard.v8HeapUsedMb}MB / ${telemetry.runtimeGuard.v8HeapTotalMb}MB (Event Loop Lag: ${telemetry.runtimeGuard.eventLoopLagMs}ms)`,
  );

  console.log('\n--- 2. Team & Campaign Delivery Analytics ---');

  const overview = await convey.reports.getOverview({
    teamId: 'marketing',
  });

  console.log(`Summary for Team 'marketing':`);
  console.log(`  - Total Ingested:   ${overview.summary.totalSent}`);
  console.log(`  - Delivered:        ${overview.summary.totalDelivered} (${overview.summary.deliveryRatePercent}%)`);
  console.log(`  - Failed:           ${overview.summary.totalFailed}`);
  console.log(`  - Total Cost (USD): $${overview.summary.totalCostUsd.toFixed(4)}`);

  console.log('\n--- 3. Provider Health & Circuit Breaker Overrides ---');

  const providers = await convey.admin.listProviders();
  console.log(`Configured Providers (${providers.length}):`);
  for (const p of providers) {
    const circuitBadge =
      p.state === CircuitState.CLOSED ? '🟢 CLOSED' : p.state === CircuitState.HALF_OPEN ? '🟡 HALF_OPEN' : '🔴 OPEN';
    console.log(
      `  - Provider [${p.providerId}]: Channel=${p.channel}, Circuit=${circuitBadge}, Latency=${p.emaLatencyMs}ms`,
    );
  }

  // Manually trip circuit on provider during emergency maintenance
  const tripResult = await convey.admin.setCircuitState('resend', 'FORCE_OPEN');
  console.log(`Manually Tripped Circuit for 'resend':`, tripResult);

  // Trigger canary synthetic test on provider
  const canary = await convey.admin.triggerCanary('resend');
  console.log(`Executed synthetic canary test for resend: Healthy=${canary.healthy}, Latency=${canary.latencyMs}ms`);
}

main().catch(console.error);
