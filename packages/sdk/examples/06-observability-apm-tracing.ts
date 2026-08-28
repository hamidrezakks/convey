/**
 * @convey/sdk Example 06: End-to-End Observability, APM Waterfalls & Distributed Tracing
 *
 * Demonstrates propagating W3C traceparents across microservices, inspecting provider
 * attempt timelines, and diagnosing latency bottlenecks with the trace span waterfall.
 */

import { Channel, Convey, MessagePriority } from '../src';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY || 'sk_live_sample_key',
  baseUrl: process.env.CONVEY_BASE_URL || 'https://api.convey.dev',
  teamId: 'platform-core',
});

async function main() {
  console.log('--- 1. Send Message with OpenTelemetry / W3C Traceparent Context ---');

  // Existing W3C trace context from upstream HTTP gateway or OpenTelemetry span
  const incomingTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

  const sendResult = await convey.messages.send(
    {
      channel: Channel.EMAIL,
      recipient: 'developer@example.com',
      priority: MessagePriority.HIGH,
      content: {
        subject: 'Observability Test Dispatch',
        body: '<p>Testing distributed trace propagation across services.</p>',
      },
      category: 'OBSERVABILITY',
    },
    { traceparent: incomingTraceparent },
  );

  const messageId = sendResult.publicId;
  console.log(`Accepted Message: ${messageId}`);

  console.log(`\n--- 2. Inspect Chronological Event Timeline for ${messageId} ---`);

  const timeline = await convey.messages.getTimeline(messageId);
  console.log(`Event Timeline for Message ${timeline.messageId}:`);
  for (const event of timeline.timeline) {
    console.log(
      `  - [${event.timestamp}] Status: ${event.status.padEnd(12)} | Provider: ${event.provider || 'router'} | Latency: ${event.latencyMs ?? 0}ms`,
    );
  }

  console.log(`\n--- 3. Query APM Waterfall Trace Spans for ${messageId} ---`);

  const trace = await convey.messages.getTrace(messageId);
  console.log(`APM Trace: ${trace.traceparent}`);
  console.log(`Total Ingestion-to-Delivery Duration: ${trace.totalDurationMs}ms`);
  console.log('Spans:');
  for (const span of trace.spans) {
    const statusIcon = span.status === 'OK' ? '✅' : '❌';
    console.log(
      `  ${statusIcon} [${span.serviceName}] ${span.name} (Duration: ${span.durationMs}ms, Offset: +${span.startTimeMs}ms)`,
    );
  }
}

main().catch(console.error);
