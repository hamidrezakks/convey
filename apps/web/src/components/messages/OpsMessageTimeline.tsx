import { MessageStatus } from '@convey/shared';
import { AlertCircle, CheckCircle2, Clock, Send, Server, UserCheck } from 'lucide-react';
import { useI18n } from '../../i18n';
import { cn, formatDurationMs, formatTimeAgo } from '../../lib/utils';

export interface OpsMessageTimelineProps {
  status: MessageStatus | string;
  createdAt: string;
  channel?: string;
  recipient: string;
  attempts?: Array<{
    attemptNumber: number;
    providerId: string;
    status: string;
    responseCode?: number;
    latencyMs?: number;
    attemptedAt: string;
  }>;
}

export function OpsMessageTimeline({ status, createdAt, recipient, attempts = [] }: OpsMessageTimelineProps) {
  const { t } = useI18n();

  const isDelivered = status === MessageStatus.DELIVERED || status === 'DELIVERED';
  const isFailed = status === MessageStatus.FAILED || status === 'FAILED';
  const isSuppressed = status === MessageStatus.SUPPRESSED || status === 'SUPPRESSED';
  const isQueued = status === MessageStatus.QUEUED || status === MessageStatus.ACCEPTED || status === 'QUEUED';

  const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-500" />
          {t('mode.deliveryTimeline')}
        </h4>
        <span
          className={cn(
            'text-xs font-semibold px-2.5 py-0.5 rounded-full border',
            isDelivered
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
              : isFailed
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30'
                : isSuppressed
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
                  : 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
          )}
        >
          {status}
        </span>
      </div>

      {/* 3-Step Journey Grid */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
        {/* Step 1: Accepted & Enqueued */}
        <div className="relative flex items-start gap-3">
          <div className="absolute -left-6 mt-0.5 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">{t('mode.stepAccepted')}</span>
              <span className="text-[10px] text-slate-400 font-mono">{formatTimeAgo(createdAt)}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t('mode.stepAcceptedDesc')}</p>
          </div>
        </div>

        {/* Step 2: Routed to Provider */}
        <div className="relative flex items-start gap-3">
          <div
            className={cn(
              'absolute -left-6 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm',
              lastAttempt || isDelivered
                ? 'bg-emerald-500 text-slate-950'
                : isQueued
                  ? 'bg-sky-500 text-white animate-pulse'
                  : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
            )}
          >
            <Server className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">{t('mode.stepRouted')}</span>
              {lastAttempt && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {lastAttempt.providerId} ({formatDurationMs(lastAttempt.latencyMs ?? 0)})
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t('mode.stepRoutedDesc')}</p>
          </div>
        </div>

        {/* Step 3: Delivered to Recipient */}
        <div className="relative flex items-start gap-3">
          <div
            className={cn(
              'absolute -left-6 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm',
              isDelivered
                ? 'bg-emerald-500 text-slate-950'
                : isFailed
                  ? 'bg-rose-500 text-white'
                  : isSuppressed
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-500',
            )}
          >
            {isDelivered ? (
              <UserCheck className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : isFailed || isSuppressed ? (
              <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <Send className="w-3 h-3" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {isDelivered
                  ? t('mode.stepDelivered')
                  : isFailed
                    ? t('mode.stepFailed')
                    : isSuppressed
                      ? 'Suppressed by System'
                      : 'Delivering to Recipient...'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {isDelivered ? `${t('mode.stepDeliveredDesc')} (${recipient})` : t('mode.stepDeliveredDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
