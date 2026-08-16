import React, { useEffect, useState } from 'react';
import { Channel, type MessageDetailDto, MessageStatus, type MessageSummaryDto } from '@convey/shared';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Filter,
  Inbox,
  Layers,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { TraceWaterfall } from '../components/trace/TraceWaterfall';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { api } from '../lib/api';
import { formatDurationMs, formatTimeAgo } from '../lib/utils';

export function MessagesPage() {
  const [messages, setMessages] = useState<MessageSummaryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Inspector modal state
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [messageDetails, setMessageDetails] = useState<MessageDetailDto | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const res = await api.getMessages({
        page,
        limit: 15,
        search: search || undefined,
        channel: selectedChannel !== 'ALL' ? (selectedChannel as Channel) : undefined,
        status: selectedStatus !== 'ALL' ? (selectedStatus as MessageStatus) : undefined,
      });
      setMessages(res.messages);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [page, selectedChannel, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMessages();
  };

  const handleInspect = async (publicId: string) => {
    setSelectedMessageId(publicId);
    setIsDetailsLoading(true);
    try {
      const details = await api.getMessageDetails(publicId);
      setMessageDetails(details);
    } catch (err) {
      console.error('Failed to fetch message details:', err);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadgeVariant = (status: MessageStatus) => {
    switch (status) {
      case MessageStatus.DELIVERED:
        return 'success';
      case MessageStatus.FAILED:
        return 'destructive';
      case MessageStatus.SUPPRESSED:
        return 'warning';
      case MessageStatus.QUEUED:
      case MessageStatus.SENDING:
        return 'cyan';
      default:
        return 'default';
    }
  };

  const totalPages = Math.ceil(total / 15) || 1;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Inbox className="w-5 h-5 text-sky-400" />
            Universal Message Explorer & Distributed Tracing
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Search, filter, and inspect end-to-end W3C distributed trace timelines and wire payloads.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchMessages} className="text-xs gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-6">
              <Input
                placeholder="Search by Public ID (msg_...), recipient, or team..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-4 h-4 text-slate-400" />}
              />
            </div>

            {/* Channel Filter */}
            <div className="sm:col-span-3">
              <Select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)}>
                <option value="ALL">All Channels</option>
                <option value={Channel.EMAIL}>Email</option>
                <option value={Channel.SMS}>SMS</option>
                <option value={Channel.WHATSAPP}>WhatsApp</option>
                <option value={Channel.PUSH}>Push Notification</option>
                <option value={Channel.SLACK}>Slack</option>
                <option value={Channel.TOOL}>Tool / Webhook</option>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-3 flex gap-2">
              <Select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value={MessageStatus.DELIVERED}>Delivered</option>
                <option value={MessageStatus.ACCEPTED}>Accepted</option>
                <option value={MessageStatus.QUEUED}>Queued</option>
                <option value={MessageStatus.SENDING}>Sending</option>
                <option value={MessageStatus.FAILED}>Failed</option>
                <option value={MessageStatus.SUPPRESSED}>Suppressed</option>
              </Select>
              <Button type="submit" variant="primary" size="sm" className="px-4">
                Filter
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Messages Data Table */}
      <Card className="glass-panel overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Messages ({total.toLocaleString()} found)
          </CardTitle>
          <div className="text-xs text-slate-400 font-mono">
            Page {page} of {totalPages}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-56">Public ID</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-400" />
                    Loading messages...
                  </TableCell>
                </TableRow>
              ) : messages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                    No messages found matching the criteria.
                  </TableCell>
                </TableRow>
              ) : (
                messages.map((msg) => (
                  <TableRow key={msg.publicId} className="group">
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sky-300 font-medium">{msg.publicId}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.publicId)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-200 transition-opacity p-0.5"
                          title="Copy ID"
                        >
                          {copiedId === msg.publicId ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </TableCell>

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

                    <TableCell className="font-mono text-xs text-slate-300 truncate max-w-xs">
                      {msg.recipient}
                    </TableCell>

                    <TableCell className="text-xs text-slate-400 font-mono">{msg.teamId}</TableCell>

                    <TableCell>
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                          msg.priority === 'CRITICAL'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {msg.priority}
                      </span>
                    </TableCell>

                    <TableCell className="text-xs font-mono text-slate-400">
                      ${msg.costUsd?.toFixed(4) ?? '0.0001'}
                    </TableCell>

                    <TableCell className="text-xs text-slate-400 font-mono">
                      {formatTimeAgo(msg.createdAt)}
                    </TableCell>

                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(msg.status)} dot>
                        {msg.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleInspect(msg.publicId)}
                        className="h-7 text-xs gap-1 hover:border-sky-500/40"
                      >
                        <Layers className="w-3 h-3 text-sky-400" />
                        <span>Inspect Trace</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/80">
            <div className="text-xs text-slate-400">
              Showing {(page - 1) * 15 + 1} to {Math.min(total, page * 15)} of {total.toLocaleString()} entries
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
                <span>Prev</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="h-8 gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message & Distributed Trace Inspector Modal */}
      <Dialog open={!!selectedMessageId} onOpenChange={(open) => !open && setSelectedMessageId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          {isDetailsLoading || !messageDetails ? (
            <div className="py-20 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-sky-400" />
              <span>Fetching distributed spans and cryptographic metadata...</span>
            </div>
          ) : (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle>{messageDetails.publicId}</DialogTitle>
                      <Badge variant={getStatusBadgeVariant(messageDetails.status)} dot>
                        {messageDetails.status}
                      </Badge>
                    </div>
                    <DialogDescription>
                      Tenant: <span className="font-mono text-slate-300">{messageDetails.teamId}</span> • Channel:{' '}
                      <span className="text-sky-300 font-semibold">{messageDetails.channel}</span> • Recipient:{' '}
                      <span className="font-mono text-slate-300">{messageDetails.recipient}</span>
                    </DialogDescription>
                  </div>

                  {/* BYOK Envelope Encryption Badge */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                    <Lock className="w-3.5 h-3.5" />
                    <div>
                      <span className="font-semibold">AES-256-GCM</span>
                      <span className="text-[10px] text-emerald-300/80 block">BYOK KMS Enveloped</span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* Interactive W3C Distributed Trace Waterfall */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Distributed Trace Lifecycle
                </h3>
                <TraceWaterfall
                  traceparent={messageDetails.traceparent}
                  spans={messageDetails.spans}
                />
              </div>

              {/* Message Payload View */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Message Content & Variables
                </h3>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2">
                  {messageDetails.content.subject && (
                    <div>
                      <span className="text-slate-400">Subject: </span>
                      <span className="text-white font-semibold">{messageDetails.content.subject}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">Body Preview: </span>
                    <p className="text-slate-200 mt-1 p-2.5 rounded bg-slate-900 border border-slate-800/80 font-mono text-[11px] whitespace-pre-wrap">
                      {messageDetails.content.body || 'No text body.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery Attempts Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Provider Delivery Attempts ({messageDetails.attempts.length})
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Attempt #</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>HTTP Code</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Attempted At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messageDetails.attempts.map((att) => (
                      <TableRow key={att.attemptNumber}>
                        <TableCell className="font-mono text-xs text-sky-400">#{att.attemptNumber}</TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-white">{att.providerId}</TableCell>
                        <TableCell>
                          <Badge variant={att.status === 'DELIVERED' ? 'success' : 'default'}>{att.status}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-300">{att.responseCode || 200}</TableCell>
                        <TableCell className="font-mono text-xs text-emerald-400">{formatDurationMs(att.latencyMs)}</TableCell>
                        <TableCell className="text-xs text-slate-400 font-mono">{formatTimeAgo(att.attemptedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
