import React, { useEffect, useState } from 'react';
import { Channel, type SuppressionDto, SuppressionReason } from '@convey/shared';
import {
  Check,
  CheckCircle2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { api } from '../lib/api';
import { formatTimeAgo } from '../lib/utils';

export function DeliverabilityPage() {
  const [suppressions, setSuppressions] = useState<SuppressionDto[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add suppression modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRecipient, setNewRecipient] = useState('');
  const [newChannel, setNewChannel] = useState<Channel>(Channel.EMAIL);
  const [newReason, setNewReason] = useState<SuppressionReason>(SuppressionReason.MANUAL_BLOCK);
  const [newTeamId, setNewTeamId] = useState('team_default');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSuppressions = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSuppressions(search || undefined);
      setSuppressions(data);
    } catch (err) {
      console.error('Failed to fetch suppressions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppressions();
  }, []);

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipient.trim()) {
      toast.error('Recipient is required');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.addSuppression({
        teamId: newTeamId,
        recipient: newRecipient.trim(),
        channel: newChannel,
        reason: newReason,
      });
      toast.success(`Suppression added for ${newRecipient}`);
      setIsAddOpen(false);
      setNewRecipient('');
      fetchSuppressions();
    } catch (err) {
      toast.error('Failed to add suppression');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSuppression = async (id: string, recipient: string) => {
    try {
      await api.removeSuppression(id);
      toast.success(`Unblocked ${recipient}`);
      fetchSuppressions();
    } catch (err) {
      toast.error('Failed to remove suppression');
    }
  };

  const getReasonBadgeVariant = (reason: SuppressionReason) => {
    switch (reason) {
      case SuppressionReason.HARD_BOUNCE:
        return 'destructive';
      case SuppressionReason.SPAM_COMPLAINT:
        return 'warning';
      case SuppressionReason.UNSUBSCRIBE:
        return 'purple';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Deliverability Autopilot & Suppression Guard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            SPF/DKIM/DMARC domain alignment scorecard, bounce auto-suppression, and opt-out compliance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchSuppressions} className="text-xs gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
          <Button variant="glow" size="sm" onClick={() => setIsAddOpen(true)} className="text-xs gap-1.5 font-bold">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Suppression</span>
          </Button>
        </div>
      </div>

      {/* Domain Deliverability Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">SPF Authentication</CardTitle>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">100% PASS</div>
            <p className="text-xs text-slate-400 mt-1">v=spf1 include:convey.io ~all</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">DKIM 2048-bit</CardTitle>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">100% ALIGNED</div>
            <p className="text-xs text-slate-400 mt-1">Dual-Key Automatic Rotation</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">DMARC Policy</CardTitle>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-sky-400">p=reject (100%)</div>
            <p className="text-xs text-slate-400 mt-1">Strict Domain Protection</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">IP Warmup Progression</CardTitle>
            <Shield className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-white">85% Complete</div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full w-[85%]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Suppression List Table */}
      <Card className="glass-panel overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Active Recipient Suppressions ({suppressions.length})
          </CardTitle>
          <div className="w-72">
            <Input
              placeholder="Search recipient or domain..."
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
                <TableHead>Suppression ID</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Tenant ID</TableHead>
                <TableHead>Suppressed Since</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-400" />
                    Loading suppressions...
                  </TableCell>
                </TableRow>
              ) : suppressions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    No active suppressions found.
                  </TableCell>
                </TableRow>
              ) : (
                suppressions.map((sup) => (
                  <TableRow key={sup.id}>
                    <TableCell className="font-mono text-xs text-slate-400">{sup.id}</TableCell>
                    <TableCell className="font-mono text-xs text-white font-medium">{sup.recipient}</TableCell>
                    <TableCell>
                      <Badge variant="cyan">{sup.channel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getReasonBadgeVariant(sup.reason)}>{sup.reason}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-400">{sup.teamId}</TableCell>
                    <TableCell className="text-xs text-slate-400 font-mono">{formatTimeAgo(sup.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSuppression(sup.id, sup.recipient)}
                        className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1"
                        title="Remove suppression (unblock)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Unblock</span>
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
              <DialogTitle>Add Recipient Suppression</DialogTitle>
              <DialogDescription>
                Manually block an email, phone number, or handle from receiving outbound transmissions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Recipient</label>
                <Input
                  placeholder="e.g. user@spamdomain.com or +15550192831"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Channel</label>
                  <Select value={newChannel} onChange={(e) => setNewChannel(e.target.value as Channel)}>
                    <option value={Channel.EMAIL}>Email</option>
                    <option value={Channel.SMS}>SMS</option>
                    <option value={Channel.WHATSAPP}>WhatsApp</option>
                    <option value={Channel.PUSH}>Push</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Reason</label>
                  <Select
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value as SuppressionReason)}
                  >
                    <option value={SuppressionReason.MANUAL_BLOCK}>Manual Block</option>
                    <option value={SuppressionReason.SPAM_COMPLAINT}>Spam Complaint</option>
                    <option value={SuppressionReason.HARD_BOUNCE}>Hard Bounce</option>
                    <option value={SuppressionReason.UNSUBSCRIBE}>Unsubscribe</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Tenant Scope</label>
                <Input
                  placeholder="team_default or *"
                  value={newTeamId}
                  onChange={(e) => setNewTeamId(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="glow" size="sm" isLoading={isSubmitting}>
                Add Suppression
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
