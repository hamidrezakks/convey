import { useNavigate } from '@tanstack/react-router';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Cpu,
  Inbox,
  Radio,
  Search,
  Send,
  ShieldCheck,
  Sliders,
  Webhook,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const commands = [
    { path: '/overview', title: 'Planetary Telemetry Ops Center', category: 'Navigation', icon: Activity },
    { path: '/messages', title: 'Universal Message & Trace Explorer', category: 'Navigation', icon: Inbox },
    { path: '/providers', title: 'Provider Matrix & Circuit Breaker Cockpit', category: 'Navigation', icon: Radio },
    {
      path: '/providers/configure',
      title: 'Provider Registration & Env Setup Studio',
      category: 'Navigation',
      icon: Radio,
    },
    { path: '/dlq', title: 'Dead-Letter Queue (DLQ) & Surgical Replay', category: 'Navigation', icon: AlertTriangle },
    {
      path: '/deliverability',
      title: 'Deliverability Autopilot & Suppressions',
      category: 'Navigation',
      icon: ShieldCheck,
    },
    { path: '/policies', title: 'DRR Multi-Tenant SLA & Policy Studio', category: 'Navigation', icon: Sliders },
    { path: '/composer', title: 'Omnichannel Composer & Live Sandbox', category: 'Navigation', icon: Send },
    { path: '/webhooks', title: 'Webhook Subscriptions & Delivery Inspector', category: 'Navigation', icon: Webhook },
    { path: '/architecture', title: 'System Topology & Prometheus Metrics', category: 'Navigation', icon: Cpu },
    { path: '/audit', title: 'Security & Compliance Audit Ledger', category: 'Navigation', icon: BookOpen },
  ];

  const filteredCommands = commands.filter(
    (c) => c.title.toLowerCase().includes(query.toLowerCase()) || c.path.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = (path: string) => {
    navigate({ to: path });
    onOpenChange(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-xl bg-slate-900/95 border-slate-800 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800">
          <Search className="w-4 h-4 text-sky-400" />
          <input
            type="text"
            placeholder="Type a command or jump to page..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 rounded border border-slate-700 text-slate-400">
            ESC
          </kbd>
        </div>

        <div className="p-2 max-h-80 overflow-y-auto space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">No matching commands or pages found.</div>
          ) : (
            filteredCommands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.path}
                  type="button"
                  onClick={() => handleSelect(cmd.path)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-sky-400" />
                    <span>{cmd.title}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono text-slate-400">{cmd.category}</span>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
