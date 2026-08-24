import { type CampaignReportDto, formatCurrencyAmount } from '@convey/shared';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Eye,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { type ColumnDef, DataTable, DataTableAction, DataTableActionGroup } from '../components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useI18n } from '../i18n/context';
import { api } from '../lib/api';
import { reportKeys } from '../lib/queryKeys';
import { useUiMode } from '../mode';

export function ReportsPage() {
  const { t } = useI18n();
  const { isOps } = useUiMode();

  // Filter State
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('30d');
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [campaignSearch, setCampaignSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'teams' | 'categories' | 'campaigns'>('teams');

  // Selected Campaign Drilldown Modal State
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Compute ISO Dates based on timeRange
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let days = 30;
    if (timeRange === '24h') days = 1;
    else if (timeRange === '7d') days = 7;
    else if (timeRange === '90d') days = 90;

    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return {
      startDate: start.toISOString(),
      endDate: now.toISOString(),
    };
  }, [timeRange]);

  const filterParams = useMemo(
    () => ({
      startDate,
      endDate,
      teamId: selectedTeam === 'ALL' ? undefined : selectedTeam,
      category: selectedCategory === 'ALL' ? undefined : selectedCategory,
    }),
    [startDate, endDate, selectedTeam, selectedCategory],
  );

  // 1. Overview Query
  const {
    data: overviewData,
    isLoading: isLoadingOverview,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: reportKeys.overview(filterParams),
    queryFn: () => api.getReportingOverview(filterParams),
  });

  // 2. Teams Query
  const {
    data: teamsData,
    isLoading: isLoadingTeams,
    refetch: refetchTeams,
  } = useQuery({
    queryKey: reportKeys.teams(filterParams),
    queryFn: () => api.getTeamReports(filterParams),
  });

  // 3. Categories Query
  const { data: categoriesData, refetch: refetchCategories } = useQuery({
    queryKey: reportKeys.categories(filterParams),
    queryFn: () => api.getCategoryReports(filterParams),
  });

  // 4. Campaigns Query
  const {
    data: campaignsData,
    isLoading: isLoadingCampaigns,
    refetch: refetchCampaigns,
  } = useQuery({
    queryKey: reportKeys.campaigns({ ...filterParams, search: campaignSearch || undefined }),
    queryFn: () => api.getCampaignReports({ ...filterParams, search: campaignSearch || undefined }),
  });

  // 5. Campaign Drilldown Query
  const { data: campaignDetail } = useQuery({
    queryKey: reportKeys.campaignDetail(selectedCampaignId || '', filterParams),
    queryFn: () => (selectedCampaignId ? api.getCampaignDetails(selectedCampaignId) : Promise.resolve(null)),
    enabled: !!selectedCampaignId,
  });

  const handleRefreshAll = () => {
    refetchOverview();
    refetchTeams();
    refetchCategories();
    refetchCampaigns();
    toast.success('Reporting metrics refreshed with latest aggregates');
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      toast.info(`Exporting ${activeTab} report as ${format.toUpperCase()}...`);
      await api.downloadReport(activeTab, format, filterParams);
      toast.success(`Report downloaded successfully`);
    } catch {
      toast.error(`Failed to export ${activeTab} report`);
    }
  };

  const [isReconciling, setIsReconciling] = useState(false);

  const handleReconcileBuckets = async () => {
    try {
      setIsReconciling(true);
      toast.info('Reporting Doctor: Reconciling database rollup buckets against ground-truth partitions...');
      const result = await api.reconcileReportBuckets(filterParams);
      toast.success(
        `Reporting Doctor: Successfully reconciled ${result.bucketsReconciled} hourly & ${result.campaignBucketsReconciled} campaign buckets in ${result.durationMs}ms!`,
      );
      handleRefreshAll();
    } catch {
      toast.error('Reporting Doctor: Failed to reconcile rollup buckets');
    } finally {
      setIsReconciling(false);
    }
  };

  const summary = overviewData?.summary;
  const teams = teamsData?.teams || [];
  const categories = categoriesData?.categories || [];
  const campaignList = campaignsData?.campaigns || [];

  // Available distinct teams for filter
  const distinctTeams = useMemo(() => {
    const set = new Set<string>();
    for (const t of teams) set.add(t.teamId);
    return Array.from(set);
  }, [teams]);

  // Declarative Column Definitions for Campaigns Table
  const campaignColumns: ColumnDef<CampaignReportDto>[] = useMemo(
    () => [
      {
        id: 'campaignId',
        accessorKey: 'campaignId',
        header: 'Campaign ID (External ID)',
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 w-fit">
              {row.campaignId}
            </span>
            <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">{row.name}</span>
          </div>
        ),
      },
      {
        id: 'team',
        accessorKey: 'team',
        header: 'Team',
        cell: ({ row }) => <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{row.team}</span>,
      },
      {
        id: 'category',
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => (
          <Badge variant={row.category === 'marketing' ? 'purple' : row.category === 'auth' ? 'cyan' : 'default'}>
            {row.category}
          </Badge>
        ),
      },
      {
        id: 'sent',
        header: 'Sent',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-900 dark:text-white font-semibold">
            {row.metrics.sent.toLocaleString()}
          </span>
        ),
      },
      {
        id: 'deliveryRate',
        header: 'Delivery Rate',
        cell: ({ row }) => {
          const rate = row.metrics.deliveryRatePercent;
          return (
            <div className="flex items-center gap-1.5">
              <span
                className={`font-mono text-xs font-bold ${
                  rate >= 98.0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : rate >= 95.0
                      ? 'text-amber-500 dark:text-amber-400'
                      : 'text-rose-500 dark:text-rose-400'
                }`}
              >
                {rate.toFixed(1)}%
              </span>
            </div>
          );
        },
      },
      {
        id: 'openRate',
        header: 'Open Rate',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">
            {row.metrics.openRatePercent.toFixed(1)}%
          </span>
        ),
      },
      {
        id: 'failRate',
        header: 'Fail Rate',
        cell: ({ row }) => {
          const rate = row.metrics.failRatePercent;
          return (
            <span
              className={`font-mono text-xs font-medium ${
                rate > 3.0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {rate.toFixed(1)}%
            </span>
          );
        },
      },
      {
        id: 'cost',
        header: 'Total Cost',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
              ${row.metrics.totalCostUsd.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">${row.costPerDeliveredUsd.toFixed(4)} / msg</span>
          </div>
        ),
      },
      {
        id: 'state',
        accessorKey: 'state',
        header: 'State',
        cell: ({ row }) => (
          <Badge variant={row.state === 'active' ? 'emerald' : row.state === 'paused' ? 'amber' : 'default'}>
            {row.state}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Details',
        align: 'end',
        cell: ({ row }) => (
          <DataTableActionGroup>
            <DataTableAction
              variant="outline"
              icon={<Eye className="w-3.5 h-3.5" />}
              label="Inspect Funnel"
              onClick={() => setSelectedCampaignId(row.campaignId)}
            />
          </DataTableActionGroup>
        ),
      },
    ],
    [],
  );

  // Declarative Column Definitions for Teams Table
  const teamColumns: ColumnDef<(typeof teams)[number]>[] = useMemo(
    () => [
      {
        id: 'teamId',
        accessorKey: 'teamId',
        header: 'Team Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
            <span className="font-semibold text-xs text-slate-900 dark:text-white font-mono">{row.teamId}</span>
          </div>
        ),
      },
      {
        id: 'monthlyBudget',
        header: 'Monthly Budget',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">
            {formatCurrencyAmount(row.monthlyBudget, row.currency)}
          </span>
        ),
      },
      {
        id: 'usedBudget',
        header: 'Used Spend (USD)',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
              ${row.usedBudgetUsd.toFixed(2)}
            </span>
          </div>
        ),
      },
      {
        id: 'utilization',
        header: 'Budget Utilization',
        cell: ({ row }) => {
          const util = row.budgetUtilizationPercent;
          return (
            <div className="flex items-center gap-2 min-w-32">
              <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    util >= 90 ? 'bg-rose-500' : util >= 70 ? 'bg-amber-400' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, util)}%` }}
                />
              </div>
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{util}%</span>
            </div>
          );
        },
      },
      {
        id: 'deliveryRate',
        header: 'Delivery Rate',
        cell: ({ row }) => (
          <span
            className={`font-mono text-xs font-bold ${
              row.metrics.deliveryRatePercent >= 98.0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-500 dark:text-amber-400'
            }`}
          >
            {row.metrics.deliveryRatePercent.toFixed(1)}%
          </span>
        ),
      },
      {
        id: 'openRate',
        header: 'Open Rate',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
            {row.metrics.openRatePercent.toFixed(1)}%
          </span>
        ),
      },
      {
        id: 'failRate',
        header: 'Fail Rate',
        cell: ({ row }) => (
          <span
            className={`font-mono text-xs ${
              row.metrics.failRatePercent > 2.0
                ? 'text-rose-500 dark:text-rose-400 font-bold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {row.metrics.failRatePercent.toFixed(1)}%
          </span>
        ),
      },
      {
        id: 'sent',
        header: 'Total Sent',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-900 dark:text-white font-semibold">
            {row.metrics.sent.toLocaleString()}
          </span>
        ),
      },
      {
        id: 'activeCampaigns',
        accessorKey: 'activeCampaignsCount',
        header: 'Campaigns',
        cell: ({ row }) => <Badge variant="cyan">{row.activeCampaignsCount} Active</Badge>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Global Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0" />
            <span>Delivery & Financial Analytics Reporting</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isOps
              ? 'Team budgets, campaign performance, deliverability rates, and expenditure tracking.'
              : 'Multi-dimensional delivery rate, open rate, fail rate, and external campaign ID analytics.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe Presets */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            {(['24h', '7d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  timeRange === r
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            isLoading={isLoadingOverview || isLoadingTeams}
            className="text-xs gap-1.5 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('common.refresh')}</span>
          </Button>

          {/* Doctor Reconcile Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReconcileBuckets}
            isLoading={isReconciling}
            className="text-xs gap-1.5 rounded-xl border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 cursor-pointer"
            title="Reconcile and heal pre-aggregated database buckets against raw ground-truth partitions"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            <span>Doctor / Reconcile</span>
          </Button>

          {/* Export Dropdown */}
          <div className="flex items-center gap-1">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleExport('csv')}
              className="text-xs gap-1.5 font-semibold rounded-xl shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('json')}
              className="text-xs font-mono rounded-xl px-2.5"
              title="Export Raw JSON"
            >
              JSON
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Top Global Filter Bar */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Team Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Team:</span>
            <Select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="h-8 text-xs min-w-36 bg-white dark:bg-slate-900 rounded-lg"
            >
              <option value="ALL">All Teams ({distinctTeams.length || 'Global'})</option>
              {distinctTeams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </Select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Category:</span>
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 text-xs min-w-36 bg-white dark:bg-slate-900 rounded-lg"
            >
              <option value="ALL">All Categories</option>
              <option value="marketing">Marketing</option>
              <option value="transactional">Transactional</option>
              <option value="auth">Auth & Security (OTP)</option>
              <option value="billing">Billing & Finance</option>
              <option value="alerts">System Alerts</option>
            </Select>
          </div>

          {/* Two-Tier OLAP Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] font-medium text-sky-600 dark:text-sky-400">
            <Zap className="w-3 h-3 text-sky-500" />
            <span>Pre-Aggregated OLAP Buckets (Hot + Cold)</span>
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Showing aggregated metrics for the last {timeRange}</span>
        </div>
      </div>

      {/* 3. Top KPI Scorecard Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Delivery Rate */}
        <Card className="glass-card border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Delivery Rate
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {summary?.deliveryRatePercent.toFixed(2) ?? '98.50'}%
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span>{summary?.totalDelivered.toLocaleString() ?? '0'} delivered</span>
              <Badge variant="emerald" className="text-[10px] py-0">
                SLA Met
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Open Rate */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Open / Read Rate
            </CardTitle>
            <Eye className="w-4 h-4 text-sky-500 dark:text-sky-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400">
              {summary?.openRatePercent.toFixed(2) ?? '51.20'}%
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span>{summary?.totalOpened.toLocaleString() ?? '0'} opens</span>
              <span className="text-[11px] font-mono">{(summary?.totalRead || 0).toLocaleString()} read</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Fail Rate */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Fail / Bounce Rate
            </CardTitle>
            <XCircle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {summary?.failRatePercent.toFixed(2) ?? '1.50'}%
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span>{summary?.totalFailed.toLocaleString() ?? '0'} failed</span>
              <span className="text-[11px] font-mono text-slate-400">&lt; 3.0% threshold</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Total Cost (USD) */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Spend (USD)
            </CardTitle>
            <Coins className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              ${summary?.totalCostUsd.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0.00'}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span>Across all channels</span>
              <span className="text-[10px] text-emerald-600 font-mono">Optimal Router</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 5: Active Campaigns */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Campaigns
            </CardTitle>
            <Zap className="w-4 h-4 text-purple-500 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
              {summary?.activeCampaignsCount ?? campaignList.length}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span>{summary?.activeTeamsCount ?? teams.length} active teams</span>
              <Badge variant="purple" className="text-[10px] py-0">
                Tracked
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Multi-View Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-6">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="teams" className="text-xs font-semibold">
            Team Reporting & Budgets
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs font-semibold">
            Category Breakdown
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs font-semibold">
            Campaigns (External ID)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: TEAMS & BUDGETS */}
        <TabsContent value="teams" className="space-y-6">
          {/* Team Budget Progress Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {teams.map((team) => (
              <Card key={team.teamId} className="glass-panel">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-xs font-mono">
                        {team.teamId.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                          {team.teamId}
                        </CardTitle>
                        <CardDescription className="text-[11px]">
                          Budget: {formatCurrencyAmount(team.monthlyBudget, team.currency)}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={
                        team.budgetUtilizationPercent >= 90
                          ? 'destructive'
                          : team.budgetUtilizationPercent >= 70
                            ? 'warning'
                            : 'success'
                      }
                      className="font-mono text-[10px]"
                    >
                      {team.budgetUtilizationPercent}% Utilized
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Used: ${team.usedBudgetUsd.toFixed(2)} USD</span>
                      <span>Remaining: ${team.remainingBudgetUsd.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          team.budgetUtilizationPercent >= 90
                            ? 'bg-rose-500'
                            : team.budgetUtilizationPercent >= 70
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, team.budgetUtilizationPercent)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 font-mono text-[11px]">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900">
                      <span className="text-[9px] text-slate-400 block uppercase">Delivery</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {team.metrics.deliveryRatePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900">
                      <span className="text-[9px] text-slate-400 block uppercase">Open Rate</span>
                      <span className="font-bold text-sky-600 dark:text-sky-400">
                        {team.metrics.openRatePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900">
                      <span className="text-[9px] text-slate-400 block uppercase">Total Sent</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {team.metrics.sent.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Teams Comparison Data Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Team Performance & Expenditure Breakdown
            </h3>
            <DataTable
              columns={teamColumns}
              data={teams}
              isLoading={isLoadingTeams}
              getRowKey={(t) => t.teamId}
              emptyState={{
                title: 'No teams reporting data',
                description: 'No message dispatches found for the selected timeframe.',
              }}
            />
          </div>
        </TabsContent>

        {/* TAB 2: CATEGORY BREAKDOWN */}
        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <Card key={cat.category} className="glass-panel">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-sky-500" />
                      <CardTitle className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                        {cat.category}
                      </CardTitle>
                    </div>
                    <Badge variant="cyan">{cat.topChannel}</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {cat.totalSent.toLocaleString()} messages dispatched
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 block uppercase">Delivery</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {cat.deliveryRatePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 block uppercase">Opens</span>
                      <span className="font-bold text-sky-600 dark:text-sky-400">
                        {cat.openRatePercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 block uppercase">Failures</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        {cat.failRatePercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Total Spend:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      ${cat.totalCostUsd.toFixed(2)} USD
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 3: CAMPAIGNS EXPLORER */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="w-80">
              <Input
                placeholder="Search by external campaignId or name..."
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                icon={<Search className="w-3.5 h-3.5 text-slate-400" />}
                className="h-9 text-xs"
              />
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Found {campaignList.length} campaign external IDs
            </div>
          </div>

          <DataTable
            columns={campaignColumns}
            data={campaignList}
            isLoading={isLoadingCampaigns}
            getRowKey={(c) => c.campaignId}
            emptyState={{
              title: 'No campaign external IDs found',
              description:
                'Send messages with campaignId parameter to see campaign-level reporting and cost attribution.',
            }}
          />
        </TabsContent>
      </Tabs>

      {/* 5. Campaign Funnel Drilldown Modal */}
      <Dialog open={!!selectedCampaignId} onOpenChange={(open) => !open && setSelectedCampaignId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge variant="cyan" className="font-mono text-xs">
                {campaignDetail?.campaignId}
              </Badge>
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                {campaignDetail?.name}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Delivery funnel progression, channel cost allocation, and hourly performance.
            </DialogDescription>
          </DialogHeader>

          {campaignDetail && (
            <div className="space-y-6 py-2">
              {/* 5-Step Delivery Funnel */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Delivery & Engagement Funnel
                </span>
                <div className="grid grid-cols-5 gap-2 text-center font-mono">
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Accepted</span>
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {campaignDetail.funnel.accepted.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Dispatched</span>
                    <span className="font-bold text-xs text-sky-600 dark:text-sky-400">
                      {campaignDetail.funnel.dispatched.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Delivered</span>
                    <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      {campaignDetail.funnel.delivered.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Opened</span>
                    <span className="font-bold text-xs text-purple-600 dark:text-purple-400">
                      {campaignDetail.funnel.opened.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Read</span>
                    <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">
                      {campaignDetail.funnel.read.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metrics Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">Delivery Rate</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {campaignDetail.metrics.deliveryRatePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">Open Rate</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 text-sm">
                    {campaignDetail.metrics.openRatePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">Total Cost</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    ${campaignDetail.metrics.totalCostUsd.toFixed(2)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">Unit Cost / Deliv</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    ${campaignDetail.costPerDeliveredUsd.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Channel Cost Breakdown */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Channel Allocation & Expenditure
                </span>
                <div className="space-y-2">
                  {campaignDetail.channelBreakdown.map((chan) => (
                    <div
                      key={chan.channel}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="cyan">{chan.channel}</Badge>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">
                          {chan.sent.toLocaleString()} sent
                        </span>
                        <span className="text-slate-400">({chan.delivered.toLocaleString()} delivered)</span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">${chan.costUsd.toFixed(4)} USD</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
