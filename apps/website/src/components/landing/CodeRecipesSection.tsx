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
    title: '1. Idempotent OTP Acceptance',
    shortTitle: 'OTP Acceptance',
    category: 'API Example',
    icon: ShieldAlert,
    color: 'sky',
    badge: 'Pre-release contract',
    slaBenefit: 'Reusing the key requires the same payload within retention.',
    description:
      'Submit one critical SMS request with a stable key for this challenge. Configure provider fallback on the server; acceptance does not establish delivery.',
    languages: {
      ts: `import { Convey } from '@convey/sdk';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
  baseUrl: 'http://localhost:3000',
  teamId: 'orders', // Must match the authenticated key
});

const response = await convey.messages.send({
  "channel": "SMS",
  "recipient": "+12025550123",
  "priority": "CRITICAL",
  "category": "SECURITY",
  "content": {
    "body": "Your verification code is 849201."
  },
  "idempotencyKey": "otp-challenge-482"
});
console.log(response.messageId, response.state);`,
      curl: `curl -X POST http://localhost:3000/v1/messages \\
  -H "Authorization: Bearer $CONVEY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "idempotencyKey": "otp-challenge-482",
  "userId": "customer-482",
  "team": "orders",
  "category": "SECURITY",
  "country": "US",
  "priority": "critical",
  "recipients": {
    "phone": "+12025550123"
  },
  "channels": [
    {
      "channel": "sms",
      "content": {
        "text": "Your verification code is 849201."
      }
    }
  ]
}'`,
      py: `import os
from convey import Convey

client = Convey(
    api_key=os.environ["CONVEY_API_KEY"],
    base_url="http://localhost:3000",
    team_id="orders",
)

response = client.messages.send(
    channel='SMS',
    recipient='+12025550123',
    priority='CRITICAL',
    category='SECURITY',
    content={'body': 'Your verification code is 849201.'},
    idempotency_key='otp-challenge-482',
)
print(response.message_id, response.state)`,
    },
    expectedResponse: {
      status: '202 ACCEPTED',
      latency: 'Variable',
      trace: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      body: '{\n  "messageId": "msg_01ARZ3NDEKTSV4RRFFQ69G5FAV",\n  "state": "accepted",\n  "createdAt": "2026-10-10T09:00:00.000Z"\n}',
    },
  },
  {
    id: 'whatsapp-cost-saver',
    title: '2. WhatsApp Template Submission',
    shortTitle: 'WhatsApp Template',
    category: 'API Example',
    icon: DollarSign,
    color: 'emerald',
    badge: 'Pre-release contract',
    slaBenefit: 'Provider eligibility and actual fees require separate verification.',
    description:
      'Submit a template for a configured WhatsApp provider. Optional session conversion needs enabled provider configuration, a tracked reply, and available template body text.',
    languages: {
      ts: `import { Convey } from '@convey/sdk';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
  baseUrl: 'http://localhost:3000',
  teamId: 'orders', // Must match the authenticated key
});

const response = await convey.messages.send({
  "channel": "WHATSAPP",
  "recipient": "+12025550123",
  "content": {
    "templateId": "shipping_update_v2",
    "variables": {
      "orderId": "482"
    }
  },
  "idempotencyKey": "shipping-482"
});
console.log(response.messageId, response.state);`,
      curl: `curl -X POST http://localhost:3000/v1/messages \\
  -H "Authorization: Bearer $CONVEY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "idempotencyKey": "shipping-482",
  "userId": "customer-482",
  "team": "orders",
  "category": "TRANSACTIONAL",
  "country": "US",
  "priority": "transactional",
  "recipients": {
    "whatsapp": "+12025550123"
  },
  "channels": [
    {
      "channel": "whatsapp",
      "content": {
        "template": "shipping_update_v2",
        "variables": {
          "orderId": "482"
        }
      }
    }
  ]
}'`,
      py: `import os
from convey import Convey

client = Convey(
    api_key=os.environ["CONVEY_API_KEY"],
    base_url="http://localhost:3000",
    team_id="orders",
)

response = client.messages.send(
    channel='WHATSAPP',
    recipient='+12025550123',
    content={'templateId': 'shipping_update_v2', 'variables': {'orderId': '482'}},
    idempotency_key='shipping-482',
)
print(response.message_id, response.state)`,
    },
    expectedResponse: {
      status: '202 ACCEPTED',
      latency: 'Variable',
      trace: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      body: '{\n  "messageId": "msg_01ARZ3NDEKTSV4RRFFQ69G5FAV",\n  "state": "accepted",\n  "createdAt": "2026-10-10T09:00:00.000Z"\n}',
    },
  },
  {
    id: 'drr-bulk-broadcast',
    title: '3. Bulk Email Acceptance',
    shortTitle: 'Bulk Email',
    category: 'API Example',
    icon: Flame,
    color: 'amber',
    badge: 'Pre-release contract',
    slaBenefit: 'Bulk responses contain total and items; each item is an acceptance result.',
    description:
      'Submit up to 500 message requests per bulk call. Every item has its own channel content, recipients, and idempotency key. Queue processing and provider delivery happen later.',
    languages: {
      ts: `import { Convey } from '@convey/sdk';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
  baseUrl: 'http://localhost:3000',
  teamId: 'orders', // Must match the authenticated key
});

const response = await convey.messages.sendBulk([
  {
    "channel": "EMAIL",
    "recipient": "one@example.test",
    "priority": "LOW",
    "content": {
      "subject": "Product Update",
      "body": "Here is our latest update."
    },
    "idempotencyKey": "newsletter-0"
  },
  {
    "channel": "EMAIL",
    "recipient": "two@example.test",
    "priority": "LOW",
    "content": {
      "subject": "Product Update",
      "body": "Here is our latest update."
    },
    "idempotencyKey": "newsletter-1"
  }
]);
console.log(response.total, response.items);`,
      curl: `curl -X POST http://localhost:3000/v1/messages/bulk \\
  -H "Authorization: Bearer $CONVEY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "messages": [
    {
      "idempotencyKey": "newsletter-0",
      "userId": "customer-482",
      "team": "orders",
      "category": "TRANSACTIONAL",
      "country": "US",
      "priority": "marketing",
      "recipients": {
        "email": "one@example.test"
      },
      "channels": [
        {
          "channel": "email",
          "content": {
            "subject": "Product Update",
            "text": "Here is our latest update."
          }
        }
      ]
    },
    {
      "idempotencyKey": "newsletter-1",
      "userId": "customer-482",
      "team": "orders",
      "category": "TRANSACTIONAL",
      "country": "US",
      "priority": "marketing",
      "recipients": {
        "email": "two@example.test"
      },
      "channels": [
        {
          "channel": "email",
          "content": {
            "subject": "Product Update",
            "text": "Here is our latest update."
          }
        }
      ]
    }
  ]
}'`,
      py: `import os
from convey import Convey

client = Convey(
    api_key=os.environ["CONVEY_API_KEY"],
    base_url="http://localhost:3000",
    team_id="orders",
)

response = client.messages.send_bulk([{'channel': 'EMAIL', 'recipient': 'one@example.test', 'priority': 'LOW', 'content': {'subject': 'Product Update', 'body': 'Here is our latest update.'}, 'idempotency_key': 'newsletter-0'}, {'channel': 'EMAIL', 'recipient': 'two@example.test', 'priority': 'LOW', 'content': {'subject': 'Product Update', 'body': 'Here is our latest update.'}, 'idempotency_key': 'newsletter-1'}])
print(response.total)`,
    },
    expectedResponse: {
      status: '202 ACCEPTED',
      latency: 'Variable',
      trace: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      body: '{\n  "total": 2,\n  "items": [\n    {\n      "messageId": "msg_01ARZ3NDEKTSV4RRFFQ69G5FAV",\n      "state": "accepted",\n      "createdAt": "2026-10-10T09:00:00.000Z"\n    },\n    {\n      "messageId": "msg_01ARZ3NDEKTSV4RRFFQ69G5FAW",\n      "state": "accepted",\n      "createdAt": "2026-10-10T09:00:00.000Z"\n    }\n  ]\n}',
    },
  },
  {
    id: 'zero-trust-encryption',
    title: '4. Encrypted Payload Storage',
    shortTitle: 'Payload Encryption',
    category: 'API Example',
    icon: Lock,
    color: 'purple',
    badge: 'Pre-release contract',
    slaBenefit: 'Configure and protect the server payload encryption key.',
    description:
      'Submit a message normally. Server-side encryption protects stored recipients and content; client metadata cannot enable compliance or change server encryption policy.',
    languages: {
      ts: `import { Convey } from '@convey/sdk';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
  baseUrl: 'http://localhost:3000',
  teamId: 'orders', // Must match the authenticated key
});

const response = await convey.messages.send({
  "channel": "SMS",
  "recipient": "+12025550123",
  "content": {
    "body": "Your order is confirmed."
  },
  "idempotencyKey": "example-order-482"
});
console.log(response.messageId, response.state);`,
      curl: `curl -X POST http://localhost:3000/v1/messages \\
  -H "Authorization: Bearer $CONVEY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "idempotencyKey": "example-order-482",
  "userId": "customer-482",
  "team": "orders",
  "category": "TRANSACTIONAL",
  "country": "US",
  "priority": "transactional",
  "recipients": {
    "phone": "+12025550123"
  },
  "channels": [
    {
      "channel": "sms",
      "content": {
        "text": "Your order is confirmed."
      }
    }
  ]
}'`,
      py: `import os
from convey import Convey

client = Convey(
    api_key=os.environ["CONVEY_API_KEY"],
    base_url="http://localhost:3000",
    team_id="orders",
)

response = client.messages.send(
    channel='SMS',
    recipient='+12025550123',
    content={'body': 'Your order is confirmed.'},
    idempotency_key='example-order-482',
)
print(response.message_id, response.state)`,
    },
    expectedResponse: {
      status: '202 ACCEPTED',
      latency: 'Variable',
      trace: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      body: '{\n  "messageId": "msg_01ARZ3NDEKTSV4RRFFQ69G5FAV",\n  "state": "accepted",\n  "createdAt": "2026-10-10T09:00:00.000Z"\n}',
    },
  },
  {
    id: 'hedged-ops-alert',
    title: '5. Critical Operations Alert',
    shortTitle: 'Operations Alert',
    category: 'API Example',
    icon: Zap,
    color: 'rose',
    badge: 'Pre-release contract',
    slaBenefit: 'No client routing or hedging field is implied by this example.',
    description:
      'Submit a Slack alert to a configured channel. Routing, retries, and circuit behavior depend on server configuration and provider readiness.',
    languages: {
      ts: `import { Convey } from '@convey/sdk';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
  baseUrl: 'http://localhost:3000',
  teamId: 'orders', // Must match the authenticated key
});

const response = await convey.messages.send({
  "channel": "SLACK",
  "recipient": "C0123456789",
  "priority": "CRITICAL",
  "content": {
    "body": "Operations alert: inspect database connection usage."
  },
  "idempotencyKey": "ops-alert-482"
});
console.log(response.messageId, response.state);`,
      curl: `curl -X POST http://localhost:3000/v1/messages \\
  -H "Authorization: Bearer $CONVEY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "idempotencyKey": "ops-alert-482",
  "userId": "customer-482",
  "team": "orders",
  "category": "TRANSACTIONAL",
  "country": "US",
  "priority": "critical",
  "recipients": {
    "slack": {
      "channelId": "C0123456789"
    }
  },
  "channels": [
    {
      "channel": "slack",
      "content": {
        "text": "Operations alert: inspect database connection usage."
      }
    }
  ]
}'`,
      py: `import os
from convey import Convey

client = Convey(
    api_key=os.environ["CONVEY_API_KEY"],
    base_url="http://localhost:3000",
    team_id="orders",
)

response = client.messages.send(
    channel='SLACK',
    recipient='C0123456789',
    priority='CRITICAL',
    content={'body': 'Operations alert: inspect database connection usage.'},
    idempotency_key='ops-alert-482',
)
print(response.message_id, response.state)`,
    },
    expectedResponse: {
      status: '202 ACCEPTED',
      latency: 'Variable',
      trace: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      body: '{\n  "messageId": "msg_01ARZ3NDEKTSV4RRFFQ69G5FAV",\n  "state": "accepted",\n  "createdAt": "2026-10-10T09:00:00.000Z"\n}',
    },
  },
  {
    id: 'webhook-dlr-ingestion',
    title: '6. Signed Customer Webhook Verification',
    shortTitle: 'Webhook Verification',
    category: 'API Example',
    icon: Activity,
    color: 'cyan',
    badge: 'Pre-release contract',
    slaBenefit: 'The cURL tab creates a subscription; SDK tabs illustrate receiver verification.',
    description:
      'Verify the exact raw bytes of Convey customer events before parsing. Deduplicate event IDs and handle out-of-order outcomes. Provider ingress uses vendor-specific signature schemes.',
    languages: {
      ts: `import { Convey } from '@convey/sdk';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-convey-signature') || '';
  const event = await Convey.webhooks.constructEvent(
    rawBody, signature, process.env.CONVEY_WEBHOOK_SECRET!,
  );
  // Persist event.id before acting; duplicate IDs must be skipped.
  console.log(event.id, event.type);
  return Response.json({ received: true });
}`,
      curl: `curl -X POST http://localhost:3000/v1/webhook-subscriptions \\
  -H "Authorization: Bearer $CONVEY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "url": "https://your-service.example/convey-events",
  "events": [
    "message.delivered",
    "message.failed"
  ],
  "secret": "replace-with-a-strong-secret"
}'`,
      py: `import os
from convey import Convey

client = Convey(
    api_key=os.environ["CONVEY_API_KEY"],
    base_url="http://localhost:3000",
    team_id="orders",
)

def verify_event(raw_body: bytes, signature: str):
    event = client.webhooks.construct_event(
        raw_body, signature, os.environ["CONVEY_WEBHOOK_SECRET"],
    )
    # Persist and deduplicate event.id before applying the event.
    return event`,
    },
    expectedResponse: {
      status: '200 OK (receiver)',
      latency: 'Variable',
      trace: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      body: '{\n  "received": true\n}',
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
    <section id="recipes" className="py-16 sm:py-20 bg-[#060911] border-t border-slate-800/80 scroll-mt-16 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
        {/* Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="primary" size="md">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Message API Examples</span>
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            Examples from the Pre-release Contract
          </h2>
          <p className="text-xs sm:text-base text-slate-400">
            Examples use repository SDKs and the current message API. Replace local URLs, keys, team IDs, and provider
            configuration before running; shown responses are illustrative.
          </p>
        </div>

        {/* Recipe Selection Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md max-w-5xl mx-auto">
          {recipes.map((r) => {
            const Icon = r.icon;
            const isSelected = activeRecipeId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveRecipeId(r.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-medium transition-all cursor-pointer min-h-[36px] ${
                  isSelected
                    ? 'bg-sky-500/20 text-white border border-sky-500/40 shadow-lg shadow-sky-500/10 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                <span className="truncate">{r.shortTitle}</span>
              </button>
            );
          })}
        </div>

        {/* Recipe Content Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column: Architectural Description & Response Details */}
          <div className="lg:col-span-5 space-y-4 sm:space-y-6">
            <div className="p-4 sm:p-6 rounded-2xl border border-slate-800 bg-[#090d16] space-y-3.5 sm:space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <Badge variant="outline" size="sm">
                  {activeRecipe.category}
                </Badge>
                <span className="text-[10px] sm:text-[11px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  {activeRecipe.badge}
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white font-display leading-snug">
                {activeRecipe.title}
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed font-normal">{activeRecipe.description}</p>

              <div className="p-2.5 sm:p-3 rounded-xl bg-sky-500/5 border border-sky-500/20 flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div className="text-[11px] sm:text-xs text-sky-300 font-mono leading-tight">
                  <span className="font-bold text-white">Contract note:</span> {activeRecipe.slaBenefit}
                </div>
              </div>

              {/* Simulated Synchronous Response Box */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Illustrative Response:</span>
                  <span className="text-emerald-400 font-bold">{activeRecipe.expectedResponse.status}</span>
                </div>

                <div className="p-2.5 sm:p-3 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800/60 pb-1.5">
                    <span>
                      Timing: <strong className="text-sky-400">{activeRecipe.expectedResponse.latency}</strong>
                    </span>
                    <span className="text-slate-400 truncate ml-2">
                      Trace: {activeRecipe.expectedResponse.trace.slice(0, 14)}...
                    </span>
                  </div>
                  <pre className="text-slate-300 overflow-x-auto touch-scroll text-[11px] leading-relaxed m-0 max-h-[140px]">
                    {activeRecipe.expectedResponse.body}
                  </pre>
                </div>
              </div>

              <div className="pt-1 sm:pt-2">
                <Link href={`/docs/examples#${activeRecipe.id}`} className="block w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                  >
                    View Complete Chapter in Docs
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column: Code Viewer with Language Tabs */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#090d16] overflow-hidden shadow-2xl flex flex-col">
            {/* Header Bar with Language Switcher & Copy */}
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto touch-scroll">
                {(['ts', 'curl', 'py'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveLang(lang)}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer whitespace-nowrap ${
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
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-medium cursor-pointer border border-slate-700/60 active:scale-95 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Body */}
            <div className="p-3 sm:p-6 overflow-x-auto touch-scroll bg-[#070a12] font-mono text-[11px] sm:text-xs text-slate-200 leading-relaxed max-h-[380px] sm:max-h-[520px]">
              <pre className="m-0">
                <code>{activeRecipe.languages[activeLang]}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
