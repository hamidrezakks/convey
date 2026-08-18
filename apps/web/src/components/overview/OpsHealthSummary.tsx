import { CheckCircle2, DollarSign, HeartPulse, Send, Zap } from 'lucide-react';
import { useI18n } from '../../i18n';
import { Card, CardContent } from '../ui/card';

export interface OpsHealthSummaryProps {
  deliveryRate?: number;
  totalSent?: number;
  avgSpeedMs?: number;
  costSavedUsd?: number;
}

export function OpsHealthSummary({
  deliveryRate = 99.85,
  totalSent = 12450,
  avgSpeedMs = 18,
  costSavedUsd = 12.6,
}: OpsHealthSummaryProps) {
  const { t } = useI18n();

  return (
    <Card className="glass-panel border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-white/80 dark:via-slate-900/80 to-sky-500/5 shadow-lg overflow-hidden relative">
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Main Status Headline */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 dark:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-md shadow-emerald-500/10">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {t('mode.systemHealthy')}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  100% Operational
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {t('mode.systemHealthyDesc')}
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 lg:pl-6 shrink-0">
            {/* Delivery Rate */}
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <HeartPulse className="w-3.5 h-3.5 text-emerald-500" />
                {t('mode.deliverySuccess')}
              </span>
              <div className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {deliveryRate}%
              </div>
            </div>

            {/* Total Sent */}
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Send className="w-3.5 h-3.5 text-sky-500" />
                {t('mode.sentToday')}
              </span>
              <div className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
                {totalSent.toLocaleString()}
              </div>
            </div>

            {/* Delivery Speed */}
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                {t('mode.averageDeliverySpeed')}
              </span>
              <div className="text-base sm:text-lg font-bold font-mono text-amber-600 dark:text-amber-300">
                {avgSpeedMs < 1000 ? `${avgSpeedMs}ms` : `${(avgSpeedMs / 1000).toFixed(2)}s`}
              </div>
            </div>

            {/* Cost Saved */}
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                {t('mode.totalCostSaved')}
              </span>
              <div className="text-base sm:text-lg font-bold font-mono text-indigo-600 dark:text-indigo-300">
                ${costSavedUsd.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
