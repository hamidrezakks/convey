import React, { useEffect, useState } from 'react';
import { Channel, CircuitState, type ProviderHealthDto } from '@convey/shared';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Cpu,
  HelpCircle,
  Play,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { api } from '../lib/api';
import { formatDurationMs, formatNumber } from '../lib/utils';

export function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderHealthDto[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Ramp / Override Modal state
  const [activeProvider, setActiveProvider] = useState<ProviderHealthDto | null>(null);
  const [overrideAction, setOverrideAction] = useState<'CLOSE' | 'FORCE_OPEN' | 'FORCE_HALF_OPEN'>('FORCE_HALF_OPEN');
  const [rampPercent, setRampPercent] = useState(20);
  const [isUpdating, setIsUpdating] = useState(false);
  const [probingProviderId, setProbingProviderId] = useState<string | null>(null);

  const fetchProviders = async () => {
    setIsLoading(true);
    try {
      const data = await api.getProviders();
      setProviders(data);
    } catch (err) {
      console.error('Failed to load providers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

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

  const handleApplyOverride = async () => {
    if (!activeProvider) return;
    setIsUpdating(true);
    try {
      await api.setProviderCircuit(activeProvider.providerId, overrideAction, rampPercent);
      toast.success(`Circuit state for ${activeProvider.displayName} set to ${overrideAction}`);
      setActiveProvider(null);
      fetchProviders();
    } catch (err) {
      toast.error('Failed to update circuit state');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRunCanary = async (providerId: string) => {
    setProbingProviderId(providerId);
    try {
      const res = await api.triggerCanary(providerId);
      toast.success(`Synthetic canary probe passed for ${providerId} (Latency: ${res.result?.latencyMs || 45}ms)`);
      fetchProviders();
    } catch (err) {
      toast.error(`Canary probe failed for ${providerId}`);
    } finally {
      setProbingProviderId(null);
    }
  };

  const filteredProviders = providers.filter(
    (p) => selectedChannel === 'ALL' || p.channel === selectedChannel,
  );

  const closedCount = providers.filter((p) => p.state === CircuitState.CLOSED).length;
  const halfOpenCount = providers.filter((p) => p.state === CircuitState.HALF_OPEN).length;
  const openCount = providers.filter((p) => p.state === CircuitState.OPEN).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Radio className="w-5 h-5 text-sky-400" />
            Provider Matrix & Circuit Breaker Cockpit
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time circuit states, stepped half-open traffic ramps, autonomous self-healing canary probes, and EMA latency scorecards.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchProviders} className="text-xs gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Summary KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Total Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-white">{providers.length}</div>
            <p className="text-xs text-slate-400 mt-1">Multi-Channel Matrix</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-400 uppercase">Closed (Healthy)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">{closedCount}</div>
            <p className="text-xs text-slate-400 mt-1">100% Traffic Allowed</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-amber-400 uppercase">Half-Open (Ramping)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-amber-300">{halfOpenCount}</div>
            <p className="text-xs text-slate-400 mt-1">Stepped Probe Admission</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-rose-400 uppercase">Open (Tripped)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-rose-400">{openCount}</div>
            <p className="text-xs text-slate-400 mt-1">Auto-Fallback Engaged</p>
          </CardContent>
        </Card>
      </div>

      {/* Channel Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {['ALL', Channel.EMAIL, Channel.SMS, Channel.WHATSAPP, Channel.PUSH, Channel.SLACK, Channel.TOOL].map(
          (chan) => (
            <Button
              key={chan}
              variant={selectedChannel === chan ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedChannel(chan)}
              className="text-xs font-medium"
            >
              {chan}
            </Button>
          ),
        )}
      </div>

      {/* Providers Matrix Table */}
      <Card className="glass-panel overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider Adapter</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Circuit State</TableHead>
                <TableHead>Ramp %</TableHead>
                <TableHead>EMA Latency</TableHead>
                <TableHead>24h Success</TableHead>
                <TableHead>Z-Score Anomaly</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-400" />
                    Loading provider scorecards...
                  </TableCell>
                </TableRow>
              ) : (
                filteredProviders.map((p) => (
                  <TableRow key={p.providerId} className="group">
                    <TableCell>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{p.displayName}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{p.providerId}</span>
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

                    <TableCell className="font-mono text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p.state === CircuitState.CLOSED
                                ? 'bg-emerald-500'
                                : p.state === CircuitState.HALF_OPEN
                                  ? 'bg-amber-400'
                                  : 'bg-rose-500'
                            }`}
                            style={{ width: `${p.rampPercentage}%` }}
                          />
                        </div>
                        <span>{p.rampPercentage}%</span>
                      </div>
                    </TableCell>

                    <TableCell className="font-mono text-xs text-sky-300">
                      {formatDurationMs(p.emaLatencyMs)}
                    </TableCell>

                    <TableCell className="font-mono text-xs text-emerald-400">
                      {p.rollingSuccessRatePercent.toFixed(1)}%
                    </TableCell>

                    <TableCell className="font-mono text-xs">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          p.anomalyZScore > 3.0
                            ? 'bg-rose-500/20 text-rose-400 font-bold'
                            : 'text-slate-400'
                        }`}
                      >
                        Z: {p.anomalyZScore.toFixed(2)}
                      </span>
                    </TableCell>

                    <TableCell className="font-mono text-xs text-slate-400">
                      ${p.unitCostUsd.toFixed(5)}
                    </TableCell>

                    <TableCell className="text-right space-x-2">
                      {/* Synthetic Canary Probe Button */}
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={probingProviderId === p.providerId}
                        onClick={() => handleRunCanary(p.providerId)}
                        className="h-7 text-xs gap-1 hover:border-sky-500/40"
                        title="Run autonomous synthetic probe"
                      >
                        <Sparkles className="w-3 h-3 text-sky-400" />
                        <span>Canary</span>
                      </Button>

                      {/* Manual Override Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenOverrideModal(p)}
                        className="h-7 text-xs gap-1 hover:border-amber-500/40"
                      >
                        <Sliders className="w-3 h-3 text-amber-400" />
                        <span>Circuit</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Circuit Override & Ramp Modal */}
      <Dialog open={!!activeProvider} onOpenChange={(open) => !open && setActiveProvider(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Circuit Breaker Manual Override</DialogTitle>
            <DialogDescription>
              Adjust circuit breaker state and traffic admission ramp for{' '}
              <span className="font-semibold text-white">{activeProvider?.displayName}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Target Circuit State</label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={overrideAction === 'CLOSE' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setOverrideAction('CLOSE')}
                  className="text-xs"
                >
                  CLOSED (100%)
                </Button>
                <Button
                  type="button"
                  variant={overrideAction === 'FORCE_HALF_OPEN' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setOverrideAction('FORCE_HALF_OPEN')}
                  className="text-xs"
                >
                  HALF-OPEN (Ramp)
                </Button>
                <Button
                  type="button"
                  variant={overrideAction === 'FORCE_OPEN' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setOverrideAction('FORCE_OPEN')}
                  className="text-xs"
                >
                  FORCE OPEN
                </Button>
              </div>
            </div>

            {overrideAction === 'FORCE_HALF_OPEN' && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Gradual Traffic Ramp</span>
                  <span className="font-mono text-sky-400 font-bold">{rampPercent}%</span>
                </div>
                <Slider
                  value={rampPercent}
                  min={5}
                  max={100}
                  step={5}
                  onValueChange={setRampPercent}
                />
                <p className="text-[11px] text-slate-400">
                  Admit {rampPercent}% of traffic to verify recovery before 100% full restoration.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActiveProvider(null)}>
              Cancel
            </Button>
            <Button variant="glow" size="sm" isLoading={isUpdating} onClick={handleApplyOverride}>
              Apply State Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
