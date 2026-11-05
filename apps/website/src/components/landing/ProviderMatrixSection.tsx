'use client';

import { Lock, Radio, Search } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../ui/Badge';

interface ProviderItem {
  id: string;
  name: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'push' | 'chat' | 'tool';
  authType: string;
  capabilities: string[];
  status: string;
}

const featuredProviders: ProviderItem[] = [
  // Email
  {
    id: 'ses',
    name: 'AWS SES v2',
    channel: 'email',
    authType: 'IAM SigV4',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  {
    id: 'resend',
    name: 'Resend',
    channel: 'email',
    authType: 'API Key',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  {
    id: 'sendgrid',
    name: 'Twilio SendGrid',
    channel: 'email',
    authType: 'Bearer Token',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  {
    id: 'postmark',
    name: 'Postmark',
    channel: 'email',
    authType: 'Server Token',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  {
    id: 'mailgun',
    name: 'Mailgun',
    channel: 'email',
    authType: 'Basic Auth',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  // SMS
  {
    id: 'twilio',
    name: 'Twilio SMS',
    channel: 'sms',
    authType: 'Basic SID/AuthToken',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  {
    id: 'nexmo',
    name: 'Vonage (Nexmo)',
    channel: 'sms',
    authType: 'API Key/Secret',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  {
    id: 'plivo',
    name: 'Plivo SMS',
    channel: 'sms',
    authType: 'Auth ID/Token',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  {
    id: 'messagebird',
    name: 'MessageBird (Bird)',
    channel: 'sms',
    authType: 'Access Key',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  {
    id: 'infobip',
    name: 'Infobip',
    channel: 'sms',
    authType: 'API Key',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  // WhatsApp
  {
    id: 'whatsapp-business',
    name: 'Meta WhatsApp Cloud API',
    channel: 'whatsapp',
    authType: 'Graph API Bearer',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  {
    id: 'twilio-whatsapp',
    name: 'Twilio WhatsApp',
    channel: 'whatsapp',
    authType: 'Basic SID/AuthToken',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  // Push
  {
    id: 'fcm',
    name: 'Firebase Cloud Messaging (FCM v1)',
    channel: 'push',
    authType: 'Google Service Account',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  {
    id: 'apns',
    name: 'Apple APNs',
    channel: 'push',
    authType: 'JWT Token (P8)',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  {
    id: 'one-signal',
    name: 'OneSignal',
    channel: 'push',
    authType: 'REST API Key',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  // Chat
  {
    id: 'slack',
    name: 'Slack',
    channel: 'chat',
    authType: 'OAuth2 Bot Token',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  {
    id: 'discord',
    name: 'Discord Webhooks',
    channel: 'chat',
    authType: 'Webhook Token',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
  {
    id: 'telegram',
    name: 'Telegram Bot API',
    channel: 'chat',
    authType: 'Bot Token',
    capabilities: ['Adapter entry', 'See readiness and contract coverage'],
    status: 'Catalog',
  },
];

export function ProviderMatrixSection() {
  const [activeChannel, setActiveChannel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = featuredProviders.filter((p) => {
    const matchesChannel = activeChannel === 'all' || p.channel === activeChannel;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.capabilities.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.authType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesChannel && matchesSearch;
  });

  return (
    <section id="providers" className="py-16 sm:py-20 bg-[#070b12] scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="primary" size="md">
            <Radio className="w-3.5 h-3.5" />
            <span>Provider Catalog</span>
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            Provider Adapters & Readiness Gates
          </h2>
          <p className="text-xs sm:text-base text-slate-400">
            Browse selected adapter entries across Email, SMS, WhatsApp, Push, and Chat. Catalog presence does not
            certify live delivery or optional features; 20 incomplete native adapters remain unavailable.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
            {[
              { id: 'all', label: 'All Channels' },
              { id: 'email', label: 'Email' },
              { id: 'sms', label: 'SMS' },
              { id: 'whatsapp', label: 'WhatsApp' },
              { id: 'push', label: 'Push' },
              { id: 'chat', label: 'Chat' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveChannel(tab.id)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer min-h-[32px] ${
                  activeChannel === tab.id
                    ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter providers..."
              aria-label="Filter providers"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 sm:py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 min-h-[38px]"
            />
          </div>
        </div>

        {/* Providers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((provider) => (
            <div
              key={provider.id}
              className="p-4 sm:p-5 rounded-2xl border border-slate-800/80 bg-[#090d16]/80 hover:bg-[#0e1626]/90 hover:border-slate-700 transition-all space-y-3.5 sm:space-y-4 shadow-md group glass-panel-hover"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-100 group-hover:text-sky-300 transition-colors">
                      {provider.name}
                    </span>
                  </div>
                  <Badge variant="outline" size="sm" className="text-[10px] font-mono capitalize">
                    {provider.channel}
                  </Badge>
                </div>

                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{provider.status}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {provider.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded-md border border-slate-800"
                  >
                    {cap}
                  </span>
                ))}
              </div>

              <div className="pt-2.5 sm:pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span className="flex items-center gap-1 truncate max-w-[180px]">
                  <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">Auth: {provider.authType}</span>
                </span>
                <span className="text-sky-400 font-medium shrink-0">Live state unavailable</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
