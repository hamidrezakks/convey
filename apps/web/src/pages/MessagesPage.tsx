import { Channel, MessageStatus } from '@convey/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Cpu,
  Inbox,
  Layers,
  Lock,
  RefreshCw,
  Search,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { OpsFailureExplainer } from '../components/messages/OpsFailureExplainer';
import { OpsMessageTimeline } from '../components/messages/OpsMessageTimeline';
import { TraceWaterfall } from '../components/trace/TraceWaterfall';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useI18n } from '../i18n';
import { api } from '../lib/api';
import { messageKeys } from '../lib/queryKeys';
import { formatDurationMs, formatTimeAgo } from '../lib/utils';
import { useUiMode } from '../mode';

export function MessagesPage() {
  const { t } = useI18n();
  const { isOps, isEngineer } = useUiMode();
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Inspector modal state
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showTechnicalDetailsInOps, setShowTechnicalDetailsInOps] = useState(false);

  // TanStack Query: Messages list
  const { data: messagesData, isLoading } = useQuery({
    queryKey: messageKeys.list({
      page,
      limit: 15,
      search: activeSearch || undefined,
      channel: selectedChannel !== 'ALL' ? (selectedChannel as Channel) : undefined,
      status: selectedStatus !== 'ALL' ? (selectedStatus as MessageStatus) : undefined,
    }),
    queryFn: () =>
      api.getMessages({
        page,
        limit: 15,
        search: activeSearch || undefined,
        channel: selectedChannel !== 'ALL' ? (selectedChannel as Channel) : undefined,
        status: selectedStatus !== 'ALL' ? (selectedStatus as MessageStatus) : undefined,
      }),
  });

  // TanStack Query: Message detail & trace
  const { data: messageDetails, isLoading: isDetailsLoading } = useQuery({
    queryKey: messageKeys.detail(selectedMessageId ?? ''),
    queryFn: () => api.getMessageDetails(selectedMessageId ?? ''),
    enabled: !!selectedMessageId,
  });

  const messages = messagesData?.messages ?? [];
  const total = messagesData?.total ?? 0;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveSearch(search);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadgeVariant = (status: MessageStatus | string) => {
    switch (status) {
      case MessageStatus.DELIVERED:
      case 'DELIVERED':
        return 'success';
      case MessageStatus.FAILED:
      case 'FAILED':
        return 'destructive';
      case MessageStatus.SUPPRESSED:
      case 'SUPPRESSED':
        return 'warning';
      case MessageStatus.QUEUED:
      case MessageStatus.SENDING:
      case 'QUEUED':
      case 'SENDING':
        return 'cyan';
      default:
        return 'default';
    }
  };

  const totalPages = Math.ceil(total / 15) || 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            {isOps ? (
              <>
                <Briefcase className="w-5 h-5 text-emerald-500" />
                {t('mode.opsMessagesTitle')}
              </>
            ) : (
              <>
                <Inbox className="w-5 h-5 text-sky-500 dark:text-sky-400" />
                {t('messages.title')}
              </>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isOps ? t('mode.opsMessagesSubtitle') : t('messages.subtitle')}
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-6">
              <Input
                placeholder={isOps ? 'Search by email, phone number, or name...' : t('messages.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-4 h-4 text-slate-400" />}
              />
            </div>

            {/* Channel Filter */}
            <div className="sm:col-span-3">
              <Select
                value={selectedChannel}
                onChange={(e) => {
                  setSelectedChannel(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">{t('messages.allChannels')}</option>
                <option value={Channel.EMAIL}>{t('common.email')}</option>
                <option value={Channel.SMS}>{t('common.sms')}</option>
                <option value={Channel.WHATSAPP}>WhatsApp</option>
                <option value={Channel.CHAT}>Chat</option>
                <option value={Channel.PUSH}>{t('common.push')}</option>
                <option value={Channel.SLACK}>Slack</option>
                <option value={Channel.TOOL}>{t('common.tool')}</option>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-3 flex gap-2">
              <Select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">{t('messages.allStatuses')}</option>
                <option value={MessageStatus.DELIVERED}>{t('messages.statusDelivered')}</option>
                <option value={MessageStatus.ACCEPTED}>{t('messages.statusAccepted')}</option>
                <option value={MessageStatus.QUEUED}>{t('messages.statusQueued')}</option>
                <option value={MessageStatus.SENDING}>{t('messages.statusSending')}</option>
                <option value={MessageStatus.FAILED}>{t('messages.statusFailed')}</option>
                <option value={MessageStatus.SUPPRESSED}>{t('messages.statusSuppressed')}</option>
              </Select>
              <Button type="submit" variant="primary" size="sm" className="px-4">
                {t('common.filter')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Messages Data Table */}
      <Card className="glass-panel overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('messages.totalMessagesCount')} ({total.toLocaleString()})
          </CardTitle>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {page} / {totalPages}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {isEngineer && <TableHead className="w-56">{t('messages.colPublicId')}</TableHead>}
                <TableHead>{t('messages.colRecipient')}</TableHead>
                <TableHead>{t('messages.colChannel')}</TableHead>
                <TableHead>{t('deliverability.teamLabel')}</TableHead>
                {isEngineer && <TableHead>{t('policies.tierPriorities')}</TableHead>}
                {isEngineer && <TableHead>{t('providers.colUnitCost')}</TableHead>}
                <TableHead>{t('messages.colTime')}</TableHead>
                <TableHead>{t('messages.colStatus')}</TableHead>
                <TableHead className="text-end rtl:text-left">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isEngineer ? 9 : 6} className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-500 dark:text-sky-400" />
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              ) : messages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isEngineer ? 9 : 6} className="text-center py-12 text-slate-500">
                    {t('messages.noMessagesFound')}
                  </TableCell>
                </TableRow>
              ) : (
                messages.map((msg) => (
                  <TableRow key={msg.publicId} className="group">
                    {/* Public ID (Engineer Only) */}
                    {isEngineer && (
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sky-600 dark:text-sky-300 font-medium">{msg.publicId}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.publicId)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-opacity p-0.5 cursor-pointer"
                            title={t('messages.copyId')}
                          >
                            {copiedId === msg.publicId ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                    )}

                    {/* Recipient */}
                    <TableCell className="font-medium text-xs text-slate-900 dark:text-white max-w-xs truncate">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                          {msg.recipient.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{msg.recipient}</span>
                      </div>
                    </TableCell>

                    {/* Channel */}
                    <TableCell>
                      <Badge
                        variant={
                          msg.channel === Channel.EMAIL
                            ? 'cyan'
                            : msg.channel === Channel.SMS
                              ? 'purple'
                              : msg.channel === Channel.WHATSAPP
                                ? 'success'
                                : 'default'
                        }
                      >
                        {msg.channel}
                      </Badge>
                    </TableCell>

                    {/* Team */}
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-mono">{msg.teamId}</TableCell>

                    {/* Engineer Columns: Priority & Cost */}
                    {isEngineer && (
                      <TableCell>
                        <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{msg.priority}</span>
                      </TableCell>
                    )}

                    {isEngineer && (
                      <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        ${(msg.costUsd ?? 0.0001).toFixed(5)}
                      </TableCell>
                    )}

                    {/* Time */}
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {formatTimeAgo(msg.createdAt)}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(msg.status)} dot>
                        {msg.status}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-end rtl:text-left">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedMessageId(msg.publicId);
                          setShowTechnicalDetailsInOps(false);
                        }}
                        className="h-7 text-xs gap-1.5"
                      >
                        <Layers className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                        <span>{isOps ? 'View Journey' : t('common.details')}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {total > 0 ? `${(page - 1) * 15 + 1} - ${Math.min(total, page * 15)} / ${total.toLocaleString()}` : '0'}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="h-8 gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>{t('common.back')}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="h-8 gap-1"
              >
                <span>{t('common.next')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message Inspector Modal (Adaptive for Ops vs Engineer) */}
      <Dialog
        open={!!selectedMessageId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMessageId(null);
            setShowTechnicalDetailsInOps(false);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar">
          {isDetailsLoading || !messageDetails ? (
            <div className="py-20 text-center text-slate-500 dark:text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-sky-500 dark:text-sky-400" />
              <span>{t('common.loading')}</span>
            </div>
          ) : (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="font-bold text-base sm:text-lg">
                        {isOps ? `Delivery for ${messageDetails.recipient}` : messageDetails.publicId}
                      </DialogTitle>
                      <Badge variant={getStatusBadgeVariant(messageDetails.status)} dot>
                        {messageDetails.status}
                      </Badge>
                    </div>
                    <DialogDescription className="mt-1">
                      {t('deliverability.teamLabel')}:{' '}
                      <span className="font-mono text-slate-700 dark:text-slate-300">{messageDetails.teamId}</span> •{' '}
                      {t('common.channel')}:{' '}
                      <span className="text-sky-600 dark:text-sky-300 font-semibold">{messageDetails.channel}</span> •{' '}
                      {t('common.recipient')}:{' '}
                      <span className="font-mono text-slate-700 dark:text-slate-300">{messageDetails.recipient}</span>
                    </DialogDescription>
                  </div>

                  {/* BYOK Envelope Encryption Badge */}
                  {isEngineer && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                      <Lock className="w-3.5 h-3.5" />
                      <div>
                        <span className="font-semibold">AES-256-GCM</span>
                        <span className="text-[10px] text-emerald-600/80 dark:text-emerald-300/80 block">
                          BYOK KMS Enveloped
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </DialogHeader>

              {/* Ops Mode: Delivery Journey Timeline */}
              {isOps && (
                <div className="space-y-4">
                  <OpsMessageTimeline
                    status={messageDetails.status}
                    createdAt={messageDetails.createdAt}
                    channel={messageDetails.channel}
                    recipient={messageDetails.recipient}
                    attempts={messageDetails.attempts || []}
                  />

                  {/* Failure Explainer for Ops if failed or suppressed */}
                  {(messageDetails.status === MessageStatus.FAILED ||
                    messageDetails.status === MessageStatus.SUPPRESSED) && (
                    <OpsFailureExplainer
                      status={messageDetails.status}
                      errorMessage={
                        messageDetails.attempts?.[messageDetails.attempts.length - 1]?.errorDetails ||
                        'Provider delivery rejection'
                      }
                      recipient={messageDetails.recipient}
                    />
                  )}
                </div>
              )}

              {/* Message Payload View */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('composer.preview')}
                </h3>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                  {messageDetails.content?.subject && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">{t('composer.subject')}: </span>
                      <span className="text-slate-900 dark:text-white font-semibold">
                        {messageDetails.content.subject}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">{t('composer.body')}: </span>
                    <p className="text-slate-800 dark:text-slate-200 mt-1 p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 font-mono text-[11px] whitespace-pre-wrap">
                      {messageDetails.content?.body || 'No text body.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Engineering Mode: W3C Distributed Trace Waterfall */}
              {(isEngineer || showTechnicalDetailsInOps) && (
                <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-sky-500" />
                      {t('messages.traceDrawerTitle')}
                    </h3>
                    <TraceWaterfall traceparent={messageDetails.traceparent} spans={messageDetails.spans || []} />
                  </div>

                  {/* Delivery Attempts Table */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('providers.title')} ({messageDetails.attempts?.length ?? 0})
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>{t('providers.colProvider')}</TableHead>
                          <TableHead>{t('common.status')}</TableHead>
                          <TableHead>HTTP</TableHead>
                          <TableHead>{t('common.latency')}</TableHead>
                          <TableHead>{t('common.timestamp')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(messageDetails.attempts || []).map((att) => (
                          <TableRow key={att.attemptNumber}>
                            <TableCell className="font-mono text-xs text-sky-600 dark:text-sky-400">
                              #{att.attemptNumber}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                              {att.providerId}
                            </TableCell>
                            <TableCell>
                              <Badge variant={att.status === 'DELIVERED' ? 'success' : 'default'}>{att.status}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                              {att.responseCode || 200}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                              {formatDurationMs(att.latencyMs)}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              {formatTimeAgo(att.attemptedAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Ops Mode: Expandable Diagnostic Details Toggle */}
              {isOps && !showTechnicalDetailsInOps && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTechnicalDetailsInOps(true)}
                    className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white gap-1"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>View Technical W3C Traces & Provider Attempts</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
