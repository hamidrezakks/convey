import { Channel, CircuitState, type ProviderHealthDto } from '@convey/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Radio, RefreshCw, Sliders, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { OpsProviderStatus } from '../components/providers/OpsProviderStatus';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { type ColumnDef, DataTable, DataTableAction, DataTableActionGroup } from '../components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Slider } from '../components/ui/slider';
import { useI18n } from '../i18n/context';
import { api } from '../lib/api';
import { providerKeys } from '../lib/queryKeys';
import { formatDurationMs } from '../lib/utils';
import { useUiMode } from '../mode';

export function ProvidersPage() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { isOps, isEngineer } = useUiMode();
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');

  // Ramp / Override Modal state
  const [activeProvider, setActiveProvider] = useState<ProviderHealthDto | null>(null);
  const [overrideAction, setOverrideAction] = useState<'CLOSE' | 'FORCE_OPEN' | 'FORCE_HALF_OPEN'>('FORCE_HALF_OPEN');
  const [rampPercent, setRampPercent] = useState(20);

  // TanStack Query: Load provider matrix
  const { data: providers = [], isLoading } = useQuery({
    queryKey: providerKeys.all,
    queryFn: () => api.getProviders(),
  });

  // TanStack Mutation: Override circuit breaker state
  const circuitMutation = useMutation({
    mutationFn: (vars: {
      providerId: string;
      action: 'CLOSE' | 'FORCE_OPEN' | 'FORCE_HALF_OPEN';
      rampPercentage: number;
    }) => api.setProviderCircuit(vars.providerId, vars.action, vars.rampPercentage),
    onSuccess: (_, vars) => {
      toast.success(`Circuit state for ${vars.providerId} set to ${vars.action}`);
      queryClient.invalidateQueries({ queryKey: providerKeys.all });
      setActiveProvider(null);
    },
    onError: () => {
      toast.error('Failed to update circuit state');
    },
  });

  // TanStack Mutation: Run synthetic canary probe
  const canaryMutation = useMutation({
    mutationFn: (providerId: string) => api.triggerCanary(providerId),
    onSuccess: (res, providerId) => {
      toast.success(`${t('providers.canarySuccess')}: ${providerId} (${res.result?.latencyMs || 45}ms)`);
      queryClient.invalidateQueries({ queryKey: providerKeys.all });
    },
    onError: (_, providerId) => {
      toast.error(`Canary probe failed for ${providerId}`);
    },
  });

  const handleOpenOverrideModal = (provider: ProviderHealthDto) => {
    setActiveProvider(provider);
    setOverrideAction(
      provider.state === CircuitState.OPEN
        ? 'FORCE_HALF_OPEN'
        : provider.state === CircuitState.HALF_OPEN
          ? 'CLOSE'
          : 'FORCE_OPEN',
    );
    setRampPercent(provider.rampPercentage || 20);
  };

  const handleApplyOverride = () => {
    if (!activeProvider) return;
    circuitMutation.mutate({
      providerId: activeProvider.providerId,
      action: overrideAction,
      rampPercentage: rampPercent,
    });
  };

  const filteredProviders = providers.filter((p) => selectedChannel === 'ALL' || p.channel === selectedChannel);

  const closedCount = providers.filter((p) => p.state === CircuitState.CLOSED).length;
  const halfOpenCount = providers.filter((p) => p.state === CircuitState.HALF_OPEN).length;
  const openCount = providers.filter((p) => p.state === CircuitState.OPEN).length;

  // Ops Mode Table Columns
  const opsColumns: ColumnDef<ProviderHealthDto>[] = useMemo(
    () => [
      {
        id: 'displayName',
        accessorKey: 'displayName',
        header: 'Provider',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-semibold text-xs text-slate-900 dark:text-white">{row.displayName}</span>
        ),
      },
      {
        id: 'channel',
        accessorKey: 'channel',
        header: 'Channel',
        enableSorting: true,
        cell: ({ row }) => <Badge variant="cyan">{row.channel}</Badge>,
      },
      {
        id: 'state',
        accessorKey: 'state',
        header: 'Status',
        enableSorting: true,
        cell: ({ row }) => (
          <Badge
            variant={
              row.state === CircuitState.CLOSED
                ? 'success'
                : row.state === CircuitState.HALF_OPEN
                  ? 'warning'
                  : 'destructive'
            }
            dot
          >
            {row.state === CircuitState.CLOSED
              ? 'Operational'
              : row.state === CircuitState.HALF_OPEN
                ? 'Testing'
                : 'Failover'}
          </Badge>
        ),
      },
      {
        id: 'emaLatencyMs',
        accessorKey: 'emaLatencyMs',
        header: 'Speed',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
            {formatDurationMs(row.emaLatencyMs ?? 22)}
          </span>
        ),
      },
      {
        id: 'rollingSuccessRatePercent',
        accessorKey: 'rollingSuccessRatePercent',
        header: 'Success Rate',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            {(row.rollingSuccessRatePercent ?? 100).toFixed(1)}%
          </span>
        ),
      },
      {
        id: 'quickTest',
        header: 'Quick Test',
        align: 'end',
        cell: ({ row }) => (
          <DataTableActionGroup>
            <DataTableAction
              variant="default"
              icon={<Sparkles className="text-sky-500 shrink-0" />}
              label="Test"
              isLoading={canaryMutation.isPending && canaryMutation.variables === row.providerId}
              onClick={() => canaryMutation.mutate(row.providerId)}
            />
          </DataTableActionGroup>
        ),
      },
    ],
    [canaryMutation],
  );

  // Engineer Mode Matrix Columns
  const engineerColumns: ColumnDef<ProviderHealthDto>[] = useMemo(
    () => [
      {
        id: 'provider',
        accessorKey: 'displayName',
        header: t('providers.colProvider'),
        enableSorting: true,
        cell: ({ row }) => (
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>{row.displayName}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{row.providerId}</span>
          </div>
        ),
      },
      {
        id: 'channel',
        accessorKey: 'channel',
        header: t('providers.colChannel'),
        enableSorting: true,
        cell: ({ row }) => <Badge variant="cyan">{row.channel}</Badge>,
      },
      {
        id: 'state',
        accessorKey: 'state',
        header: t('providers.colState'),
        enableSorting: true,
        cell: ({ row }) => (
          <Badge
            variant={
              row.state === CircuitState.CLOSED
                ? 'success'
                : row.state === CircuitState.HALF_OPEN
                  ? 'warning'
                  : 'destructive'
            }
            dot
          >
            {row.state}
          </Badge>
        ),
      },
      {
        id: 'rampPercentage',
        accessorKey: 'rampPercentage',
        header: t('providers.colRamp'),
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-mono text-xs text-slate-700 dark:text-slate-300">
            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  row.state === CircuitState.CLOSED
                    ? 'bg-emerald-500'
                    : row.state === CircuitState.HALF_OPEN
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                }`}
                style={{ width: `${row.rampPercentage ?? 0}%` }}
              />
            </div>
            <span>{row.rampPercentage ?? 0}%</span>
          </div>
        ),
      },
      {
        id: 'emaLatencyMs',
        accessorKey: 'emaLatencyMs',
        header: t('providers.colLatency'),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-sky-600 dark:text-sky-300">
            {formatDurationMs(row.emaLatencyMs ?? 0)}
          </span>
        ),
      },
      {
        id: 'rollingSuccessRatePercent',
        accessorKey: 'rollingSuccessRatePercent',
        header: t('providers.colSuccess24h'),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
            {(row.rollingSuccessRatePercent ?? 100).toFixed(1)}%
          </span>
        ),
      },
      {
        id: 'anomalyZScore',
        accessorKey: 'anomalyZScore',
        header: t('providers.colZScore'),
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className={`font-mono text-xs px-1.5 py-0.5 rounded text-[10px] ${
              (row.anomalyZScore ?? 0) > 3.0
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            Z: {(row.anomalyZScore ?? 0).toFixed(2)}
          </span>
        ),
      },
      {
        id: 'unitCostUsd',
        accessorKey: 'unitCostUsd',
        header: t('providers.colUnitCost'),
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700 dark:text-slate-300">
            <span>{row.formattedUnitCost || `$${(row.unitCostUsd ?? 0).toFixed(4)}`}</span>
            {row.baseCurrency && (
              <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono text-slate-500">
                {row.baseCurrency}
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: 'actions',
        header: t('providers.colActions'),
        align: 'end',
        cell: ({ row }) => (
          <DataTableActionGroup>
            <DataTableAction
              variant="default"
              icon={<Sparkles className="text-sky-500 dark:text-sky-400 shrink-0" />}
              label="Canary"
              title={t('providers.canaryTrigger')}
              isLoading={canaryMutation.isPending && canaryMutation.variables === row.providerId}
              onClick={() => canaryMutation.mutate(row.providerId)}
            />
            <DataTableAction
              variant="outline"
              icon={<Sliders className="text-slate-500 dark:text-slate-400 shrink-0" />}
              label={t('common.edit')}
              onClick={() => handleOpenOverrideModal(row)}
            />
          </DataTableActionGroup>
        ),
      },
    ],
    [canaryMutation, t],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            {isOps ? (
              <>
                <Briefcase className="w-5 h-5 text-emerald-500" />
                {t('mode.opsProvidersTitle')}
              </>
            ) : (
              <>
                <Radio className="w-5 h-5 text-sky-500 dark:text-sky-400" />
                {t('providers.title')}
              </>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isOps ? t('mode.opsProvidersSubtitle') : t('providers.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: providerKeys.all })}
            isLoading={isLoading}
            className="text-xs gap-1.5 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('common.refresh')}</span>
          </Button>
        </div>
      </div>

      {/* =========================================================================
          OPERATIONS VIEW
          ========================================================================= */}
      {isOps && (
        <div className="space-y-6">
          <OpsProviderStatus providers={providers} />

          {/* Simple Provider List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Active Provider Connections</h3>
            </div>
            <DataTable
              columns={opsColumns}
              data={providers.slice(0, 10)}
              isLoading={isLoading}
              getRowKey={(p) => p.providerId}
              emptyState={{
                title: 'No active provider connections',
                description: 'Configure and connect communication providers in settings.',
              }}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          ENGINEERING VIEW (Circuit Matrix & Deep Telemetry)
          ========================================================================= */}
      {isEngineer && (
        <div className="space-y-6">
          {/* Summary KPI Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  {t('providers.totalProviders')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{providers.length}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('overview.multiChannelMatrix')}</p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                  {t('providers.circuitClosed')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{closedCount}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('overview.healthyTraffic')}</p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">
                  {t('providers.circuitHalfOpen')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-300">{halfOpenCount}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('overview.steppedProbe')}</p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase">
                  {t('providers.circuitOpen')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">{openCount}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('overview.autoFallback')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Channel Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              'ALL',
              Channel.EMAIL,
              Channel.SMS,
              Channel.WHATSAPP,
              Channel.CHAT,
              Channel.PUSH,
              Channel.SLACK,
              Channel.TOOL,
            ].map((chan) => (
              <Button
                key={chan}
                variant={selectedChannel === chan ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedChannel(chan)}
                className="text-xs font-medium"
              >
                {chan === 'ALL' ? t('common.all') : chan}
              </Button>
            ))}
          </div>

          {/* Providers Matrix Table */}
          <DataTable
            columns={engineerColumns}
            data={filteredProviders}
            isLoading={isLoading}
            getRowKey={(p) => p.providerId}
            emptyState={{
              title: t('providers.loadingScorecards'),
              description: 'No providers match the selected channel filter.',
            }}
          />
        </div>
      )}

      {/* Circuit Override & Ramp Modal */}
      <Dialog open={!!activeProvider} onOpenChange={(open) => !open && setActiveProvider(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('providers.overrideTitle')}</DialogTitle>
            <DialogDescription>
              {t('providers.overrideDesc')}{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{activeProvider?.displayName}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('providers.targetState')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={overrideAction === 'CLOSE' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setOverrideAction('CLOSE')}
                  className="text-xs rounded-xl"
                >
                  {t('providers.stateClosed')}
                </Button>
                <Button
                  type="button"
                  variant={overrideAction === 'FORCE_HALF_OPEN' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setOverrideAction('FORCE_HALF_OPEN')}
                  className="text-xs rounded-xl"
                >
                  {t('providers.stateHalfOpen')}
                </Button>
                <Button
                  type="button"
                  variant={overrideAction === 'FORCE_OPEN' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setOverrideAction('FORCE_OPEN')}
                  className="text-xs rounded-xl"
                >
                  {t('providers.stateOpen')}
                </Button>
              </div>
            </div>

            {overrideAction === 'FORCE_HALF_OPEN' && (
              <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">{t('providers.gradualRamp')}</span>
                  <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">{rampPercent}%</span>
                </div>
                <Slider value={rampPercent} min={5} max={100} step={5} onValueChange={setRampPercent} />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('providers.admitPercentDesc').replace('{rampPercent}', String(rampPercent))}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActiveProvider(null)} className="rounded-xl">
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={circuitMutation.isPending}
              onClick={handleApplyOverride}
              className="rounded-xl font-semibold shadow-2xs"
            >
              {t('providers.applyOverride')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
