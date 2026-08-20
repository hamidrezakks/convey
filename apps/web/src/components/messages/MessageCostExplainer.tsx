import type { Channel } from '@convey/shared';
import { CheckCircle2, DollarSign, HelpCircle, Radio, Server, Sparkles, TrendingDown, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

export interface MessageCostExplainerProps {
  channel: Channel | string;
  costUsd?: number;
  attempts?: Array<{
    attemptNumber: number;
    providerId: string;
    status: string;
    responseCode?: number;
    latencyMs?: number;
    attemptedAt: string;
  }>;
  isOps?: boolean;
}

export function MessageCostExplainer({
  channel,
  costUsd = 0,
  attempts = [],
  isOps = false,
}: MessageCostExplainerProps) {
  const normChan = typeof channel === 'string' ? channel.toUpperCase() : String(channel).toUpperCase();
  const isZeroCost =
    costUsd === 0 ||
    normChan === 'PUSH' ||
    normChan === 'SLACK' ||
    normChan === 'TELEGRAM' ||
    normChan === 'TOOL' ||
    normChan === 'CHAT';
  const effectiveCost = isZeroCost ? 0 : costUsd;

  const chosenProvider = attempts.length > 0 ? attempts[attempts.length - 1].providerId : 'Default Gateway';

  // Channel cost explanation metadata
  const getCostContext = () => {
    switch (normChan) {
      case 'SMS':
        return {
          tierName: 'Carrier Transit Gateway',
          tierVariant: 'warning' as const,
          billingModel: 'Per 160-char GSM-7 Segment',
          whyTitle: 'Why this cost for SMS?',
          whyDescription:
            'SMS incurs global telecommunication carrier transit and 10DLC / shortcode routing fees. Each standard SMS is billed per 160-character GSM-7 (or 70-character UCS-2) segment delivered through carrier aggregators.',
          optimizationNote:
            'Convey Smart Provider Router dynamically selected this gateway based on real-time EMA latency and deliverability scorecards to guarantee SLA.',
          icon: Radio,
          colorClass: 'text-amber-500 dark:text-amber-400',
          bgClass: 'bg-amber-500/10 border-amber-500/20',
        };

      case 'EMAIL':
        return {
          tierName: 'Transactional Cloud MTA',
          tierVariant: 'cyan' as const,
          billingModel: 'High-Volume Batch Envelope ($0.10 / 1K)',
          whyTitle: 'Why this cost for Email?',
          whyDescription:
            'Transactional emails are billed per SMTP/HTTP transmission envelope via cloud Mail Transfer Agents (e.g. AWS SES / SendGrid). Includes dedicated IP delivery, DKIM/SPF alignment signing, and TLS encryption overhead.',
          optimizationNote:
            'Automated template caching and payload compression minimized wire size and dispatch latency under 15ms.',
          icon: Zap,
          colorClass: 'text-sky-500 dark:text-sky-400',
          bgClass: 'bg-sky-500/10 border-sky-500/20',
        };

      case 'WHATSAPP':
        return {
          tierName: 'Meta Business Solution API',
          tierVariant: 'purple' as const,
          billingModel: 'Conversation Category / 24h Session',
          whyTitle: 'Why this cost for WhatsApp?',
          whyDescription:
            'Meta charges conversation rates based on initiation category (Marketing, Utility, Authentication, or Service). Convey checks active 24-hour customer inquiry windows.',
          optimizationNote:
            'Convey WhatsApp Session Interceptor verifies 24-hour customer inquiry sessions, reducing utility template fees to low-cost conversational rates.',
          icon: Sparkles,
          colorClass: 'text-emerald-500 dark:text-emerald-400',
          bgClass: 'bg-emerald-500/10 border-emerald-500/20',
        };

      case 'PUSH':
      case 'FCM':
      case 'APNS':
        return {
          tierName: 'Direct Device Push Protocol',
          tierVariant: 'success' as const,
          billingModel: 'Free Direct Gateway Protocol',
          whyTitle: 'Why is Push free ($0.00000)?',
          whyDescription:
            'Push notifications travel directly over persistent HTTP/2 and socket connections to Apple APNs and Google FCM infrastructure. There are zero per-message telecom or carrier surcharges.',
          optimizationNote: 'Zero transit cost protocol with immediate device wake and foreground delivery.',
          icon: CheckCircle2,
          colorClass: 'text-emerald-500 dark:text-emerald-400',
          bgClass: 'bg-emerald-500/10 border-emerald-500/20',
        };

      default:
        return {
          tierName: 'Zero-Surcharge Webhook API',
          tierVariant: 'success' as const,
          billingModel: 'Direct API Egress (Zero Cost)',
          whyTitle: 'Why is this channel free ($0.00000)?',
          whyDescription:
            'Dispatched via direct authenticated HTTPS Webhook or Bot APIs (e.g. Slack Web API, Telegram Bot API). No intermediate carrier transit fees apply.',
          optimizationNote: 'Direct authenticated protocol egress with guaranteed sub-100ms dispatch.',
          icon: Server,
          colorClass: 'text-emerald-500 dark:text-emerald-400',
          bgClass: 'bg-emerald-500/10 border-emerald-500/20',
        };
    }
  };

  const context = getCostContext();
  const Icon = context.icon;

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 p-4 sm:p-5 space-y-4">
      {/* Header & Cost Value Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className={cn('p-2 rounded-xl border flex items-center justify-center', context.bgClass)}>
            <DollarSign className={cn('w-4 h-4', context.colorClass)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {isOps ? 'Delivery Cost Analysis' : 'Cost Indicator & Financial Audit'}
              </h4>
              <Badge variant={context.tierVariant} dot>
                {context.tierName}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Billing Model:{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{context.billingModel}</span>
            </p>
          </div>
        </div>

        {/* Cost Amount Badge */}
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
              {isZeroCost ? '$0.00000' : `$${effectiveCost.toFixed(5)}`}
            </span>
            {isZeroCost && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Free
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Provider: {chosenProvider}</p>
        </div>
      </div>

      {/* "Why This Cost" Explanation Card */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-semibold">
          <Icon className={cn('w-3.5 h-3.5', context.colorClass)} />
          <span>{context.whyTitle}</span>
        </div>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">{context.whyDescription}</p>

        {/* Smart Routing / Cost Optimization Note */}
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <TrendingDown className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-700 dark:text-slate-300">Optimization: </strong>
            {context.optimizationNote}
          </span>
        </div>
      </div>

      {/* Multi-Attempt Cost Attribution (if failover occurred) */}
      {attempts.length > 1 && (
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Multi-Provider Failover Cost Audit ({attempts.length} attempts)</span>
          </div>
          <div className="space-y-1 text-[11px] font-mono text-slate-600 dark:text-slate-400">
            {attempts.map((att) => (
              <div key={att.attemptNumber} className="flex items-center justify-between">
                <span>
                  Attempt #{att.attemptNumber} via {att.providerId} ({att.status})
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {att.status === 'DELIVERED' ? `$${effectiveCost.toFixed(5)}` : '$0.00000 (Failed)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
