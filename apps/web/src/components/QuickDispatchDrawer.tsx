import { CheckCircle2, Copy, Loader2, Send, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { coreClient } from '../lib/http';
import { requireSession } from '../lib/session';

export interface QuickDispatchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickDispatchDrawer({ open, onOpenChange }: QuickDispatchDrawerProps) {
  const [channel, setChannel] = useState<'email' | 'sms' | 'push' | 'chat' | 'whatsapp'>('email');
  const [recipient, setRecipient] = useState('developer@example.com');
  const [subject, setSubject] = useState('Order Confirmation #ORD-9921');
  const [body, setBody] = useState('Hello! Your order has been placed successfully.');
  const [isSending, setIsSending] = useState(false);
  const [lastDispatchedId, setLastDispatchedId] = useState<string | null>(null);

  // Global ⌘+T shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSend = async () => {
    setIsSending(true);
    try {
      const response = await coreClient.post('messages', {
        json: {
          team: requireSession().team,
          userId: 'console-operator',
          category: 'transactional',
          country: 'US',
          idempotencyKey: crypto.randomUUID(),
          priority: 'normal',
          recipients:
            channel === 'email'
              ? { email: recipient }
              : channel === 'sms'
                ? { phone: recipient }
                : channel === 'whatsapp'
                  ? { whatsapp: recipient }
                  : { userId: recipient },
          channels: [{ channel, content: { subject: channel === 'email' ? subject : undefined, text: body } }],
        },
      });

      const data = (await response.json()) as { messageId?: string; error?: { message: string } };
      if (response.ok && data.messageId) {
        setLastDispatchedId(data.messageId);
        toast.success(`Message accepted: ${data.messageId}`);
      } else {
        toast.error(data.error?.message || 'Failed to dispatch message');
      }
    } catch {
      toast.error('Network error during message dispatch');
    } finally {
      setIsSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        role="presentation"
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0f172a] border-l border-slate-200 dark:border-slate-800 shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Quick Test Dispatch</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Global shortcut: ⌘ + T</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {/* Channel Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Channel</label>
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
              {(['email', 'sms', 'push', 'chat', 'whatsapp'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => {
                    setChannel(ch);
                    if (ch === 'sms' && recipient.includes('@')) setRecipient('+14155552671');
                    if (ch === 'email' && !recipient.includes('@')) setRecipient('developer@example.com');
                  }}
                  className={`py-1.5 text-xs font-medium rounded-md transition-all uppercase ${
                    channel === ch
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Recipient Target
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
            />
          </div>

          {/* Subject (Email Only) */}
          {channel === 'email' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          )}

          {/* Push Title (Push Only) */}
          {channel === 'push' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Push Title</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Alert headline..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          )}

          {/* Message Content */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {channel === 'whatsapp' ? 'WhatsApp Message Body (*bold*, _italic_)' : 'Message Body'}
            </label>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans custom-scrollbar"
            />
          </div>

          {/* Result Alert */}
          {lastDispatchedId && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-500 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Accepted for Async Relay (&lt; 4ms Hot Path)</span>
              </div>
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-emerald-500/20">
                <code className="text-xs font-mono text-slate-800 dark:text-slate-200">{lastDispatchedId}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(lastDispatchedId);
                    toast.success('Message ID copied');
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Zero-Trust Encrypted
          </span>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Dispatch Test Message
          </button>
        </div>
      </div>
    </div>
  );
}
