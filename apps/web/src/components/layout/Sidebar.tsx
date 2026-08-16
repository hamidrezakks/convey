import {
  Activity,
  AlertTriangle,
  BookOpen,
  Cpu,
  Inbox,
  Layers,
  Radio,
  Send,
  ShieldCheck,
  Sliders,
  Webhook,
} from 'lucide-react';
import type React from 'react';
import { cn } from '../../lib/utils';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: 'cyan' | 'amber' | 'emerald' | 'destructive';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Planetary Telemetry', icon: Activity, badge: 'Live', badgeVariant: 'emerald' },
  { id: 'messages', label: 'Message & Trace Explorer', icon: Inbox },
  { id: 'providers', label: 'Provider Matrix & Circuits', icon: Radio, badge: '80+', badgeVariant: 'cyan' },
  { id: 'dlq', label: 'DLQ & Surgical Replay', icon: AlertTriangle, badge: 'Auto-Sim', badgeVariant: 'amber' },
  { id: 'deliverability', label: 'Deliverability & Autopilot', icon: ShieldCheck },
  { id: 'policies', label: 'DRR Policies & SLA Studio', icon: Sliders },
  { id: 'composer', label: 'Omnichannel Composer', icon: Send },
  { id: 'webhooks', label: 'Webhooks & Receipts', icon: Webhook },
  { id: 'architecture', label: 'System Topology & Prom', icon: Cpu },
  { id: 'audit', label: 'Audit Log Ledger', icon: BookOpen },
];

export interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
}

export function Sidebar({ activeTab, onSelectTab }: SidebarProps) {
  return (
    <aside className="w-64 h-screen bg-slate-950/80 border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none glass-panel">
      {/* Brand Header */}
      <div>
        <div className="p-5 flex items-center gap-3 border-b border-slate-800/60">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/25">
            <Layers className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">CONVEY</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                L7 Core
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Communication Fabric</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Control Center
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group',
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 font-semibold border border-sky-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60',
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-colors',
                      isActive ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-300',
                    )}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                      item.badgeVariant === 'emerald'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : item.badgeVariant === 'amber'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Cluster Footer Card */}
      <div className="p-4 border-t border-slate-800/60 m-3 bg-slate-900/50 rounded-xl border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-semibold text-slate-200">Cluster Primary</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">v1.0.0</span>
        </div>
        <div className="text-[11px] text-slate-400 space-y-1">
          <div className="flex justify-between">
            <span>Range Partitions:</span>
            <span className="text-slate-300 font-mono">Active</span>
          </div>
          <div className="flex justify-between">
            <span>Outbox Relay:</span>
            <span className="text-emerald-400 font-mono">0 lag</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
