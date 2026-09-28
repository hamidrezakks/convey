import { CheckCircle2, DollarSign, HeartPulse, Zap } from 'lucide-react';
import { useI18n } from '../../i18n';
import { Card, CardContent } from '../ui/card';

export interface OpsHealthSummaryProps {
  deliveryRate?: number | null;
  totalSent?: number | null;
  avgSpeedMs?: number | null;
  costSavedUsd?: number | null;
}

export function OpsHealthSummary({
  deliveryRate,
  totalSent: _totalSent,
  avgSpeedMs,
  costSavedUsd,
}: OpsHealthSummaryProps) {
  const { t } = useI18n();

  return (
    <Card className="glass-panel border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-2xs overflow-hidden relative">
      <CardContent className="p-5 sm:p-6 relative">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          {/* Main Status Headline & Context */}
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-xs">
              <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 dark:text-white tracking-tight whitespace-normal sm:whitespace-nowrap">
                  Service overview
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 whitespace-nowrap shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Live observations
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed max-w-xl">
                Unavailable measurements are shown explicitly.
              </p>
            </div>
          </div>

          {/* Clean Executive Highlight Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
            {/* Delivery Health */}
            <div className="flex items-center gap-3 p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <HeartPulse className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {t('mode.deliverySuccess')}
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {deliveryRate ?? 'Unavailable'}%
                </div>
              </div>
            </div>

            {/* Edge Speed */}
            <div className="flex items-center gap-3 p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {t('mode.averageDeliverySpeed')}
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-amber-600 dark:text-amber-400">
                  {avgSpeedMs == null
                    ? 'Unavailable'
                    : avgSpeedMs < 1000
                      ? `${avgSpeedMs}ms`
                      : `${(avgSpeedMs / 1000).toFixed(2)}s`}
                </div>
              </div>
            </div>

            {/* Total WhatsApp Cost Saved */}
            <div className="col-span-2 sm:col-span-1 flex items-center gap-3 p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {t('mode.totalCostSaved')}
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-indigo-600 dark:text-indigo-400">
                  ${costSavedUsd?.toFixed(2) ?? 'Unavailable'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
