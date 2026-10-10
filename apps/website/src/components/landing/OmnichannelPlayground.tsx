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
      setRecipient('C0123456789');
      setBody(':rotating_light: Alert: High database connection pool utilization resolved.');
    } else if (newChannel === 'push') {
      setRecipient('fcm_token_9f8a3c1e2b4d5e6f...');
      setSubject('Incoming Payment Received');
      setBody('You received $1,250.00 from Stripe Payments.');
    }
  };

  // Generate code dynamically based on current form state
  const getGeneratedCode = (): string => {
    const quoted = (value: string) => JSON.stringify(value);
    const priorityMap: Record<string, string> = {
      CRITICAL: 'critical',
      HIGH: 'transactional',
      DEFAULT: 'normal',
      LOW: 'marketing',
    };
    const recipients =
      channel === 'email'
        ? { email: recipient }
        : channel === 'sms'
          ? { phone: recipient }
          : channel === 'whatsapp'
            ? { whatsapp: recipient }
            : channel === 'slack'
              ? { slack: { channelId: recipient } }
              : { fcmTokens: [recipient] };
    const content =
      channel === 'email' ? { subject, text: body } : channel === 'push' ? { title: subject, body } : { text: body };
    const payload = {
      idempotencyKey: 'example-dispatch-482',
      userId: 'customer-482',
      team: 'orders',
      category: 'TRANSACTIONAL',
      country: 'US',
      priority: priorityMap[priority],
      recipients,
      channels: [{ channel: channel === 'push' ? 'fcm' : channel, content }],
    };
    const policyNote = `Routing preview: ${strategy}; configure provider policy on the server.`;

    if (lang === 'curl') {
      const shellJson = JSON.stringify(payload, null, 2).replace(/'/g, "'\\''");
      return `# ${policyNote}
# The team must match the authenticated key.
curl -X POST http://localhost:3000/v1/messages \\
  -H "Authorization: Bearer $CONVEY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${shellJson}'`;
    }
    if (lang === 'typescript') {
      return `import { Convey } from '@convey/sdk';

const convey = new Convey({
  apiKey: process.env.CONVEY_API_KEY!,
  baseUrl: 'http://localhost:3000',
  teamId: 'orders', // Must match the authenticated key
});

// ${policyNote}
const response = await convey.messages.send({
  channel: '${channel.toUpperCase()}',
  recipient: ${quoted(recipient)},
  priority: '${priority}',
  idempotencyKey: 'example-dispatch-482',
  content: {
    ${channel === 'email' || channel === 'push' ? `subject: ${quoted(subject)},\n    ` : ''}body: ${quoted(body)},
  },
});

console.log(response.messageId, response.state);`;
    }
    if (lang === 'python') {
      return `import os
from convey import Convey, Channel, MessagePriority

client = Convey(
    api_key=os.environ["CONVEY_API_KEY"],
    base_url="http://localhost:3000",
    team_id="orders",
)

# ${policyNote}
response = client.messages.send(
    channel=Channel.${channel.toUpperCase()},
    recipient=${quoted(recipient)},
    priority=MessagePriority.${priority},
    idempotency_key="example-dispatch-482",
    content={
        ${channel === 'email' || channel === 'push' ? `"subject": ${quoted(subject)},\n        ` : ''}"body": ${quoted(body)},
    },
)

print(response.message_id, response.state)`;
    }
    if (lang === 'go') {
      const goChannels = { sms: 'SMS', email: 'Email', whatsapp: 'WhatsApp', slack: 'Slack', push: 'Push' };
      const goPriorities: Record<string, string> = {
        CRITICAL: 'Critical',
        HIGH: 'High',
        DEFAULT: 'Default',
        LOW: 'Low',
      };
      return `package main

import (
    "context"
    "fmt"
    "os"
    convey "github.com/hamidrezakks/convey/packages/sdk-go"
)

func main() {
    client := convey.NewClient(os.Getenv("CONVEY_API_KEY"),
        convey.WithBaseURL("http://localhost:3000"),
        convey.WithTeamID("orders"),
    )
    // ${policyNote}
    res, err := client.Messages.Send(context.Background(), convey.SendMessageRequest{
        Channel: convey.Channel${goChannels[channel]},
        Recipient: ${quoted(recipient)},
        Priority: convey.Priority${goPriorities[priority]},
        IdempotencyKey: "example-dispatch-482",
        Content: &convey.MessageContent{
            ${channel === 'email' || channel === 'push' ? `Subject: ${quoted(subject)},\n            ` : ''}Body: ${quoted(body)},
        },
    })
    if err != nil { panic(err) }
    fmt.Println(res.MessageID, res.State)
}`;
    }
    return '';
  };

  const handleSendTest = () => {
    setIsSending(true);
    setTimeout(() => {
      const latency = Number((Math.random() * 2 + 1.2).toFixed(2));
      setSimulatedResponse({
        status: 'ACCEPTED',
        publicId: 'msg_01ARZ3NDEKTSV4RRFFQ69G5FAV',
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
    <section id="playground" className="py-16 sm:py-20 bg-[#070b12] scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* Section Title */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="primary" size="md">
            <Terminal className="w-3.5 h-3.5" />
            <span>Interactive Omnichannel Playground</span>
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            Explore Message Requests & Simulated Acceptance
          </h2>
          <p className="text-xs sm:text-base text-slate-400">
            Configure SMS, Email, WhatsApp, Slack, and Push examples for repository SDKs or cURL. This browser demo
            makes no API call; IDs and timing are simulated. Replace the sample key scope and idempotency key for real
            requests.
          </p>
        </div>

        {/* Channel Selector Bar */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {[
            { id: 'sms', label: 'SMS', icon: MessageSquare, badge: 'Configured SMS' },
            { id: 'email', label: 'Email', icon: Mail, badge: 'Configured Email' },
            { id: 'whatsapp', label: 'WhatsApp', icon: Radio, badge: 'Meta Cloud API' },
            { id: 'slack', label: 'Slack', icon: MessageSquare, badge: 'Channel ID' },
            { id: 'push', label: 'Push', icon: Bell, badge: 'FCM / APNs' },
          ].map((c) => {
            const isActive = channel === c.id;
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleChannelChange(c.id as ChannelType)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer min-h-[40px] ${
                  isActive
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-lg shadow-sky-500/20 scale-[1.02]'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{c.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md hidden xs:inline-block ${
                    isActive ? 'bg-slate-950/20 text-slate-900 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {c.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2-Column Playground Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 rounded-2xl border border-slate-800 bg-[#090d16] p-4 sm:p-8 shadow-2xl glass-panel">
          {/* Left: Interactive Form Controls */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                Message Parameters
              </span>
              <Badge variant="success" size="sm">
                Browser Simulation
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
                      ? 'Channel ID'
                      : 'E.164 Phone Number'}
                )
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 transition-colors min-h-[40px]"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 transition-colors min-h-[40px]"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Priority Tier</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 transition-colors min-h-[40px] cursor-pointer"
                >
                  <option value="CRITICAL">CRITICAL (OTP)</option>
                  <option value="HIGH">HIGH</option>
                  <option value="DEFAULT">DEFAULT</option>
                  <option value="LOW">LOW (Batch)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Routing Policy Preview</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 transition-colors min-h-[40px] cursor-pointer"
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
              className="w-full mt-2 min-h-[44px]"
              onClick={handleSendTest}
              disabled={isSending}
            >
              {isSending ? 'Simulating Acceptance...' : 'Simulate Acceptance (No API Call)'}
            </Button>
          </div>

          {/* Right: Code Generator & Response Inspector */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {/* Language Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto touch-scroll max-w-full">
                {(
                  [
                    { id: 'typescript', label: 'TypeScript' },
                    { id: 'curl', label: 'cURL' },
                    { id: 'python', label: 'Python' },
                    { id: 'go', label: 'Go' },
                  ] as const
                ).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLang(l.id)}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer whitespace-nowrap ${
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-medium cursor-pointer border border-slate-700/60 active:scale-95 shrink-0"
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

            {/* Generated Code Window */}
            <div className="rounded-xl border border-slate-800 bg-[#070b12] p-3 sm:p-4 flex-1 overflow-x-auto touch-scroll font-mono text-[11px] sm:text-xs text-slate-200 shadow-inner leading-relaxed max-h-[380px] lg:max-h-none">
              <pre className="m-0">
                <code>{getGeneratedCode()}</code>
              </pre>
            </div>

            {/* Live Response Inspector */}
            {simulatedResponse && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-3.5 sm:p-4 space-y-2 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    SIMULATED HTTP 202 ACCEPTED
                  </div>
                  <span className="font-mono text-slate-400 text-[11px]">
                    Illustrative Timing: <strong className="text-sky-400">{simulatedResponse.latencyMs}ms</strong>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-[11px] font-mono text-slate-300 pt-1">
                  <div className="truncate">
                    <span className="text-slate-500">Public ULID:</span>{' '}
                    <span className="text-sky-300 font-semibold">{simulatedResponse.publicId}</span>
                  </div>
                  <div className="truncate">
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
