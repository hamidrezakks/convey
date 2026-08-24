import { Channel, MessageStatus } from '@convey/shared';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, ChevronDown, Cpu, Inbox, Layers, Lock, RefreshCw, Search } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { MessageCostExplainer } from '../components/messages/MessageCostExplainer';
import { OpsFailureExplainer } from '../components/messages/OpsFailureExplainer';
import { OpsMessageTimeline } from '../components/messages/OpsMessageTimeline';
import { TraceWaterfall } from '../components/trace/TraceWaterfall';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  type ColumnDef,
  DataTable,
  DataTableAction,
  DataTableActionGroup,
  DataTableCopyCell,
} from '../components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
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
  const [selectedEnv, setSelectedEnv] = useState<string>('ALL');

  // Inspector modal state
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [showTechnicalDetailsInOps, setShowTechnicalDetailsInOps] = useState(false);

  const isSandboxFilter = selectedEnv === 'SANDBOX' ? true : selectedEnv === 'PRODUCTION' ? false : undefined;

  // TanStack Query: Messages list
  const { data: messagesData, isLoading } = useQuery({
    queryKey: messageKeys.list({
      page,
      limit: 15,
      search: activeSearch || undefined,
      channel: selectedChannel !== 'ALL' ? (selectedChannel as Channel) : undefined,
      status: selectedStatus !== 'ALL' ? (selectedStatus as MessageStatus) : undefined,
      isSandbox: isSandboxFilter,
    }),
    queryFn: () =>
      api.getMessages({
        page,
        limit: 15,
        search: activeSearch || undefined,
        channel: selectedChannel !== 'ALL' ? (selectedChannel as Channel) : undefined,
        status: selectedStatus !== 'ALL' ? (selectedStatus as MessageStatus) : undefined,
        isSandbox: isSandboxFilter,
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

  // Declarative Column Definitions for Messages Table
  const columns: ColumnDef<(typeof messages)[number]>[] = useMemo(
    () => [
      {
        id: 'publicId',
        header: t('messages.colPublicId'),
        hidden: !isEngineer,
        width: 'w-56',
        cell: ({ row }) => (
          <DataTableCopyCell
            value={row.publicId}
            tooltip={t('messages.copyId')}
            className="font-medium text-sky-600 dark:text-sky-300"
          />
        ),
      },
      {
        id: 'recipient',
        header: t('messages.colRecipient'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 max-w-xs truncate">
            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
              {row.recipient.charAt(0).toUpperCase()}
            </div>
            <span className="truncate font-medium text-xs text-slate-900 dark:text-white">{row.recipient}</span>
          </div>
        ),
      },
      {
        id: 'channel',
        header: t('messages.colChannel'),
        cell: ({ row }) => (
          <Badge
            variant={
              row.channel === Channel.EMAIL
                ? 'cyan'
                : row.channel === Channel.SMS
                  ? 'purple'
                  : row.channel === Channel.WHATSAPP
                    ? 'success'
                    : 'default'
            }
          >
            {row.channel}
          </Badge>
        ),
      },
      {
        id: 'environment',
        header: 'Environment',
        cell: ({ row }) =>
          row.isSandbox ? (
            <Badge variant="warning" className="gap-1 font-mono text-[10px]">
              🧪 Sandbox
            </Badge>
          ) : (
            <Badge variant="success" className="gap-1 font-mono text-[10px]">
              🟢 Production
            </Badge>
          ),
      },
      {
        id: 'teamId',
        header: t('deliverability.teamLabel'),
        cell: ({ row }) => <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{row.teamId}</span>,
      },
      {
        id: 'priority',
        header: t('policies.tierPriorities'),
        hidden: !isEngineer,
        cell: ({ row }) => <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{row.priority}</span>,
      },
      {
        id: 'costUsd',
        header: t('providers.colUnitCost'),
        hidden: !isEngineer,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            ${(row.costUsd ?? 0.0001).toFixed(5)}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: t('messages.colTime'),
        cell: ({ row }) => (
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{formatTimeAgo(row.createdAt)}</span>
        ),
      },
      {
        id: 'status',
        header: t('messages.colStatus'),
        cell: ({ row }) => (
          <Badge variant={getStatusBadgeVariant(row.status)} dot>
            {row.status}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: t('common.actions'),
        align: 'end',
        cell: ({ row }) => (
          <DataTableActionGroup>
            <DataTableAction
              variant="default"
              icon={<Layers className="text-sky-500 dark:text-sky-400" />}
              label={isOps ? 'View Journey' : t('common.details')}
              onClick={() => {
                setSelectedMessageId(row.publicId);
                setShowTechnicalDetailsInOps(false);
              }}
            />
          </DataTableActionGroup>
        ),
      },
    ],
    [isEngineer, isOps, t],
  );

  // Column definitions for Delivery Attempts modal table
  const attemptColumns: ColumnDef<NonNullable<typeof messageDetails>['attempts'][number]>[] = useMemo(
    () => [
      {
        id: 'attemptNumber',
        header: '#',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-sky-600 dark:text-sky-400">#{row.attemptNumber}</span>
        ),
      },
      {
        id: 'providerId',
        header: t('providers.colProvider'),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white">{row.providerId}</span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <Badge variant={row.status === 'DELIVERED' ? 'success' : 'default'}>{row.status}</Badge>,
      },
      {
        id: 'responseCode',
        header: 'HTTP',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{row.responseCode || 200}</span>
        ),
      },
      {
        id: 'latencyMs',
        header: t('common.latency'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
            {formatDurationMs(row.latencyMs)}
          </span>
        ),
      },
      {
        id: 'attemptedAt',
        header: t('common.timestamp'),
        cell: ({ row }) => (
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{formatTimeAgo(row.attemptedAt)}</span>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            {isOps ? (
              <>
                <Briefcase className="w-5 h-5 text-emerald-500 shrink-0" />
                {t('mode.opsMessagesTitle')}
              </>
            ) : (
              <>
                <Inbox className="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0" />
                {t('messages.title')}
              </>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isOps ? t('mode.opsMessagesSubtitle') : t('messages.subtitle')}
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="glass-card">
        <CardContent className="p-3.5 sm:p-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full"
          >
            {/* Search Input (Expands to fill available width) */}
            <div className="flex-1 min-w-0">
              <Input
                placeholder={isOps ? 'Search by email, phone number, or name...' : t('messages.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-4 h-4 text-slate-400" />}
                className="h-10 rounded-xl"
              />
            </div>

            {/* Environment Filter */}
            <div className="w-full md:w-48 shrink-0">
              <Select
                value={selectedEnv}
                onChange={(e) => {
                  setSelectedEnv(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-xl font-medium"
              >
                <option value="ALL">🌐 All Envs</option>
                <option value="PRODUCTION">🟢 Production</option>
                <option value="SANDBOX">🧪 Sandbox</option>
              </Select>
            </div>

            {/* Channel Filter */}
            <div className="w-full md:w-44 shrink-0">
              <Select
                value={selectedChannel}
                onChange={(e) => {
                  setSelectedChannel(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-xl"
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
            <div className="w-full md:w-44 shrink-0">
              <Select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-xl"
              >
                <option value="ALL">{t('messages.allStatuses')}</option>
                <option value={MessageStatus.DELIVERED}>{t('messages.statusDelivered')}</option>
                <option value={MessageStatus.ACCEPTED}>{t('messages.statusAccepted')}</option>
                <option value={MessageStatus.QUEUED}>{t('messages.statusQueued')}</option>
                <option value={MessageStatus.SENDING}>{t('messages.statusSending')}</option>
                <option value={MessageStatus.FAILED}>{t('messages.statusFailed')}</option>
                <option value={MessageStatus.SUPPRESSED}>{t('messages.statusSuppressed')}</option>
              </Select>
            </div>

            {/* Submit Filter Button */}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="h-10 px-6 rounded-xl font-semibold shrink-0 shadow-2xs"
            >
              {t('common.filter')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Messages Reusable Data Table */}
      <DataTable
        columns={columns}
        data={messages}
        isLoading={isLoading}
        getRowKey={(msg) => msg.publicId}
        onRowClick={(msg) => {
          setSelectedMessageId(msg.publicId);
          setShowTechnicalDetailsInOps(false);
        }}
        emptyState={{
          title: t('messages.noMessagesFound'),
          description: isOps
            ? 'No customer messages match your filter parameters.'
            : 'No messages found in ledger for current criteria.',
        }}
        pagination={{
          page,
          pageSize: 15,
          total,
          onPageChange: setPage,
        }}
      />

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

              {/* Cost Indicator & Financial Explanation */}
              <MessageCostExplainer
                channel={messageDetails.channel}
                costUsd={messageDetails.costUsd}
                attempts={messageDetails.attempts || []}
                isOps={isOps}
              />

              {/* Message Payload View */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('composer.preview')}
                </h3>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
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
                    <p className="text-slate-800 dark:text-slate-200 mt-1 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 font-mono text-[11px] whitespace-pre-wrap">
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
                    <DataTable
                      columns={attemptColumns}
                      data={messageDetails.attempts || []}
                      density="compact"
                      emptyState={{
                        title: 'No delivery attempts',
                        description: 'This message has not been dispatched to any upstream provider yet.',
                      }}
                    />
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
                    className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white gap-1 rounded-xl"
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
