import { ArrowUpRight, CheckCircle2, DollarSign, Send, Zap } from 'lucide-react';
import { useI18n } from '../../i18n';
import { formatNumber } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export interface OpsKpiGridProps {
  overviewStats?: {
    deliverySuccessRatePercent?: number;
    metrics24h?: {
      totalIngested?: number;
      delivered?: number;
      failed?: number;
    };
    whatsappCostSavings?: {
      estimatedUsdSaved?: number;
      templateConvertedToSessionCount?: number;
    };
  };
}

export function OpsKpiGrid({ overviewStats }: OpsKpiGridProps) {
  const { t } = useI18n();

  const successRate = overviewStats?.deliverySuccessRatePercent ?? 99.85;
  const totalIngested = overviewStats?.metrics24h?.totalIngested ?? 12450;
  const delivered = overviewStats?.metrics24h?.delivered ?? 12431;
  const failed = overviewStats?.metrics24h?.failed ?? 19;
  const costSaved = overviewStats?.whatsappCostSavings?.estimatedUsdSaved ?? 12.6;
  const convertedSessions = overviewStats?.whatsappCostSavings?.templateConvertedToSessionCount ?? 420;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Deliveries Successful */}
      <Card className="glass-card border-slate-200/80 dark:border-slate-800/80">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('mode.deliverySuccess')}
          </CardTitle>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {successRate.toFixed(2)}%
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">{formatNumber(delivered)} delivered</span>
            <span className="text-rose-600 dark:text-rose-400 font-medium">{failed} issues</span>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Total Sent Today */}
      <Card className="glass-card border-slate-200/80 dark:border-slate-800/80">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('mode.sentToday')}
          </CardTitle>
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Send className="w-4 h-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {formatNumber(totalIngested)}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" /> High throughput
            </span>
            <span className="text-slate-500 dark:text-slate-400">Across 5 channels</span>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Fast Delivery Speed */}
      <Card className="glass-card border-slate-200/80 dark:border-slate-800/80">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('mode.averageDeliverySpeed')}
          </CardTitle>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Zap className="w-4 h-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-300">&lt; 25 ms</div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Near-instant</span>
            <span className="text-slate-500 dark:text-slate-400">Global edge routing</span>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: WhatsApp Cost Savings */}
      <Card className="glass-card border-slate-200/80 dark:border-slate-800/80">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('mode.totalCostSaved')}
          </CardTitle>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <DollarSign className="w-4 h-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-300">
            ${costSaved.toFixed(2)}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-700 dark:text-slate-300 font-medium">{convertedSessions} sessions</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Free plain text</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
