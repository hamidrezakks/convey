import { Channel, CircuitState, type ProviderHealthDto } from '@convey/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Radio, RefreshCw, Sliders, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { OpsProviderStatus } from '../components/providers/OpsProviderStatus';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Slider } from '../components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
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
      </div>

      {/* =========================================================================
          OPERATIONS VIEW
          ========================================================================= */}
      {isOps && (
        <div className="space-y-6">
          <OpsProviderStatus providers={providers} />

          {/* Simple Provider List */}
          <Card className="glass-panel overflow-hidden">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white">
                Active Provider Connections
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Speed</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead className="text-end rtl:text-left">Quick Test</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-500" />
                        Loading channels...
                      </TableCell>
                    </TableRow>
                  ) : (
                    providers.slice(0, 10).map((p) => (
                      <TableRow key={p.providerId}>
                        <TableCell>
                          <span className="font-semibold text-xs text-slate-900 dark:text-white">{p.displayName}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="cyan">{p.channel}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.state === CircuitState.CLOSED
                                ? 'success'
                                : p.state === CircuitState.HALF_OPEN
                                  ? 'warning'
                                  : 'destructive'
                            }
                            dot
                          >
                            {p.state === CircuitState.CLOSED
                              ? 'Operational'
                              : p.state === CircuitState.HALF_OPEN
                                ? 'Testing'
                                : 'Failover'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                          {formatDurationMs(p.emaLatencyMs ?? 22)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          {(p.rollingSuccessRatePercent ?? 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-end rtl:text-left">
                          <Button
                            variant="outline"
                            size="sm"
                            isLoading={canaryMutation.isPending && canaryMutation.variables === p.providerId}
                            onClick={() => canaryMutation.mutate(p.providerId)}
                            className="h-7 text-xs gap-1"
                          >
                            <Sparkles className="w-3 h-3 text-sky-500" />
                            <span>Test</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
          <Card className="glass-panel overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('providers.colProvider')}</TableHead>
                    <TableHead>{t('providers.colChannel')}</TableHead>
                    <TableHead>{t('providers.colState')}</TableHead>
                    <TableHead>{t('providers.colRamp')}</TableHead>
                    <TableHead>{t('providers.colLatency')}</TableHead>
                    <TableHead>{t('providers.colSuccess24h')}</TableHead>
                    <TableHead>{t('providers.colZScore')}</TableHead>
                    <TableHead>{t('providers.colUnitCost')}</TableHead>
                    <TableHead className="text-end rtl:text-left">{t('providers.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-500 dark:text-sky-400" />
                        {t('providers.loadingScorecards')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProviders.map((p) => (
                      <TableRow key={p.providerId} className="group">
                        <TableCell>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{p.displayName}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {p.providerId}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="cyan">{p.channel}</Badge>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              p.state === CircuitState.CLOSED
                                ? 'success'
                                : p.state === CircuitState.HALF_OPEN
                                  ? 'warning'
                                  : 'destructive'
                            }
                            dot
                          >
                            {p.state}
                          </Badge>
                        </TableCell>

                        <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  p.state === CircuitState.CLOSED
                                    ? 'bg-emerald-500'
                                    : p.state === CircuitState.HALF_OPEN
                                      ? 'bg-amber-400'
                                      : 'bg-rose-500'
                                }`}
                                style={{ width: `${p.rampPercentage ?? 0}%` }}
                              />
                            </div>
                            <span>{p.rampPercentage ?? 0}%</span>
                          </div>
                        </TableCell>

                        <TableCell className="font-mono text-xs text-sky-600 dark:text-sky-300">
                          {formatDurationMs(p.emaLatencyMs ?? 0)}
                        </TableCell>

                        <TableCell className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                          {(p.rollingSuccessRatePercent ?? 100).toFixed(1)}%
                        </TableCell>

                        <TableCell className="font-mono text-xs">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              (p.anomalyZScore ?? 0) > 3.0
                                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            Z: {(p.anomalyZScore ?? 0).toFixed(2)}
                          </span>
                        </TableCell>

                        <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          ${(p.unitCostUsd ?? 0).toFixed(5)}
                        </TableCell>

                        <TableCell className="text-end rtl:text-left space-x-2 rtl:space-x-reverse">
                          <Button
                            variant="secondary"
                            size="sm"
                            isLoading={canaryMutation.isPending && canaryMutation.variables === p.providerId}
                            onClick={() => canaryMutation.mutate(p.providerId)}
                            className="h-7 text-xs gap-1 hover:border-sky-500/40"
                            title={t('providers.canaryTrigger')}
                          >
                            <Sparkles className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                            <span>Canary</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenOverrideModal(p)}
                            className="h-7 text-xs gap-1 hover:border-amber-500/40"
                          >
                            <Sliders className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                            <span>{t('common.edit')}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Circuit Override & Ramp Modal */}
      <Dialog open={!!activeProvider} onOpenChange={(open) => !open && setActiveProvider(null)}>
        <DialogContent className="max-w-lg">
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
                  className="text-xs"
                >
                  {t('providers.stateClosed')}
                </Button>
                <Button
                  type="button"
                  variant={overrideAction === 'FORCE_HALF_OPEN' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setOverrideAction('FORCE_HALF_OPEN')}
                  className="text-xs"
                >
                  {t('providers.stateHalfOpen')}
                </Button>
                <Button
                  type="button"
                  variant={overrideAction === 'FORCE_OPEN' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setOverrideAction('FORCE_OPEN')}
                  className="text-xs"
                >
                  {t('providers.stateOpen')}
                </Button>
              </div>
            </div>

            {overrideAction === 'FORCE_HALF_OPEN' && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
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
            <Button variant="outline" size="sm" onClick={() => setActiveProvider(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="glow" size="sm" isLoading={circuitMutation.isPending} onClick={handleApplyOverride}>
              {t('providers.applyOverride')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
