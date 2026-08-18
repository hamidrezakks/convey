import type { DlqFailureCategory, DlqReplayResult } from '@convey/shared';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { Select } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useI18n } from '../i18n/context';
import { api } from '../lib/api';
import { useUiMode } from '../mode';

export function DlqPage() {
  const { t } = useI18n();
  const { isOps, isEngineer } = useUiMode();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Dry-run simulation & blast radius modal
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [simulationResult, setSimulationResult] = useState<DlqReplayResult | null>(null);

  const dlqItems = [
    {
      id: 'dlq_01JAX7100',
      channel: 'EMAIL',
      recipient: 'invalid-mx@nonexistent-domain.xyz',
      teamId: 'team_auth',
      category: 'INVALID_RECIPIENT_400' as DlqFailureCategory,
      errorReason: '550 5.1.1 User unknown / MX lookup failure',
      plainReason: 'Recipient email address domain does not exist',
      attemptsCount: 5,
      failedAt: '8m ago',
    },
    {
      id: 'dlq_01JAX7099',
      channel: 'SMS',
      recipient: '+1 (555) 019-9921',
      teamId: 'team_payments',
      category: 'PROVIDER_5XX' as DlqFailureCategory,
      errorReason: '502 Bad Gateway: Upstream carrier timeout in us-east-1',
      plainReason: 'Temporary network timeout at telecom carrier',
      attemptsCount: 5,
      failedAt: '24m ago',
    },
    {
      id: 'dlq_01JAX7098',
      channel: 'WHATSAPP',
      recipient: '+44 7700 900077',
      teamId: 'team_marketing',
      category: 'RATE_LIMIT_429' as DlqFailureCategory,
      errorReason: '429 Cloud API throughput tier exceeded (80 RPS)',
      plainReason: 'WhatsApp rate limit temporarily exceeded',
      attemptsCount: 5,
      failedAt: '1h ago',
    },
    {
      id: 'dlq_01JAX7097',
      channel: 'PUSH',
      recipient: 'fcm_token_device_981a',
      teamId: 'team_ops',
      category: 'TIMEOUT_504' as DlqFailureCategory,
      errorReason: '504 Gateway Timeout during Google FCM handshake',
      plainReason: 'Google Push Gateway timeout',
      attemptsCount: 5,
      failedAt: '2h ago',
    },
  ];

  const handleStartDryRun = async () => {
    setIsSimulatorOpen(true);
    setIsSimulating(true);
    try {
      const res = await api.replayDlq({
        dryRun: true,
        category: selectedCategory !== 'ALL' ? (selectedCategory as DlqFailureCategory) : undefined,
      });
      setSimulationResult(res);
    } catch (_err) {
      toast.error('Dry-run simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleExecuteLiveReplay = async () => {
    setIsExecuting(true);
    try {
      const res = await api.replayDlq({
        dryRun: false,
        category: selectedCategory !== 'ALL' ? (selectedCategory as DlqFailureCategory) : undefined,
      });
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
      });
      toast.success(`${t('dlq.dryRunSuccess')}: ${res.replayedCount || 84} messages`);
      setIsSimulatorOpen(false);
      setSimulationResult(null);
    } catch (_err) {
      toast.error('Live DLQ replay failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const getCategoryBadgeVariant = (cat: DlqFailureCategory) => {
    switch (cat) {
      case 'PROVIDER_5XX':
        return 'destructive';
      case 'RATE_LIMIT_429':
        return 'warning';
      case 'INVALID_RECIPIENT_400':
        return 'purple';
      case 'TIMEOUT_504':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            {isOps ? (
              <>
                <Briefcase className="w-5 h-5 text-emerald-500" />
                {t('mode.opsDlqTitle')}
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                {t('dlq.title')}
              </>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isOps ? t('mode.opsDlqSubtitle') : t('dlq.subtitle')}
          </p>
        </div>

        <Button variant="glow" size="sm" onClick={handleStartDryRun} className="text-xs gap-1.5 font-bold">
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{isOps ? t('mode.safeRetry') : t('dlq.autoSimulate')}</span>
        </Button>
      </div>

      {/* Ops Mode: Reassurance Card */}
      {isOps && (
        <Card className="glass-panel border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-white/80 dark:via-slate-900/80 to-transparent">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400 shrink-0">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Zero Data Loss Guarantee</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Any customer messages that encountered a temporary provider outage are safely held in queue and can be
                re-sent with one click.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failure Category Cluster Breakdown (Engineer Mode) */}
      {isEngineer && (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Provider 5xx', count: 38, variant: 'destructive', desc: 'Upstream Outages' },
            { label: 'Rate Limit 429', count: 24, variant: 'warning', desc: 'Provider Throttling' },
            { label: 'Timeout 504', count: 12, variant: 'warning', desc: 'Socket Drops' },
            { label: 'Auth Expired', count: 6, variant: 'purple', desc: 'OAuth Refresh' },
            { label: 'Invalid Recipient', count: 4, variant: 'default', desc: 'Syntax / MX Drop' },
            { label: 'Policy Blocked', count: 0, variant: 'cyan', desc: 'Quiet Hours' },
          ].map((cluster) => (
            <Card key={cluster.label} className="glass-card">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  {cluster.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">{cluster.count}</div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{cluster.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* DLQ Filter & Table */}
      <Card className="glass-panel overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('dlq.failedMessages')} (84)
          </CardTitle>
          <div className="w-48">
            <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="ALL">{t('common.all')}</option>
              <option value="PROVIDER_5XX">Provider 5xx Outages</option>
              <option value="RATE_LIMIT_429">Rate Limits (429)</option>
              <option value="TIMEOUT_504">Gateway Timeouts</option>
              <option value="AUTH_EXPIRED_401">Auth Revocations</option>
              <option value="INVALID_RECIPIENT_400">Invalid Recipients</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {isEngineer && <TableHead>{t('dlq.colId')}</TableHead>}
                <TableHead>{t('dlq.colRecipient')}</TableHead>
                <TableHead>{t('dlq.colChannel')}</TableHead>
                <TableHead>{t('dlq.colTeam')}</TableHead>
                {isEngineer && <TableHead>{t('dlq.colCategory')}</TableHead>}
                <TableHead>{isOps ? 'Why It Failed' : t('dlq.colReason')}</TableHead>
                {isEngineer && <TableHead>{t('dlq.colAttempts')}</TableHead>}
                <TableHead>{t('dlq.colFailedAt')}</TableHead>
                {isOps && <TableHead className="text-end rtl:text-left">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dlqItems.map((item) => (
                <TableRow key={item.id} className="group">
                  {isEngineer && (
                    <TableCell className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                      {item.id}
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-xs text-slate-900 dark:text-white truncate max-w-xs">
                    {item.recipient}
                  </TableCell>
                  <TableCell>
                    <Badge variant="cyan">{item.channel}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">{item.teamId}</TableCell>
                  {isEngineer && (
                    <TableCell>
                      <Badge variant={getCategoryBadgeVariant(item.category)}>{item.category}</Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate max-w-md">
                    {isOps ? item.plainReason : item.errorReason}
                  </TableCell>
                  {isEngineer && (
                    <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {item.attemptsCount} / 5
                    </TableCell>
                  )}
                  <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {item.failedAt}
                  </TableCell>
                  {isOps && (
                    <TableCell className="text-end rtl:text-left">
                      <Button variant="outline" size="sm" onClick={handleStartDryRun} className="h-7 text-xs gap-1">
                        <RotateCcw className="w-3 h-3 text-sky-500" />
                        <span>Retry</span>
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dry-Run Blast-Radius Simulator Modal */}
      <Dialog open={isSimulatorOpen} onOpenChange={setIsSimulatorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-500 dark:text-sky-400" />
              <DialogTitle>{t('dlq.dryRunTitle')}</DialogTitle>
            </div>
            <DialogDescription>{t('dlq.dryRunDesc')}</DialogDescription>
          </DialogHeader>

          {isSimulating ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-500 dark:text-sky-400" />
              <p className="text-xs">{t('dlq.simulating')}</p>
            </div>
          ) : simulationResult ? (
            <div className="space-y-4 py-2">
              {/* Simulation Scorecard Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                    {t('dlq.replaySelected')}
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                    {simulationResult.matchedMessagesCount}
                  </div>
                  <span className="text-[10px] text-slate-500">{t('common.filter')}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                    {t('deliverability.healthScore')}
                  </div>
                  <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    {simulationResult.simulation?.estimatedSuccessRatePercent ?? 98.5}%
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400/80">
                    {t('overview.healthyTraffic')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                    {t('providers.colUnitCost')}
                  </div>
                  <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-300 mt-1">
                    ${(simulationResult.simulation?.estimatedApiCostUsd ?? 0.0252).toFixed(4)}
                  </div>
                  <span className="text-[10px] text-slate-500">API</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                    {t('dlq.blastRadiusSim')}
                  </div>
                  <div className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400 mt-1">
                    {simulationResult.simulation?.riskLevel ?? 'LOW'}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {simulationResult.simulation?.affectedTenantsCount ?? 3} {t('deliverability.teamLabel')}
                  </span>
                </div>
              </div>

              {/* Safety Safeguard Check Banner */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">{t('dlq.simLowRisk')}: </span>
                  {t('dlq.dryRunDesc')}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsSimulatorOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="glow"
              size="sm"
              isLoading={isExecuting}
              onClick={handleExecuteLiveReplay}
              className="gap-1.5 font-bold"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {t('dlq.executeLiveReplay')} ({simulationResult?.matchedMessagesCount || 84})
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
