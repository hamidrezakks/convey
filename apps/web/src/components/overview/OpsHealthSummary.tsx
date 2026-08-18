import { CheckCircle2, DollarSign, HeartPulse, Zap } from 'lucide-react';
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
  totalSent: _totalSent,
  avgSpeedMs = 12,
  costSavedUsd = 12.6,
}: OpsHealthSummaryProps) {
  const { t } = useI18n();

  return (
    <Card className="glass-panel border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-white/85 dark:via-slate-900/85 to-sky-500/5 shadow-lg dark:shadow-2xl overflow-hidden relative">
      {/* Decorative ambient glow */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 -mb-8 w-36 h-36 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

      <CardContent className="p-5 sm:p-6 relative">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          {/* Main Status Headline & Context */}
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.25]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 dark:text-white tracking-tight whitespace-normal sm:whitespace-nowrap">
                  {t('mode.systemHealthy')}
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap shrink-0 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  100% Operational
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed max-w-xl">
                {t('mode.systemHealthyDesc')}
              </p>
            </div>
          </div>

          {/* Clean Executive Highlight Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
            {/* Delivery Health */}
            <div className="flex items-center gap-3 p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-white/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-sm shadow-xs">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <HeartPulse className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {t('mode.deliverySuccess')}
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {deliveryRate}%
                </div>
              </div>
            </div>

            {/* Edge Speed */}
            <div className="flex items-center gap-3 p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-white/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-sm shadow-xs">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {t('mode.averageDeliverySpeed')}
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-amber-600 dark:text-amber-400">
                  {avgSpeedMs < 1000 ? `${avgSpeedMs}ms` : `${(avgSpeedMs / 1000).toFixed(2)}s`}
                </div>
              </div>
            </div>

            {/* Total WhatsApp Cost Saved */}
            <div className="col-span-2 sm:col-span-1 flex items-center gap-3 p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-white/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-sm shadow-xs">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {t('mode.totalCostSaved')}
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-indigo-600 dark:text-indigo-400">
                  ${costSavedUsd.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
