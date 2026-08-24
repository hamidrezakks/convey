'use client';

import { Bell, Check, Copy, Mail, MessageSquare, Radio, Send, Terminal } from 'lucide-react';
import { useState } from 'react';
import { copyToClipboard } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

type ChannelType = 'sms' | 'email' | 'whatsapp' | 'slack' | 'push';
type LangType = 'curl' | 'typescript' | 'python' | 'go';

export function OmnichannelPlayground() {
  const [channel, setChannel] = useState<ChannelType>('sms');
  const [lang, setLang] = useState<LangType>('typescript');
  const [recipient, setRecipient] = useState<string>('+14155552671');
  const [subject, setSubject] = useState<string>('Your Security Verification Code');
  const [body, setBody] = useState<string>('Your Convey security code is 849201. Valid for 10 minutes.');
  const [priority, setPriority] = useState<string>('HIGH');
  const [strategy, setStrategy] = useState<string>('SMART_SCORECARD');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [simulatedResponse, setSimulatedResponse] = useState<{
    status: string;
    publicId: string;
    latencyMs: number;
    traceparent: string;
    timestamp: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Update default values when channel switches
  const handleChannelChange = (newChannel: ChannelType) => {
    setChannel(newChannel);
    if (newChannel === 'sms') {
      setRecipient('+14155552671');
      setBody('Your Convey verification code is 849201. Valid for 10 minutes.');
    } else if (newChannel === 'email') {
      setRecipient('alex.chen@enterprise.io');
      setSubject('Production Deployment Finished');
      setBody('Hello Alex, your latest cluster deployment to us-east-1 succeeded.');
    } else if (newChannel === 'whatsapp') {
      setRecipient('+14155552671');
      setBody('Your order #ORD-98421 has shipped! Tracking: https://track.convey.internal');
    } else if (newChannel === 'slack') {
      setRecipient('#alerts-infrastructure');
      setBody(':rotating_light: Alert: High database connection pool utilization resolved.');
    } else if (newChannel === 'push') {
      setRecipient('fcm_token_9f8a3c1e2b4d5e6f...');
      setSubject('Incoming Payment Received');
      setBody('You received $1,250.00 from Stripe Payments.');
    }
  };

  // Generate code dynamically based on current form state
  const getGeneratedCode = (): string => {
    if (lang === 'curl') {
      return `curl -X POST https://api.convey.internal/v1/messages/send \\
  -H "Authorization: Bearer cv_live_9f8a3c1e2b4d5e6f" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: ord_99218_dispatch" \\
  -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \\
  -d '{
    "channel": "${channel}",
    "recipient": "${recipient}",
    "priority": "${priority}",
    "content": {
      ${channel === 'email' ? `"subject": "${subject}",\n      ` : ''}"body": "${body}"
    },
    "routing": {
      "strategy": "${strategy}",
      "fallbackChain": ["vonage", "infobip"]
    }
  }'`;
    }

    if (lang === 'typescript') {
      return `import { ConveyClient, MessagePriority } from '@convey/client';

const convey = new ConveyClient({
  apiKey: process.env.CONVEY_API_KEY!,
  baseUrl: 'https://api.convey.internal',
});

const response = await convey.messages.send({
  channel: '${channel}',
  recipient: '${recipient}',
  priority: MessagePriority.${priority},
  idempotencyKey: 'ord_99218_dispatch',
  content: {
    ${channel === 'email' ? `subject: '${subject}',\n    ` : ''}body: '${body}',
  },
  routing: {
    strategy: '${strategy}',
    fallbackChain: ['vonage', 'infobip'],
  },
});

console.log(\`Accepted: \${response.publicId} in \${response.latencyMs}ms\`);`;
    }

    if (lang === 'python') {
      return `import asyncio
from convey import AsyncConveyClient, MessagePriority

async def send_msg():
    async with AsyncConveyClient(api_key="cv_live_...") as client:
        res = await client.messages.send(
            channel="${channel}",
            recipient="${recipient}",
            priority=MessagePriority.${priority},
            idempotency_key="ord_99218_dispatch",
            content={
                ${channel === 'email' ? `"subject": "${subject}",\n                ` : ''}"body": "${body}"
            },
            routing={
                "strategy": "${strategy}",
                "fallback_chain": ["vonage", "infobip"]
            }
        )
        print(f"Accepted: {res.public_id} latency={res.latency_ms}ms")

asyncio.run(send_msg())`;
    }

    if (lang === 'go') {
      return `package main

import (
    "context"
    "fmt"
    "github.com/convey/convey-go/convey"
)

func main() {
    client := convey.NewClient("cv_live_...")
    ctx := context.Background()

    msg, err := client.Messages.Send(ctx, &convey.SendMessageRequest{
        Channel:        convey.Channel${channel.toUpperCase()},
        Recipient:      "${recipient}",
        Priority:       convey.Priority${priority},
        IdempotencyKey: "ord_99218_dispatch",
        Content: convey.MessageContent{
            ${channel === 'email' ? `Subject: "${subject}",\n            ` : ''}Body: "${body}",
        },
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("Accepted %s (Latency: %dms)\\n", msg.PublicID, msg.LatencyMs)
}`;
    }

    return '';
  };

  const handleSendTest = () => {
    setIsSending(true);
    setTimeout(() => {
      const randomUlidSuffix = Math.random().toString(36).substring(2, 10).toUpperCase();
      const latency = Number((Math.random() * 2 + 1.2).toFixed(2));
      setSimulatedResponse({
        status: 'ACCEPTED',
        publicId: `msg_01JB61Z8${randomUlidSuffix}77`,
        latencyMs: latency,
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        timestamp: new Date().toISOString(),
      });
      setIsSending(false);
    }, 450);
  };

  const handleCopyCode = async () => {
    const success = await copyToClipboard(getGeneratedCode());
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section id="playground" className="py-20 bg-[#070b12] scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Title */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="primary" size="md">
            <Terminal className="w-3.5 h-3.5" />
            <span>Interactive Omnichannel Playground</span>
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            Try Sending Any Message in Seconds
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            Configure parameters across SMS, Email, WhatsApp, Slack, and Push. Copy production SDK code in TypeScript,
            Python, Go, or cURL.
          </p>
        </div>

        {/* Channel Selector Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {[
            { id: 'sms', label: 'SMS', icon: MessageSquare, badge: 'Twilio / Vonage' },
            { id: 'email', label: 'Email', icon: Mail, badge: 'SES / Resend' },
            { id: 'whatsapp', label: 'WhatsApp', icon: Radio, badge: 'Meta Cloud API' },
            { id: 'slack', label: 'Slack', icon: MessageSquare, badge: 'Block Kit' },
            { id: 'push', label: 'Push', icon: Bell, badge: 'FCM / APNs' },
          ].map((c) => {
            const isActive = channel === c.id;
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleChannelChange(c.id as ChannelType)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-lg shadow-sky-500/20 scale-105'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{c.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    isActive ? 'bg-slate-950/20 text-slate-900' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {c.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2-Column Playground Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 rounded-2xl border border-slate-800 bg-[#090d16] p-6 sm:p-8 shadow-2xl glass-panel">
          {/* Left: Interactive Form Controls */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Message Ingestion Parameters
              </span>
              <Badge variant="success" size="sm">
                Live Ingestion
              </Badge>
            </div>

            {/* Recipient */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Recipient (
                {channel === 'email'
                  ? 'Email Address'
                  : channel === 'push'
                    ? 'Device Token'
                    : channel === 'slack'
                      ? 'Channel Name'
                      : 'E.164 Phone Number'}
                )
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            {/* Subject (for Email / Push) */}
            {(channel === 'email' || channel === 'push') && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            )}

            {/* Body */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Message Content Body</label>
              <textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Priority & Strategy Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Priority Tier</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                >
                  <option value="CRITICAL">CRITICAL (OTP)</option>
                  <option value="HIGH">HIGH</option>
                  <option value="DEFAULT">DEFAULT</option>
                  <option value="LOW">LOW (Batch)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Routing Strategy</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                >
                  <option value="SMART_SCORECARD">SMART_SCORECARD</option>
                  <option value="PRIMARY_FALLBACK">PRIMARY_FALLBACK</option>
                  <option value="LEAST_COST">LEAST_COST</option>
                  <option value="ROUND_ROBIN">ROUND_ROBIN</option>
                </select>
              </div>
            </div>

            {/* Test Send Button */}
            <Button
              variant="primary"
              size="md"
              leftIcon={<Send className="w-4 h-4" />}
              className="w-full mt-2"
              onClick={handleSendTest}
              disabled={isSending}
            >
              {isSending ? 'Ingesting via Fast-Path...' : 'Send Test Ingestion (Sub-15ms)'}
            </Button>
          </div>

          {/* Right: Code Generator & Response Inspector */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {/* Language Selector Bar */}
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                {(
                  [
                    { id: 'typescript', label: 'TypeScript / Bun' },
                    { id: 'curl', label: 'cURL' },
                    { id: 'python', label: 'Python' },
                    { id: 'go', label: 'Go' },
                  ] as const
                ).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLang(l.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                      lang === l.id
                        ? 'bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-medium cursor-pointer border border-slate-700/60"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Snippet</span>
                  </>
                )}
              </button>
            </div>

            {/* Generated Code Window */}
            <div className="rounded-xl border border-slate-800 bg-[#070b12] p-4 flex-1 overflow-x-auto font-mono text-xs text-slate-200 shadow-inner leading-relaxed">
              <pre className="m-0">
                <code>{getGeneratedCode()}</code>
              </pre>
            </div>

            {/* Live Response Inspector */}
            {simulatedResponse && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-4 space-y-2 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    HTTP 202 ACCEPTED
                  </div>
                  <span className="font-mono text-slate-400">
                    Ingestion Latency: <strong className="text-sky-400">{simulatedResponse.latencyMs}ms</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 pt-1">
                  <div>
                    <span className="text-slate-500">Public ULID:</span>{' '}
                    <span className="text-sky-300 font-semibold">{simulatedResponse.publicId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Trace ID:</span>{' '}
                    <span className="text-slate-400">{simulatedResponse.traceparent.slice(3, 19)}...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
