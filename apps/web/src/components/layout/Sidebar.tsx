import { Link, useLocation } from '@tanstack/react-router';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  Cpu,
  Globe,
  Inbox,
  Key,
  Layers,
  Plus,
  Radio,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
  Webhook,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

export interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: 'cyan' | 'amber' | 'emerald' | 'destructive';
  badgeDot?: boolean;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Telemetry & Observability',
    items: [
      {
        path: '/overview',
        label: 'Planetary Telemetry',
        icon: Activity,
        badge: 'Live',
        badgeVariant: 'emerald',
        badgeDot: true,
      },
      { path: '/messages', label: 'Message & Trace Explorer', icon: Inbox },
      { path: '/architecture', label: 'System Topology & Prom', icon: Cpu },
    ],
  },
  {
    group: 'Traffic & Providers',
    items: [
      { path: '/providers', label: 'Provider Matrix & Circuits', icon: Radio, badge: '80+', badgeVariant: 'cyan' },
      {
        path: '/providers/configure',
        label: 'Provider Setup & Env Vault',
        icon: Key,
        badge: 'Studio',
        badgeVariant: 'emerald',
      },
      { path: '/dlq', label: 'DLQ & Surgical Replay', icon: AlertTriangle, badge: 'Auto-Sim', badgeVariant: 'amber' },
      { path: '/deliverability', label: 'Deliverability & Autopilot', icon: ShieldCheck },
    ],
  },
  {
    group: 'Engineering & Policy',
    items: [
      { path: '/composer', label: 'Omnichannel Composer', icon: Send },
      { path: '/policies', label: 'DRR Policies & SLA Studio', icon: Sliders },
      { path: '/webhooks', label: 'Webhooks & Receipts', icon: Webhook },
      { path: '/audit', label: 'Audit Log Ledger', icon: BookOpen },
    ],
  },
];

interface WorkspaceEnvironment {
  id: string;
  name: string;
  region: string;
  tier: string;
  status: 'active' | 'degraded' | 'maintenance';
}

const ENVIRONMENTS: WorkspaceEnvironment[] = [
  {
    id: 'env_prod_useast1',
    name: 'CONVEY CORE',
    region: 'Production • us-east-1',
    tier: 'L7 Primary',
    status: 'active',
  },
  {
    id: 'env_stag_eucentral1',
    name: 'CONVEY STAGING',
    region: 'Staging • eu-central-1',
    tier: 'L7 Canary',
    status: 'active',
  },
  {
    id: 'env_local_dev',
    name: 'CONVEY SANDBOX',
    region: 'Local • 127.0.0.1:3000',
    tier: 'Mock Wire',
    status: 'active',
  },
];

export function Sidebar() {
  const location = useLocation();
  const currentPath = location.pathname === '/' ? '/overview' : location.pathname;

  // Interactive Workspace Dropdown State
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeEnv, setActiveEnv] = useState<WorkspaceEnvironment>(ENVIRONMENTS[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleSelectEnvironment = (env: WorkspaceEnvironment) => {
    setActiveEnv(env);
    setDropdownOpen(false);
    toast.success(`Switched active workspace to ${env.name} (${env.region})`);
  };

  return (
    <aside className="w-68 h-screen bg-[#070a12]/95 border-r border-slate-800/70 flex flex-col justify-between shrink-0 select-none glass-panel z-20">
      {/* Top Header & Interactive Workspace Switcher */}
      <div className="flex flex-col min-h-0 flex-1">
        {/* Workspace Brand Dropdown Container */}
        <div className="p-4 border-b border-slate-800/60 relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer group shadow-sm text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0 group-hover:scale-105 transition-transform">
                <Layers className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs tracking-tight text-white truncate">{activeEnv.name}</span>
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    L7
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">{activeEnv.region}</p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform duration-200 shrink-0',
                dropdownOpen ? 'rotate-180 text-sky-400' : '',
              )}
            />
          </button>

          {/* Interactive Floating Workspace Selector Popover */}
          {dropdownOpen && (
            <div className="absolute top-full left-4 right-4 mt-1.5 p-2 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Select Workspace / Cluster
              </div>
              {ENVIRONMENTS.map((env) => {
                const isSelected = activeEnv.id === env.id;
                return (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => handleSelectEnvironment(env)}
                    className={cn(
                      'w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors group text-left',
                      isSelected
                        ? 'bg-sky-500/15 text-white font-semibold border border-sky-500/30'
                        : 'text-slate-300 hover:bg-slate-900/80 hover:text-white',
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs truncate">{env.name}</span>
                          <span className="text-[9px] font-mono text-slate-400 px-1 rounded bg-slate-800">
                            {env.tier}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate">{env.region}</span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                  </button>
                );
              })}

              <div className="pt-1.5 border-t border-slate-800/80 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    toast.info('Cluster onboarding wizard opened');
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Connect New Cluster...</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    toast.info('Global region routing preferences');
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 transition-colors"
                >
                  <Globe className="w-3 h-3" />
                  <span>Cross-Region Topology</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Sections */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5 custom-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.group} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {group.group}
              </div>

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  currentPath === item.path || (item.path !== '/overview' && currentPath.startsWith(item.path));

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'relative w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 group overflow-hidden',
                      isActive
                        ? 'bg-gradient-to-r from-sky-500/15 via-sky-500/8 to-transparent text-white font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50',
                    )}
                  >
                    {/* Left Glowing Accent Bar for Active State */}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
                    )}

                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={cn(
                          'w-4 h-4 shrink-0 transition-transform group-hover:scale-110',
                          isActive
                            ? 'text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]'
                            : 'text-slate-400 group-hover:text-slate-200',
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {/* Single-line Badge (No Wrapping) */}
                    {item.badge && (
                      <span
                        className={cn(
                          'shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap leading-none border',
                          item.badgeVariant === 'emerald'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : item.badgeVariant === 'amber'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-sky-500/15 text-sky-300 border-sky-500/30',
                        )}
                      >
                        {item.badgeDot && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                        )}
                        <span>{item.badge}</span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Cluster Footer Card */}
      <div className="p-3 border-t border-slate-800/60 bg-gradient-to-b from-slate-950/40 to-slate-900/40">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-bold text-slate-200">{activeEnv.name}</span>
            </div>
            <span className="text-[10px] text-sky-400 font-mono font-medium px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
              v1.0.0
            </span>
          </div>

          <div className="text-[11px] space-y-1 pt-1 border-t border-slate-800/60">
            <div className="flex justify-between text-slate-400">
              <span>Partition:</span>
              <span className="text-slate-300 font-mono text-[10px]">y2026m08</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Outbox Relay:</span>
              <span className="text-emerald-400 font-mono font-semibold text-[10px]">0 lag</span>
            </div>
          </div>
        </div>

        {/* Command Hint */}
        <div className="mt-2 px-2 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-sky-400" />
            <span>Fast Navigation</span>
          </span>
          <kbd className="px-1.5 py-0.5 font-mono bg-slate-900 rounded border border-slate-800 text-slate-400">⌘K</kbd>
        </div>
      </div>
    </aside>
  );
}
