'use client';

import { Activity, Check, ChevronRight, Copy, DollarSign, Flame, Lock, ShieldAlert, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useState } from 'react';
import { copyToClipboard } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface Recipe {
  id: string;
  title: string;
  shortTitle: string;
  category: string;
  icon: React.ElementType;
  color: string;
  badge: string;
  slaBenefit: string;
  description: string;
  languages: {
    ts: string;
    curl: string;
    py: string;
  };
  expectedResponse: {
    status: string;
    latency: string;
    trace: string;
    body: string;
  };
}

const recipes: Recipe[] = [
  {
    id: 'otp-fallback',
    title: '1. High-Security 2FA / OTP with Dynamic Omnichannel Fallback',
    shortTitle: '2FA OTP Fallback',
    category: 'Security & Auth',
    icon: ShieldAlert,
    color: 'sky',
    badge: 'Zero Dropped OTPs',
    slaBenefit: 'p99 < 1.4ms acceptance • Automatic carrier fallback',
    description:
      'Dispatches an authentication code via SMS, and automatically falls back to WhatsApp and Voice if the primary SMS provider encounters carrier rate limits or delivery degradation.',
    languages: {
      ts: `import { ConveyClient, MessagePriority, RoutingStrategy } from '@convey/client';

const convey = new ConveyClient({ apiKey: process.env.CONVEY_API_KEY! });

export async function dispatchTwoFactorOtp(userId: string, phone: string, code: string) {
  return await convey.messages.send({
    channel: 'sms',
    recipient: phone,
    priority: MessagePriority.HIGH,
    content: {
      body: \`Your security verification code is \${code}. Valid for 10 minutes.\`,
    },
    routing: {
      strategy: RoutingStrategy.PRIMARY_FALLBACK,
      fallbackChain: ['twilio', 'vonage', 'infobip'],
      retry: { maxAttempts: 3, backoff: 'FULL_JITTER' },
    },
    idempotencyKey: \`otp_\${userId}_\${Math.floor(Date.now() / 60000)}\`,
  });
}`,
      curl: `curl -X POST https://api.convey.internal/v1/messages/send \\
  -H "Authorization: Bearer cv_live_sec_key_99218" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: otp_usr_9921_178759" \\
  -d '{
    "channel": "sms",
    "recipient": "+14155552671",
    "priority": "HIGH",
    "content": { "body": "Your verification code is 849201. Valid for 10 minutes." },
    "routing": {
      "strategy": "PRIMARY_FALLBACK",
      "fallbackChain": ["twilio", "vonage", "infobip"]
    }
  }'`,
      py: `from convey import ConveyClient, MessagePriority

convey = ConveyClient(api_key="cv_live_sec_key_99218")

async def send_2fa_otp(user_id: str, phone: str, code: str):
    return await convey.messages.send(
        channel="sms",
        recipient=phone,
        priority=MessagePriority.HIGH,
        content={"body": f"Your verification code is {code}."},
        routing={"strategy": "PRIMARY_FALLBACK", "fallback_chain": ["twilio", "vonage"]}
    )`,
    },
    expectedResponse: {
      status: '202 ACCEPTED',
      latency: '1.2ms',
      trace: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      body: '{\n  "publicId": "msg_01JB61Z89F8A3C1E2B4D5E6F77",\n  "status": "ACCEPTED",\n  "channel": "sms",\n  "recipient": "+14155552671"\n}',
    },
  },
  {
    id: 'whatsapp-cost-saver',
    title: '2. WhatsApp 24h Session Cost Autopilot ($0.00 Text Transform)',
    shortTitle: 'WhatsApp Cost Saver',
    category: 'Cost Optimization',
    icon: DollarSign,
    color: 'emerald',
    badge: '40% - 75% Cost Reduction',
    slaBenefit: 'Auto $0.00 session conversion during active 24h window',
    description:
      'Convey checks DragonflyDB for an active 24h user reply session. If valid, expensive Meta marketing templates ($0.05) are transformed into $0.00 plain-text session messages automatically.',
    languages: {
      ts: `import { ConveyClient } from '@convey/client';

const convey = new ConveyClient({ apiKey: process.env.CONVEY_API_KEY! });

export async function sendShippingUpdate(phone: string, orderId: string, url: string) {
  // DragonflyDB session key evaluated: whatsapp:session:<team>:<phone>
  return await convey.messages.send({
    channel: 'whatsapp',
    recipient: phone,
    content: {
      body: \`Your order #\${orderId} is out for delivery! Track live: \${url}\`,
      template: {
        name: 'shipping_update_v2',
        language: 'en_US',
        components: [
          { type: 'body', parameters: [{ type: 'text', text: orderId }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: url }] },
        ],
      },
    },
    metadata: { orderId, costOptimization: 'AUTOPILOT_ENABLED' },
  });
}`,
      curl: `curl -X POST https://api.convey.internal/v1/messages/send \\
  -H "Authorization: Bearer cv_live_sec_key_99218" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "whatsapp",
    "recipient": "+14155552671",
    "content": {
      "body": "Your order #ORD-9912 is out for delivery!",
      "template": { "name": "shipping_update_v2", "language": "en_US" }
    },
    "metadata": { "costOptimization": "AUTOPILOT_ENABLED" }
  }'`,
      py: `from convey import ConveyClient

convey = ConveyClient(api_key="cv_live_sec_key_99218")

async def send_whatsapp_order_update(phone: str, order_id: str):
    return await convey.messages.send(
        channel="whatsapp",
        recipient=phone,
        content={"body": f"Order #{order_id} has shipped!"},
        metadata={"costOptimization": "AUTOPILOT_ENABLED"}
    )`,
    },
    expectedResponse: {
      status: '202 ACCEPTED',
      latency: '0.9ms',
      trace: '00-98dca71822e14ef6a2b84910248c0812-33fa81028ba9012a-01',
      body: '{\n  "publicId": "msg_01JB61ZZ89901AA223344",\n  "status": "ACCEPTED",\n  "appliedCost": "$0.00 (Active Session)",\n  "channel": "whatsapp"\n}',
    },
  },
  {
    id: 'drr-bulk-blast',
    title: '3. Mass Marketing Campaign with Deficit Round Robin (DRR) Pacing',
    shortTitle: 'DRR Bulk Broadcast',
    category: 'High Throughput',
    icon: Flame,
    color: 'amber',
    badge: 'JFI >= 0.95 Fairness',
    slaBenefit: '500-item micro-batches • Zero OTP queue starvation',
    description:
      'Broadcast 100,000+ marketing emails without starving critical transactional OTPs. Deficit Round Robin quantum scheduling prioritizes high-priority traffic.',
    languages: {
      ts: `import { ConveyClient, MessagePriority } from '@convey/client';

const convey = new ConveyClient({ apiKey: process.env.CONVEY_API_KEY! });

export async function broadcastNewsletter(subscribers: string[], campaignId: string) {
  const items = subscribers.map((email, idx) => ({
    recipient: email,
    content: { subject: 'Product Update', body: 'Convey v1.0 is live!' },
    idempotencyKey: \`camp_\${campaignId}_\${idx}\`,
  }));

  // Chunk into 500-message atomic micro-batches for PostgreSQL 18
  for (let i = 0; i < items.length; i += 500) {
    const chunk = items.slice(i, i + 500);
    await convey.messages.sendBulk({
      channel: 'email',
      priority: MessagePriority.LOW, // Low DRR quantum
      messages: chunk,
      metadata: { campaignId },
    });
  }
}`,
      curl: `curl -X POST https://api.convey.internal/v1/messages/bulk \\
  -H "Authorization: Bearer cv_live_sec_key_99218" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "email",
    "priority": "LOW",
    "messages": [
      { "recipient": "sub1@domain.com", "content": { "subject": "Update", "body": "Hello 1" } },
      { "recipient": "sub2@domain.com", "content": { "subject": "Update", "body": "Hello 2" } }
    ]
  }'`,
      py: `from convey import ConveyClient, MessagePriority

convey = ConveyClient(api_key="cv_live_sec_key_99218")

async def send_bulk_newsletter(subscribers: list[str]):
    chunk = [{"recipient": email, "content": {"subject": "News", "body": "Hi"}} for email in subscribers[:500]]
    return await convey.messages.send_bulk(channel="email", priority=MessagePriority.LOW, messages=chunk)`,
    },
    expectedResponse: {
      status: '202 ACCEPTED',
      latency: '4.8ms',
      trace: '00-33fa81028ba9012a98dca71822e14ef6-00f067aa0ba902b7-01',
      body: '{\n  "batchId": "batch_01JB61ZZ89901AA223344",\n  "totalSubmitted": 500,\n  "totalAccepted": 500,\n  "totalRejected": 0\n}',
    },
  },
  {
    id: 'zero-trust-encryption',
    title: '4. Zero-Trust AES-256-GCM Envelope Encryption (HIPAA / GDPR)',
    shortTitle: 'Zero-Trust Encryption',
    category: 'Privacy & Security',
    icon: Lock,
    color: 'purple',
    badge: 'AES-256-GCM Encrypted',
    slaBenefit: '281k encryptions/s • In-memory decryption only',
    description:
      'All recipient handles, message bodies, and sensitive variables are encrypted with unique IVs before storage in PostgreSQL 18. Plaintext exists only during active provider socket transport.',
    languages: {
      ts: `import { ConveyClient } from '@convey/client';

const convey = new ConveyClient({
  apiKey: process.env.CONVEY_API_KEY!,
  encryptionKey: process.env.CONVEY_MASTER_ENCRYPTION_KEY!,
});

export async function sendMedicalPrescriptionNotice(patientPhone: string, rxId: string) {
  return await convey.messages.send({
    channel: 'sms',
    recipient: patientPhone, // Encrypted at rest
    content: {
      body: \`Your prescription #\${rxId} is ready for pickup at Main Pharmacy.\`,
    },
    metadata: { hipaaCompliance: true, encryptionVersion: 'v2' },
  });
}`,
      curl: `curl -X POST https://api.convey.internal/v1/messages/send \\
  -H "Authorization: Bearer cv_live_sec_key_99218" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "sms",
    "recipient": "+14155552671",
    "content": { "body": "Your prescription is ready for pickup." },
    "metadata": { "hipaaCompliance": true }
  }'`,
      py: `from convey import ConveyClient

convey = ConveyClient(
    api_key="cv_live_sec_key_99218",
    encryption_key="master_aes_256_hex_key"
)

async def send_hipaa_notification(phone: str, rx_id: str):
    return await convey.messages.send(
        channel="sms",
        recipient=phone,
        content={"body": f"Prescription #{rx_id} is ready."},
        metadata={"hipaaCompliance": True}
    )`,
    },
    expectedResponse: {
      status: '202 ACCEPTED',
      latency: '1.4ms',
      trace: '00-77a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2-11e2b4d5e6f7a8b9-01',
      body: '{\n  "publicId": "msg_01JB61Z89F8A3C1E2B4D5E6F77",\n  "status": "ACCEPTED",\n  "encryptedAtRest": true,\n  "keyVersion": "v2"\n}',
    },
  },
  {
    id: 'hedged-ops-alert',
    title: '5. Critical Ops Incident Escalation with Speculative Hedging',
    shortTitle: 'Hedged Ops Alerts',
    category: 'Resilience & Ops',
    icon: Zap,
    color: 'rose',
    badge: 'Tail-Latency Drop',
    slaBenefit: 'Speculative race at 200ms • Automatic cancellation',
    description:
      'When an infrastructure alert triggers, Convey speculatively fires a concurrent hedged request to a secondary provider if the primary does not acknowledge within 200ms.',
    languages: {
      ts: `import { ConveyClient, MessagePriority } from '@convey/client';

const convey = new ConveyClient({ apiKey: process.env.CONVEY_API_KEY! });

export async function triggerPagerDutyP1Alert(incidentId: string, title: string) {
  return await convey.messages.send({
    channel: 'chat',
    recipient: 'pagerduty:service_key_prd_991',
    priority: MessagePriority.HIGH,
    content: {
      body: \`🚨 P1 CRITICAL INCIDENT #\${incidentId}: \${title}\`,
    },
    routing: {
      strategy: 'HEDGED_SPECULATIVE',
      hedgedDelayMs: 200, // Speculatively race fallback if primary takes > 200ms
      fallbackChain: ['pagerduty', 'slack_ops', 'twilio_voice'],
    },
    metadata: { incidentId, severity: 'P1' },
  });
}`,
      curl: `curl -X POST https://api.convey.internal/v1/messages/send \\
  -H "Authorization: Bearer cv_live_sec_key_99218" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "chat",
    "recipient": "pagerduty:service_key_prd_991",
    "priority": "HIGH",
    "content": { "body": "🚨 P1 Incident: Database pool saturation" },
    "routing": {
      "strategy": "HEDGED_SPECULATIVE",
      "hedgedDelayMs": 200,
      "fallbackChain": ["pagerduty", "slack_ops", "twilio_voice"]
    }
  }'`,
      py: `from convey import ConveyClient, MessagePriority

convey = ConveyClient(api_key="cv_live_sec_key_99218")

async def send_p1_alert(incident_id: str, desc: str):
    return await convey.messages.send(
        channel="chat",
        recipient="pagerduty:service_key_prd_991",
        priority=MessagePriority.HIGH,
        content={"body": f"🚨 P1: {desc}"},
        routing={"strategy": "HEDGED_SPECULATIVE", "hedged_delay_ms": 200}
    )`,
    },
    expectedResponse: {
      status: '202 ACCEPTED',
      latency: '0.8ms',
      trace: '00-00f067aa0ba902b74bf92f3577b34da6-a3ce929d0e0e4736-01',
      body: '{\n  "publicId": "msg_01JB61Z89F8A3C1E2B4D5E6F77",\n  "status": "ACCEPTED",\n  "strategy": "HEDGED_SPECULATIVE",\n  "hedgedDelayMs": 200\n}',
    },
  },
  {
    id: 'webhook-dlr-ingestion',
    title: '6. Inbound Webhook Delivery Receipt Ingestion (HMAC Verification)',
    shortTitle: 'Webhook DLR Ingestion',
    category: 'Telemetry & Tracking',
    icon: Activity,
    color: 'cyan',
    badge: '52,000 DLR/s Buffer',
    slaBenefit: 'HMAC-SHA256 verified • Micro-batch database commit',
    description:
      'Verify cryptographic signatures for inbound carrier webhooks (SendGrid, Twilio, WhatsApp). Micro-batch pipeline buffers up to 52,000 events/s with zero dropped receipts.',
    languages: {
      ts: `import { ConveyWebhookVerifier } from '@convey/client';

const verifier = new ConveyWebhookVerifier(process.env.CONVEY_WEBHOOK_SECRET!);

export async function handleDeliveryWebhook(req: Request) {
  const signature = req.headers.get('x-convey-signature')!;
  const rawBody = await req.text();

  // 1. Constant-time cryptographic HMAC-SHA256 signature verification
  const isValid = verifier.verify(rawBody, signature);
  if (!isValid) {
    return new Response('Unauthorized Signature', { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  console.log(\`Delivery receipt for \${payload.publicId}: status = \${payload.status}\`);
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}`,
      curl: `curl -X POST http://localhost:3000/v1/webhooks/generic \\
  -H "Content-Type: application/json" \\
  -H "x-convey-signature: sha256=9f8a3c1e2b4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f" \\
  -d '{
    "publicId": "msg_01JB61Z89F8A3C1E2B4D5E6F77",
    "status": "DELIVERED",
    "deliveredAt": "2026-08-24T19:50:01.142Z"
  }'`,
      py: `from convey.webhooks import WebhookVerifier

verifier = WebhookVerifier(secret_key="your_webhook_secret")

def process_webhook(raw_payload: bytes, signature_header: str):
    if not verifier.verify(raw_payload, signature_header):
        raise PermissionError("Invalid Webhook Signature")
    return {"status": "verified"}`,
    },
    expectedResponse: {
      status: '200 OK',
      latency: '0.2ms',
      trace: '00-55a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2-33e2b4d5e6f7a8b9-01',
      body: '{\n  "received": true,\n  "buffered": true,\n  "batchQueue": "flushed_20ms"\n}',
    },
  },
];

export function CodeRecipesSection() {
  const [activeRecipeId, setActiveRecipeId] = useState<string>('otp-fallback');
  const [activeLang, setActiveLang] = useState<'ts' | 'curl' | 'py'>('ts');
  const [copied, setCopied] = useState<boolean>(false);

  const activeRecipe = recipes.find((r) => r.id === activeRecipeId) || recipes[0];

  const handleCopyCode = async () => {
    const code = activeRecipe.languages[activeLang];
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section id="recipes" className="py-20 bg-[#060911] border-t border-slate-800/80 scroll-mt-16 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="primary" size="md">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Staff-Level Architecture Recipes</span>
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            Production-Grade Architectural Recipes
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            Copy-pasteable, battle-tested implementation patterns for high-security 2FA OTP, zero-trust HIPAA
            encryption, WhatsApp cost downgrades, and hedged ops alerts.
          </p>
        </div>

        {/* Recipe Selection Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md max-w-5xl mx-auto">
          {recipes.map((r) => {
            const Icon = r.icon;
            const isSelected = activeRecipeId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveRecipeId(r.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-sky-500/20 text-white border border-sky-500/40 shadow-lg shadow-sky-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                <span>{r.shortTitle}</span>
              </button>
            );
          })}
        </div>

        {/* Recipe Content Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Architectural Description & Response Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 rounded-2xl border border-slate-800 bg-[#090d16] space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <Badge variant="outline" size="sm">
                  {activeRecipe.category}
                </Badge>
                <span className="text-[11px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  {activeRecipe.badge}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white font-display leading-snug">{activeRecipe.title}</h3>

              <p className="text-xs text-slate-300 leading-relaxed font-normal">{activeRecipe.description}</p>

              <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div className="text-xs text-sky-300 font-mono">
                  <span className="font-bold text-white">SLA Guarantee:</span> {activeRecipe.slaBenefit}
                </div>
              </div>

              {/* Simulated Synchronous Response Box */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Synchronous Response:</span>
                  <span className="text-emerald-400 font-bold">{activeRecipe.expectedResponse.status}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800/60 pb-1.5">
                    <span>
                      Latency: <strong className="text-sky-400">{activeRecipe.expectedResponse.latency}</strong>
                    </span>
                    <span className="text-slate-400">Trace: {activeRecipe.expectedResponse.trace.slice(0, 18)}...</span>
                  </div>
                  <pre className="text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
                    {activeRecipe.expectedResponse.body}
                  </pre>
                </div>
              </div>

              <div className="pt-2">
                <Link href={`/docs/examples#${activeRecipe.id}`}>
                  <Button variant="outline" size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                    View Complete Chapter in Docs
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column: Code Viewer with Language Tabs */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#090d16] overflow-hidden shadow-2xl flex flex-col">
            {/* Header Bar with Language Switcher & Copy */}
            <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {(['ts', 'curl', 'py'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveLang(lang)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                      activeLang === lang
                        ? 'bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/40'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {lang === 'ts' ? 'TypeScript SDK' : lang === 'curl' ? 'cURL' : 'Python AsyncIO'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-medium cursor-pointer border border-slate-700/60 active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Body */}
            <div className="p-4 sm:p-6 overflow-x-auto bg-[#070a12] font-mono text-xs text-slate-200 leading-relaxed max-h-[520px]">
              <pre>
                <code>{activeRecipe.languages[activeLang]}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
