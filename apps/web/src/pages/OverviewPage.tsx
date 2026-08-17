import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Activity, ArrowUpRight, CheckCircle2, Database, DollarSign, Layers, Radio, Server, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { telemetryKeys } from '../lib/queryKeys';
import { formatDurationMs, formatNumber, formatTimeAgo } from '../lib/utils';
import { useTheme } from '../theme';

export function OverviewPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const [chartData, setChartData] = useState<Array<{ time: string; rps: number; p95: number }>>([]);

  // TanStack Query: Poll live telemetry snapshot every 15s
  const { data: telemetry } = useQuery({
    queryKey: telemetryKeys.live(),
    queryFn: () => api.getLiveTelemetry(),
    refetchInterval: 15000,
  });

  // TanStack Query: Fetch planetary 24h overview stats
  const { data: overviewStats } = useQuery({
    queryKey: telemetryKeys.overview(),
    queryFn: () => api.getOverview(),
    staleTime: 10000,
  });

  useEffect(() => {
    if (telemetry) {
      const timeLabel = new Date().toLocaleTimeString();
      setChartData((prev) => {
        const next = [...prev, { time: timeLabel, rps: telemetry.throughputRps, p95: telemetry.latency.p95Ms }];
        return next.slice(-20);
      });
    }
  }, [telemetry]);

  const isLight = resolvedTheme === 'light';

  return (
    <div className="space-y-6">
      {/* Top Banner & Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{t('overview.title')}</h1>
            <Badge variant="success" dot>
              {t('overview.statusBadge')}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('overview.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate({ to: '/messages' })} className="text-xs gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            <span>{t('overview.exploreMessages')}</span>
          </Button>
          <Button
            variant="glow"
            size="sm"
            onClick={() => navigate({ to: '/composer' })}
            className="text-xs gap-1.5 font-bold"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{t('overview.openSandbox')}</span>
          </Button>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Throughput (RPS) */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('overview.kpiRealTimeIngestion')}
            </CardTitle>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <Zap className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {telemetry ? `${formatNumber(Math.round(telemetry.throughputRps))} /s` : '4,820 /s'}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-semibold">
                <ArrowUpRight className="w-3.5 h-3.5" /> +14.2% peak
              </span>
              <span className="text-slate-500 dark:text-slate-400">1-RTT Fast-Path</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: P95 Latency & SLA */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('overview.kpiP95Latency')}
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Activity className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {telemetry ? formatDurationMs(telemetry.latency.p95Ms) : '11.45ms'}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">SLA: &lt;350ms</span>
              <span className="text-slate-500 dark:text-slate-400">
                P99: {telemetry ? formatDurationMs(telemetry.latency.p99Ms) : '28.7ms'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: 24h Delivery Success */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('overview.kpiDeliveryRate')}
            </CardTitle>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {overviewStats?.deliverySuccessRatePercent ?? 99.85}%
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-mono">
                {formatNumber(overviewStats?.metrics24h?.totalIngested ?? 12450)} total
              </span>
              <span className="text-rose-600 dark:text-rose-400 font-mono">
                {overviewStats?.metrics24h?.failed ?? 0} failed
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: WhatsApp Cost Savings */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('overview.kpiCostSaved')}
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-300">
              $
              {overviewStats?.whatsappCostSavings?.estimatedUsdSaved !== undefined
                ? overviewStats.whatsappCostSavings.estimatedUsdSaved.toFixed(2)
                : '12.60'}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-mono">
                {overviewStats?.whatsappCostSavings?.templateConvertedToSessionCount ?? 420} sessions
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">Zero-cost plain text</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-Time Chart & Telemetry Graphs */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Cols on XL: Real-Time Ingestion & Latency Live Stream */}
        <Card className="xl:col-span-2 glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400 animate-ping" />
                {t('overview.chartThroughputTitle')}
              </CardTitle>
              <CardDescription>{t('overview.chartThroughputSubtitle')}</CardDescription>
            </div>
            <Badge variant="cyan">{t('common.liveSseActive')}</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.length > 0 ? chartData : [{ time: '0s', rps: 4200, p95: 10 }]}>
                  <defs>
                    <linearGradient id="rpsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={isLight ? 0.25 : 0.4} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="p95Gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9333ea" stopOpacity={isLight ? 0.2 : 0.4} />
                      <stop offset="95%" stopColor="#9333ea" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e2e8f0' : '#1e293b'} />
                  <XAxis dataKey="time" stroke={isLight ? '#94a3b8' : '#64748b'} fontSize={10} />
                  <YAxis yAxisId="left" stroke="#0284c7" fontSize={10} />
                  <YAxis yAxisId="right" orientation="right" stroke="#9333ea" fontSize={10} unit="ms" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: isLight ? '#ffffff' : '#0f172a',
                      borderColor: isLight ? '#e2e8f0' : '#334155',
                      borderRadius: '8px',
                      color: isLight ? '#0f172a' : '#f8fafc',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="rps"
                    name={t('overview.chartRps')}
                    stroke="#0284c7"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#rpsGradient)"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="p95"
                    name={t('overview.chartP95')}
                    stroke="#9333ea"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#p95Gradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Right 1 Col: Queue Topology & Worker Concurrency Radar */}
        <Card className="glass-panel space-y-4">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-sky-500 dark:text-sky-400" />
              {t('overview.queueDepthsTitle')}
            </CardTitle>
            <CardDescription>{t('overview.queueDepthsSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Outbox Relay */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-mono">outbox-relay</span>
                <span className="font-mono text-sky-600 dark:text-sky-400 font-semibold">
                  {telemetry?.queues?.outboxRelayDepth ?? 12} jobs
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, ((telemetry?.queues?.outboxRelayDepth ?? 12) / 50) * 100)}%` }}
                />
              </div>
            </div>

            {/* Message Dispatch */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-mono">message-dispatch</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                  {telemetry?.queues?.messageDispatchDepth ?? 34} jobs
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, ((telemetry?.queues?.messageDispatchDepth ?? 34) / 100) * 100)}%` }}
                />
              </div>
            </div>

            {/* Provider Send */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-mono">provider-send</span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold">
                  {telemetry?.queues?.providerSendDepth ?? 58} jobs
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, ((telemetry?.queues?.providerSendDepth ?? 58) / 150) * 100)}%` }}
                />
              </div>
            </div>

            {/* Active Workers & Memory Guard */}
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Worker Concurrency:</span>
                <span className="text-slate-900 dark:text-white font-mono font-bold">
                  {telemetry?.queues?.activeWorkersCount ?? 24} workers
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">V8 Heap Guard:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                  {telemetry?.runtimeGuard?.v8HeapUsedMb ?? 340}MB / {telemetry?.runtimeGuard?.v8HeapTotalMb ?? 512}MB (
                  {telemetry?.runtimeGuard?.v8HeapSaturationPercent ?? 66}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Event Loop Lag:</span>
                <span className="text-sky-600 dark:text-sky-300 font-mono">
                  {telemetry?.runtimeGuard?.eventLoopLagMs ?? 1.2}ms
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Subsystems Matrix & Live Event Activity Ticker */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Subsystems Matrix */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              {t('overview.subsystemsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">PostgreSQL Pool</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">18 active / 12 idle</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Redis Token Bucket Cluster
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">RTT: 0.45ms</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Monthly Partition Window
                </span>
              </div>
              <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400">
                {telemetry?.subsystems?.activePartition || 'messages_y2026m08'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Provider Circuit Breakers
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                {telemetry?.subsystems?.circuitBreakers?.closed ?? 82} closed /{' '}
                {telemetry?.subsystems?.circuitBreakers?.total ?? 84} total
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Live Event Stream Ticker */}
        <Card className="xl:col-span-2 glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-sky-500 dark:text-sky-400 animate-pulse" />
                {t('overview.recentTrafficTitle')}
              </CardTitle>
              <CardDescription>{t('overview.recentTrafficSubtitle')}</CardDescription>
            </div>
            <Badge variant="cyan">SSE Live</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {telemetry?.recentActivity?.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={act.channel === 'EMAIL' ? 'cyan' : act.channel === 'SMS' ? 'purple' : 'success'}>
                      {act.channel}
                    </Badge>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{act.provider}</span>
                    <span className="text-slate-400 dark:text-slate-500">•</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{act.teamId}</span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-sky-600 dark:text-sky-300">{formatDurationMs(act.latencyMs)}</span>
                    <Badge variant={act.status === 'DELIVERED' ? 'success' : 'default'}>{act.status}</Badge>
                    <span className="text-slate-400 dark:text-slate-500">{formatTimeAgo(act.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
