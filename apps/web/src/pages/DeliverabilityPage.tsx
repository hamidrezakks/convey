import { Channel, SuppressionReason } from '@convey/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Plus, RefreshCw, Search, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import type React from 'react';
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
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
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
        return 'Customer Marked as Spam';
      case SuppressionReason.HARD_BOUNCE:
        return 'Email Address Does Not Exist';
      case SuppressionReason.UNSUBSCRIBE:
        return 'Customer Unsubscribed';
      case SuppressionReason.MANUAL_BLOCK:
        return 'Manually Blocked by Team';
      default:
        return String(reason);
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
                {t('mode.opsDeliverabilityTitle')}
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                {t('deliverability.title')}
              </>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isOps ? t('mode.opsDeliverabilitySubtitle') : t('deliverability.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="glow" size="sm" onClick={() => setIsAddOpen(true)} className="text-xs gap-1.5 font-bold">
            <Plus className="w-3.5 h-3.5" />
            <span>{isOps ? 'Block a Contact' : t('deliverability.addSuppression')}</span>
          </Button>
        </div>
      </div>

      {/* Domain Deliverability Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              {isOps ? 'Email Authentication (SPF)' : 'SPF Authentication'}
            </CardTitle>
            <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">100% PASS</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isOps ? 'Verified domain sending permission' : 'v=spf1 include:convey.io ~all'}
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
      <Card className="glass-panel overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isOps ? 'Blocked Contacts List' : t('deliverability.suppressions')} ({suppressions.length})
          </CardTitle>
          <div className="w-72">
            <Input
              placeholder={isOps ? 'Search blocked email or phone...' : t('deliverability.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-3.5 h-3.5 text-slate-400" />}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {isEngineer && <TableHead>{t('dlq.colId')}</TableHead>}
                <TableHead>{t('deliverability.colRecipient')}</TableHead>
                <TableHead>{t('deliverability.colChannel')}</TableHead>
                <TableHead>{isOps ? 'Block Reason' : t('deliverability.colReason')}</TableHead>
                <TableHead>{t('deliverability.colTeam')}</TableHead>
                <TableHead>{t('deliverability.colDate')}</TableHead>
                <TableHead className="text-end rtl:text-left">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isEngineer ? 7 : 6} className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-500 dark:text-sky-400" />
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              ) : suppressions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isEngineer ? 7 : 6} className="text-center py-12 text-slate-500">
                    {isOps
                      ? 'No blocked contacts. All recipients are currently eligible for delivery.'
                      : t('common.noResults')}
                  </TableCell>
                </TableRow>
              ) : (
                suppressions.map((sup) => (
                  <TableRow key={sup.id}>
                    {isEngineer && (
                      <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">{sup.id}</TableCell>
                    )}
                    <TableCell className="font-mono text-xs text-slate-900 dark:text-white font-medium">
                      {sup.recipient}
                    </TableCell>
                    <TableCell>
                      <Badge variant="cyan">{sup.channel}</Badge>
                    </TableCell>
                    <TableCell>
                      {isOps ? (
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {getReasonHumanLabel(sup.reason)}
                        </span>
                      ) : (
                        <Badge variant={getReasonBadgeVariant(sup.reason)}>{sup.reason}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">{sup.teamId}</TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {formatTimeAgo(sup.createdAt)}
                    </TableCell>
                    <TableCell className="text-end rtl:text-left">
                      <Button
                        variant="ghost"
                        size="sm"
                        isLoading={removeMutation.isPending && removeMutation.variables?.id === sup.id}
                        onClick={() => removeMutation.mutate({ id: sup.id, recipient: sup.recipient })}
                        className="h-7 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 gap-1 font-semibold"
                        title={t('deliverability.unblockConfirm')}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>{isOps ? 'Unblock Contact' : t('deliverability.removeSuppression')}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="glow" size="sm" isLoading={addMutation.isPending}>
                {isOps ? 'Confirm Block' : t('deliverability.addSuppression')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
