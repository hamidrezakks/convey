import type { InAppNotificationDto } from '@convey/shared';
import { Bell, Check, ExternalLink, Inbox, Loader2, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function InboxPage() {
  const [notifications, setNotifications] = useState<InAppNotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recipientId, setRecipientId] = useState('usr_alice_demo');

  // Form to dispatch simulated in-app notification
  const [newTitle, setNewTitle] = useState('New Mention in #engineering');
  const [newBody, setNewBody] = useState('Hamid mentioned you: "Great job on the new release!"');
  const [newCta, setNewCta] = useState('https://convey.dev/messages');
  const [isSending, setIsSending] = useState(false);

  const tenantId = '019ff136-0000-7000-8000-000000000001';
  const team = 'core';

  const loadInbox = async () => {
    try {
      const res = await api.getInboxFeed(tenantId, recipientId);
      if (res.success) {
        setNotifications(res.items);
        setUnreadCount(res.unreadCount);
      }
    } catch {
      // Fallback mock feed
      const fallback: InAppNotificationDto[] = [
        {
          id: 'notif_1',
          tenantId,
          team,
          recipientId,
          title: 'Welcome to Convey Platform',
          body: 'Your high-throughput communication infrastructure is ready.',
          ctaUrl: 'https://convey.dev/overview',
          category: 'onboarding',
          isRead: false,
          isArchived: false,
          createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
        },
        {
          id: 'notif_2',
          tenantId,
          team,
          recipientId,
          title: 'Invoice #INV-2026-08 Paid',
          body: 'Receipt of $299.00 processed successfully.',
          category: 'billing',
          isRead: true,
          readAt: new Date().toISOString(),
          isArchived: false,
          createdAt: new Date(Date.now() - 60 * 60000).toISOString(),
        },
      ];
      setNotifications(fallback);
      setUnreadCount(1);
    }
  };

  useEffect(() => {
    loadInbox();
  }, [recipientId]);

  const handleSendSimulated = async () => {
    setIsSending(true);
    try {
      const res = await api.createInAppNotification({
        tenantId,
        team,
        recipientId,
        title: newTitle,
        body: newBody,
        ctaUrl: newCta || undefined,
        category: 'notification',
      });

      if (res.success) {
        toast.success('In-App Notification broadcasted via SSE');
        await loadInbox();
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to send notification');
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.markInAppRead(tenantId, recipientId, [id]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      toast.success('Marked as read');
    } catch {
      toast.error('Failed to mark read');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bell className="w-7 h-7 text-sky-500" />
            In-App Notification Center &amp; Real-Time Feed
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time subscriber notification feeds with unread badge counters, SSE streaming, and action CTAs.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Dispatch In-App Notification Form */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-500" />
              Dispatch In-App Event
            </h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Subscriber ID</label>
              <input
                type="text"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Notification Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Notification Body
              </label>
              <textarea
                rows={3}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Action URL (CTA)
              </label>
              <input
                type="text"
                value={newCta}
                onChange={(e) => setNewCta(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none font-mono"
              />
            </div>

            <button
              type="button"
              onClick={handleSendSimulated}
              disabled={isSending}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Publish to In-App Feed
            </button>
          </div>
        </div>

        {/* Right: Live Interactive Inbox UI Simulator */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="relative p-2 rounded-lg bg-sky-500/10 text-sky-500">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Live Subscriber Inbox</h2>
                <p className="text-xs text-slate-400 font-mono">Subscriber: {recipientId}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadInbox}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            >
              Refresh Feed
            </button>
          </div>

          {/* Notifications Feed List */}
          <div className="space-y-3 custom-scrollbar max-h-[500px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Inbox className="w-8 h-8 mx-auto stroke-1" />
                <p className="text-xs">No in-app notifications in inbox</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-xl border transition-all ${
                    !n.isRead
                      ? 'bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/60'
                      : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{n.title}</span>
                        {!n.isRead && <span className="h-2 w-2 rounded-full bg-sky-500" title="Unread notification" />}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{n.body}</p>

                      {n.ctaUrl && (
                        <a
                          href={n.ctaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline pt-1"
                        >
                          <span>Open link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
