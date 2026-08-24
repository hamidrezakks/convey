import { Channel, SuppressionReason } from '@convey/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Plus, Search, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { type ColumnDef, DataTable } from '../components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { useI18n } from '../i18n/context';
import { api } from '../lib/api';
import { deliverabilityKeys } from '../lib/queryKeys';
import { formatTimeAgo } from '../lib/utils';
import { useUiMode } from '../mode';

export function DeliverabilityPage() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { isOps, isEngineer } = useUiMode();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Add suppression modal state
  const [newRecipient, setNewRecipient] = useState('');
  const [newChannel, setNewChannel] = useState<Channel>(Channel.EMAIL);
  const [newReason, setNewReason] = useState<SuppressionReason>(SuppressionReason.MANUAL_BLOCK);
  const [newTeamId, setNewTeamId] = useState('team_default');

  // TanStack Query: Suppressions List
  const { data: suppressions = [], isLoading } = useQuery({
    queryKey: deliverabilityKeys.suppressions({ search: search || undefined }),
    queryFn: () => api.getSuppressions(search || undefined),
  });

  // TanStack Mutation: Add Suppression
  const addMutation = useMutation({
    mutationFn: (data: { recipient: string; channel: Channel; reason: SuppressionReason; teamId: string }) =>
      api.addSuppression(data),
    onSuccess: (res) => {
      toast.success(`${t('deliverability.addSuppression')}: ${res.recipient}`);
      queryClient.invalidateQueries({ queryKey: deliverabilityKeys.all });
      setIsAddOpen(false);
      setNewRecipient('');
    },
    onError: () => {
      toast.error('Failed to add recipient to suppression list');
    },
  });

  // TanStack Mutation: Remove Suppression
  const removeMutation = useMutation({
    mutationFn: (vars: { id: string; recipient: string }) => api.removeSuppression(vars.id),
    onSuccess: (_, vars) => {
      toast.success(`${t('deliverability.removeSuppression')}: ${vars.recipient}`);
      queryClient.invalidateQueries({ queryKey: deliverabilityKeys.all });
    },
    onError: () => {
      toast.error('Failed to unblock recipient');
    },
  });

  const handleAddSuppression = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipient.trim()) return;
    addMutation.mutate({
      recipient: newRecipient.trim(),
      channel: newChannel,
      reason: newReason,
      teamId: newTeamId.trim() || 'team_default',
    });
  };

  const getReasonBadgeVariant = (reason: SuppressionReason) => {
    switch (reason) {
      case SuppressionReason.SPAM_COMPLAINT:
      case SuppressionReason.HARD_BOUNCE:
        return 'destructive';
      case SuppressionReason.MANUAL_BLOCK:
        return 'warning';
      case SuppressionReason.UNSUBSCRIBE:
        return 'purple';
      default:
        return 'default';
    }
  };

  const getReasonHumanLabel = (reason: SuppressionReason) => {
    switch (reason) {
      case SuppressionReason.SPAM_COMPLAINT:
        return 'Spam Complaint (Auto-Blocked)';
      case SuppressionReason.HARD_BOUNCE:
        return 'Invalid Address / Bounce';
      case SuppressionReason.MANUAL_BLOCK:
        return 'Staff Blocked';
      case SuppressionReason.UNSUBSCRIBE:
        return 'Customer Unsubscribed';
      default:
        return 'Suppressed';
    }
  };

  // Declarative Column Definitions for Suppressions Table
  const columns: ColumnDef<(typeof suppressions)[number]>[] = useMemo(
    () => [
      {
        id: 'id',
        accessorKey: 'id',
        header: t('dlq.colId'),
        hidden: !isEngineer,
        cell: ({ row }) => <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{row.id}</span>,
      },
      {
        id: 'recipient',
        accessorKey: 'recipient',
        header: t('deliverability.colRecipient'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-900 dark:text-white font-medium">{row.recipient}</span>
        ),
      },
      {
        id: 'channel',
        accessorKey: 'channel',
        header: t('deliverability.colChannel'),
        cell: ({ row }) => <Badge variant="cyan">{row.channel}</Badge>,
      },
      {
        id: 'reason',
        header: isOps ? 'Block Reason' : t('deliverability.colReason'),
        cell: ({ row }) =>
          isOps ? (
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {getReasonHumanLabel(row.reason)}
            </span>
          ) : (
            <Badge variant={getReasonBadgeVariant(row.reason)}>{row.reason}</Badge>
          ),
      },
      {
        id: 'teamId',
        accessorKey: 'teamId',
        header: t('deliverability.colTeam'),
        cell: ({ row }) => <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{row.teamId}</span>,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: t('deliverability.colDate'),
        cell: ({ row }) => (
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{formatTimeAgo(row.createdAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: t('common.actions'),
        align: 'end',
        cell: ({ row }) => (
          <div className="inline-flex items-center justify-end">
            <Button
              variant="ghost"
              size="sm"
              isLoading={removeMutation.isPending && removeMutation.variables?.id === row.id}
              onClick={() => removeMutation.mutate({ id: row.id, recipient: row.recipient })}
              className="h-7 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 gap-1 font-semibold"
              title={t('deliverability.unblockConfirm')}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{isOps ? 'Unblock Contact' : t('deliverability.removeSuppression')}</span>
            </Button>
          </div>
        ),
      },
    ],
    [isEngineer, isOps, removeMutation, t],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            {isOps ? (
              <>
                <Briefcase className="w-5 h-5 text-emerald-500 shrink-0" />
                {t('mode.opsDeliverabilityTitle')}
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0" />
                {t('deliverability.title')}
              </>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isOps ? t('mode.opsDeliverabilitySubtitle') : t('deliverability.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="text-xs gap-1.5 font-semibold rounded-xl shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isOps ? 'Block a Contact' : t('deliverability.addSuppression')}</span>
          </Button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              {isOps ? 'Email Sender Protection (SPF)' : 'SPF Authentication'}
            </CardTitle>
            <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">PASS 100%</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isOps ? 'Verified domain ownership' : 'v=spf1 include:_spf.convey.internal ~all'}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              {isOps ? 'Cryptographic Signature (DKIM)' : 'DKIM 2048-bit'}
            </CardTitle>
            <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">100% ALIGNED</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isOps ? 'Tamper-proof email verification' : 'Dual-Key Automatic Rotation'}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              {isOps ? 'Phishing Protection (DMARC)' : 'DMARC Policy'}
            </CardTitle>
            <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400">p=reject (100%)</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isOps ? 'Fake sender protection active' : 'Strict Domain Protection'}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              {t('deliverability.ipWarmupTitle')}
            </CardTitle>
            <Shield className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {t('deliverability.ipWarmupProgress')}
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full w-[85%]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suppression List Table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isOps ? 'Blocked Contacts List' : t('deliverability.suppressions')} ({suppressions.length})
          </h3>
          <div className="w-72">
            <Input
              placeholder={isOps ? 'Search blocked email or phone...' : t('deliverability.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-3.5 h-3.5 text-slate-400" />}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={suppressions}
          isLoading={isLoading}
          getRowKey={(sup) => sup.id}
          emptyState={{
            title: isOps ? 'No blocked contacts' : t('common.noResults'),
            description: isOps
              ? 'No blocked contacts. All recipients are currently eligible for delivery.'
              : 'No suppression records matching current criteria.',
          }}
        />
      </div>

      {/* Add Suppression Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleAddSuppression}>
            <DialogHeader>
              <DialogTitle>{isOps ? 'Block a Contact' : t('deliverability.addSuppression')}</DialogTitle>
              <DialogDescription>
                {isOps
                  ? 'Add an email address or phone number to the suppression list to prevent future message sends.'
                  : t('deliverability.subtitle')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('deliverability.recipientLabel')}
                </label>
                <Input
                  placeholder="user@example.com / +15550192831"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('deliverability.channelLabel')}
                  </label>
                  <Select value={newChannel} onChange={(e) => setNewChannel(e.target.value as Channel)}>
                    <option value={Channel.EMAIL}>Email</option>
                    <option value={Channel.SMS}>SMS</option>
                    <option value={Channel.WHATSAPP}>WhatsApp</option>
                    <option value={Channel.PUSH}>Push</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('deliverability.reasonLabel')}
                  </label>
                  <Select value={newReason} onChange={(e) => setNewReason(e.target.value as SuppressionReason)}>
                    <option value={SuppressionReason.MANUAL_BLOCK}>
                      {isOps ? 'Manual Block' : t('deliverability.manualBlock')}
                    </option>
                    <option value={SuppressionReason.SPAM_COMPLAINT}>
                      {isOps ? 'Spam Complaint' : t('deliverability.spamComplaint')}
                    </option>
                    <option value={SuppressionReason.HARD_BOUNCE}>
                      {isOps ? 'Invalid Email (Hard Bounce)' : t('deliverability.hardBounce')}
                    </option>
                    <option value={SuppressionReason.UNSUBSCRIBE}>
                      {isOps ? 'Unsubscribe Request' : t('deliverability.unsubscribe')}
                    </option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('deliverability.teamLabel')}
                </label>
                <Input placeholder="team_default" value={newTeamId} onChange={(e) => setNewTeamId(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
                className="rounded-xl"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={addMutation.isPending}
                className="rounded-xl font-semibold shadow-2xs"
              >
                {isOps ? 'Confirm Block' : t('deliverability.addSuppression')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
