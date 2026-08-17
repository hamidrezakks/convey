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
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Dialog, DialogContent } from '../ui/dialog';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

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

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        handleSelect(filteredCommands[selectedIndex].path);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  // Scroll active element into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-xl bg-slate-900/95 border-slate-800 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800">
          <Search className="w-4 h-4 text-sky-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or jump to page... (↑↓ to navigate, ↵ to select)"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 rounded border border-slate-700 text-slate-400">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="p-2 max-h-80 overflow-y-auto space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">No matching commands or pages found.</div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isHighlighted = idx === selectedIndex;
              return (
                <button
                  key={cmd.path}
                  type="button"
                  onClick={() => handleSelect(cmd.path)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors group cursor-pointer text-left',
                    isHighlighted
                      ? 'bg-sky-500/15 text-white font-medium border border-sky-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={cn(
                        'w-4 h-4 transition-colors',
                        isHighlighted ? 'text-sky-400' : 'text-slate-400 group-hover:text-sky-400',
                      )}
                    />
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
