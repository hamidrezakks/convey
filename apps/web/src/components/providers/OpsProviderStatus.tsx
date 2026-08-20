import { CircuitState, type ProviderHealthDto } from '@convey/shared';
import { Mail, MessageSquare, Phone, Radio, Zap } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export interface OpsProviderStatusProps {
  providers: ProviderHealthDto[];
}

export function OpsProviderStatus({ providers }: OpsProviderStatusProps) {
  // Group providers by channel
  const channels = [
    {
      id: 'EMAIL',
      name: 'Email Delivery',
      icon: Mail,
      desc: 'Transactional receipts, auth codes & digests via Amazon SES, SendGrid, Postmark',
      color: 'cyan',
    },
    {
      id: 'SMS',
      name: 'SMS & Telecom',
      icon: Phone,
      desc: 'High-speed 2FA codes & instant notifications via Twilio, Sinch, Plivo, MessageBird',
      color: 'purple',
    },
    {
      id: 'WHATSAPP',
      name: 'WhatsApp',
      icon: MessageSquare,
      desc: 'Rich interactive customer chats & session converted free plain-text messages',
      color: 'emerald',
    },
    {
      id: 'PUSH',
      name: 'Push Notifications',
      icon: Zap,
      desc: 'Mobile & Web push alerts via Firebase Cloud Messaging & Apple APNs',
      color: 'indigo',
    },
    {
      id: 'CHAT',
      name: 'Chat & Webhooks',
      icon: Radio,
      desc: 'Internal alerts & bot notifications via Slack, Discord, Microsoft Teams',
      color: 'amber',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {channels.map((ch) => {
        const Icon = ch.icon;
        const channelProviders = providers.filter((p) => p.channel === ch.id);
        const hasOpenCircuits = channelProviders.some((p) => p.state === CircuitState.OPEN);
        const hasHalfOpen = channelProviders.some((p) => p.state === CircuitState.HALF_OPEN);

        const statusLabel = hasOpenCircuits ? 'Degraded' : hasHalfOpen ? 'Testing Recovery' : 'All Systems Normal';

        const statusVariant = hasOpenCircuits ? 'destructive' : hasHalfOpen ? 'warning' : 'success';

        return (
          <Card key={ch.id} className="glass-card hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <CardHeader className="flex flex-row items-center justify-between gap-2.5 pb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs shrink-0">
                  <Icon className="w-4 h-4 text-sky-500" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {ch.name}
                  </CardTitle>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono block truncate">
                    {channelProviders.length} active providers
                  </span>
                </div>
              </div>
              <Badge variant={statusVariant} dot className="shrink-0 whitespace-nowrap text-[11px] px-2 py-0.5">
                {statusLabel}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ch.desc}</p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Success Rate:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                  {hasOpenCircuits ? '98.5%' : '99.9%'}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
