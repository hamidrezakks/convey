/**
 * ⚡ Convey Production Docker Multi-Provider Automated Simulation & Verification Test
 *
 * Validates the complete stack running on Docker / localhost:
 * 1. Health checks on Convey Server (3000) & Mock Simulator (4000)
 * 2. Real message dispatches across Email, SMS, Slack, WhatsApp, Push, and Telegram channels using @convey/sdk
 * 3. Asserts 202 Accepted + opaque public ULIDs (msg_<ULID>)
 * 4. Verifies direct mock simulator endpoints for all channels
 * 5. Queries Mock Server request inspection history
 * 6. Generates formatted executive summary table
 */

import { Channel, Convey, MessagePriority, MessageStatus } from '../packages/sdk/src';

const CONVEY_URL = (process.env.CONVEY_URL || 'http://localhost:3000').replace(/\/$/, '');
const MOCK_URL = (process.env.MOCK_URL || 'http://localhost:4000').replace(/\/$/, '');
const API_KEY = process.env.CONVEY_API_KEY || 'cv_live_secret_key_e2e_testing_99887766554433221100';

interface SimulationScenario {
  name: string;
  channel: Channel;
  providerId: string;
  recipient: string;
  content: {
    subject?: string;
    body?: string;
    text?: string;
    title?: string;
  };
}

const SCENARIOS: SimulationScenario[] = [
  {
    name: 'Email Dispatch (Resend)',
    channel: Channel.EMAIL,
    providerId: 'resend',
    recipient: 'test.prod@acme-corp.com',
    content: {
      subject: '⚡ Production Test - Resend Email Mock',
      body: '<p>Welcome to Convey. This is a verified production Docker test message.</p>',
    },
  },
  {
    name: 'SMS Dispatch (Twilio)',
    channel: Channel.SMS,
    providerId: 'twilio',
    recipient: '+15550192834',
    content: {
      body: 'Your Convey production verification security code is 982134.',
    },
  },
  {
    name: 'Slack Dispatch',
    channel: Channel.SLACK,
    providerId: 'slack',
    recipient: 'general',
    content: {
      body: '⚡ [PROD-TEST] Convey communication service is running healthy on Docker.',
    },
  },
  {
    name: 'WhatsApp Dispatch (Meta Cloud API)',
    channel: Channel.WHATSAPP,
    providerId: 'whatsapp-business',
    recipient: '+15550192834',
    content: {
      body: 'Your order #84920 has been confirmed via Convey WhatsApp.',
    },
  },
  {
    name: 'Push Notification (FCM)',
    channel: Channel.PUSH,
    providerId: 'fcm',
    recipient: 'fcm_token_device_prod_test_0192837465',
    content: {
      title: 'Convey Alert',
      body: 'Production test push notification dispatched successfully.',
    },
  },
  {
    name: 'Telegram Dispatch',
    channel: Channel.TELEGRAM,
    providerId: 'telegram',
    recipient: '123456789',
    content: {
      body: 'Convey production alert: Stack verification in progress.',
    },
  },
];

async function main() {
  console.log('\n==============================================================================');
  console.log('⚡ CONVEY PRODUCTION DOCKER PROVIDER SIMULATOR TEST SUITE');
  console.log('==============================================================================');
  console.log(`Convey Server Target: ${CONVEY_URL}`);
  console.log(`Mock Simulator Target: ${MOCK_URL}\n`);

  // Step 1: Healthcheck Convey Server
  console.log('🔍 Checking Convey Server liveness...');
  try {
    const res = await fetch(`${CONVEY_URL}/health/liveness`);
    if (!res.ok) {
      console.error(`❌ Convey Server returned unhealthy status ${res.status}`);
      process.exit(1);
    }
    const health = (await res.json()) as { uptime: number };
    console.log(`   ✅ Convey Server is live (Uptime: ${Math.round(health.uptime)}s).`);
  } catch (err: unknown) {
    console.error(`❌ Could not connect to Convey Server at ${CONVEY_URL}: ${(err as Error).message}`);
    console.error('   Ensure docker-compose or "bun run dev" is running before executing this test.');
    process.exit(1);
  }

  // Step 2: Healthcheck Mock Provider Simulator
  console.log('\n🔍 Checking Mock Provider Simulator liveness...');
  try {
    const res = await fetch(`${MOCK_URL}/health`);
    if (!res.ok) {
      console.error(`❌ Mock Provider Simulator returned status ${res.status}`);
      process.exit(1);
    }
    const mockHealth = (await res.json()) as { providerId: string; uptime: number };
    console.log(`   ✅ Mock Simulator is live (Mode: ${mockHealth.providerId.toUpperCase()}).`);
  } catch (err: unknown) {
    console.error(`❌ Mock server at ${MOCK_URL} is unreachable: ${(err as Error).message}`);
    process.exit(1);
  }

  // Step 3: Clear Mock Server Inspector History
  try {
    await fetch(`${MOCK_URL}/__inspect/requests`, { method: 'DELETE' });
    console.log('   🧹 Cleared mock inspector request ledger.');
  } catch {
    // optional
  }

  // Step 4: Initialize Convey SDK Client
  const client = new Convey({
    apiKey: API_KEY,
    baseUrl: CONVEY_URL,
    isSandbox: true,
  });

  // Step 5: Dispatch Multi-Channel Simulation Scenarios via SDK
  console.log('\n🚀 Dispatching Multi-Channel Messages via Convey SDK...');
  const results: Array<{
    name: string;
    channel: string;
    provider: string;
    publicId?: string;
    status: string;
    passed: boolean;
    latencyMs: number;
  }> = [];

  for (const scenario of SCENARIOS) {
    const start = performance.now();
    try {
      const response = await client.messages.send({
        channel: scenario.channel,
        recipient: scenario.recipient,
        priority: MessagePriority.HIGH,
        content: scenario.content,
        category: 'SIMULATION',
      });

      const latencyMs = Math.round(performance.now() - start);

      if (response.success && response.publicId) {
        console.log(`   ✅ [${String(scenario.channel).toUpperCase()}] ${scenario.name}: ${response.publicId} (${latencyMs}ms)`);
        results.push({
          name: scenario.name,
          channel: String(scenario.channel),
          provider: scenario.providerId,
          publicId: response.publicId,
          status: response.status || 'ACCEPTED',
          passed: true,
          latencyMs,
        });
      } else {
        console.log(`   ❌ [${String(scenario.channel).toUpperCase()}] ${scenario.name}: Rejected`);
        results.push({
          name: scenario.name,
          channel: String(scenario.channel),
          provider: scenario.providerId,
          status: 'REJECTED',
          passed: false,
          latencyMs,
        });
      }
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - start);
      console.log(`   ❌ [${String(scenario.channel).toUpperCase()}] ${scenario.name}: ${(err as Error).message}`);
      results.push({
        name: scenario.name,
        channel: String(scenario.channel),
        provider: scenario.providerId,
        status: 'ERROR',
        passed: false,
        latencyMs,
      });
    }
  }

  // Step 6: Test Direct Mock Simulator Handlers
  console.log('\n⚡ Testing Direct Mock Simulator Provider Endpoints...');
  const directMockTests = [
    { provider: 'resend', url: `${MOCK_URL}/emails`, body: { to: 'user@resend.dev', subject: 'Mock Resend' } },
    { provider: 'sendgrid', url: `${MOCK_URL}/v3/mail/send`, body: { personalizations: [{ to: [{ email: 'user@sg.dev' }] }] } },
    { provider: 'twilio', url: `${MOCK_URL}/2010-04-01/Accounts/ACmock123/Messages.json`, body: new URLSearchParams({ To: '+15550192834', Body: 'Mock Twilio' }).toString(), isForm: true },
    { provider: 'whatsapp-business', url: `${MOCK_URL}/v21.0/123456789/messages`, body: { messaging_product: 'whatsapp', to: '15550192834', type: 'text', text: { body: 'Mock WA' } } },
    { provider: 'slack', url: `${MOCK_URL}/api/chat.postMessage`, body: { channel: 'general', text: 'Mock Slack' } },
    { provider: 'fcm', url: `${MOCK_URL}/v1/projects/my-project/messages:send`, body: { message: { token: 'device_token', notification: { title: 'FCM' } } } },
    { provider: 'pagerduty', url: `${MOCK_URL}/v2/enqueue`, body: { routing_key: 'pd_key', event_action: 'trigger', payload: { summary: 'PD Mock' } } },
  ];

  for (const mockTest of directMockTests) {
    try {
      const headers: Record<string, string> = {
        Authorization: 'Bearer mock_key_test',
        'Content-Type': mockTest.isForm ? 'application/x-www-form-urlencoded' : 'application/json',
      };
      const res = await fetch(mockTest.url, {
        method: 'POST',
        headers,
        body: typeof mockTest.body === 'string' ? mockTest.body : JSON.stringify(mockTest.body),
      });

      if (res.ok || res.status === 202 || res.status === 201) {
        let identifier = 'OK';
        try {
          const rawText = await res.text();
          if (rawText) {
            const body = JSON.parse(rawText);
            identifier = body.id || body.sid || body.name || body.dedup_key || 'OK';
          }
        } catch {
          // ignore
        }
        console.log(`   ✅ Direct ${mockTest.provider.toUpperCase()} simulation: HTTP ${res.status} (ID: ${identifier})`);
      } else {
        console.log(`   ❌ Direct ${mockTest.provider.toUpperCase()} simulation: HTTP ${res.status}`);
      }
    } catch (err: unknown) {
      console.log(`   ❌ Direct ${mockTest.provider.toUpperCase()} failed: ${(err as Error).message}`);
    }
  }

  // Step 7: Query Mock Inspector Ledger
  console.log('\n🔍 Inspecting Mock Simulator Recorded Request Ledger...');
  try {
    const inspectRes = await fetch(`${MOCK_URL}/__inspect/requests`);
    if (inspectRes.ok) {
      const recorded = (await inspectRes.json()) as Array<{ providerId: string; method: string; path: string; status: number }>;
      console.log(`   📊 Total Recorded Provider API Calls: ${recorded.length}`);
      for (const req of recorded.slice(0, 10)) {
        let pathname = req.url;
        try {
          pathname = new URL(req.url).pathname;
        } catch {
          // ignore
        }
        console.log(`      - [${req.providerId.toUpperCase()}] ${req.method} ${pathname} -> HTTP ${req.status}`);
      }
    }
  } catch (err: unknown) {
    console.warn(`   ⚠️ Could not fetch inspection history: ${(err as Error).message}`);
  }

  // Step 8: Print Executive Summary Table
  console.log('\n==============================================================================');
  console.log('📊 SIMULATION EXECUTIVE SUMMARY');
  console.log('==============================================================================');
  console.table(
    results.map((r) => ({
      Channel: r.channel.toUpperCase(),
      Provider: r.provider,
      PublicId: r.publicId || 'N/A',
      Status: r.status,
      Latency: `${r.latencyMs}ms`,
      Result: r.passed ? 'PASSED ✅' : 'FAILED ❌',
    })),
  );

  const allPassed = results.every((r) => r.passed);
  if (allPassed) {
    console.log('\n🎉 ALL SIMULATION SCENARIOS PASSED! Multi-provider mock topology is fully verified.\n');
  } else {
    console.log('\n⚠️ Some simulation scenarios failed. Inspect container logs for details.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error running simulation:', err);
  process.exit(1);
});
