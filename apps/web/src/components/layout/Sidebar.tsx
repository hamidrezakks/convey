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
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radio,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
  Webhook,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { TranslationKey } from '../../i18n';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/utils';
import { useUiMode } from '../../mode';

export interface NavItemConfig {
  path: string;
  labelKey: TranslationKey;
  icon: React.ElementType;
  badgeKey?: TranslationKey;
  rawBadge?: string;
  badgeVariant?: 'cyan' | 'amber' | 'emerald' | 'destructive';
  badgeDot?: boolean;
}

export interface NavGroupConfig {
  groupKey: TranslationKey;
  items: NavItemConfig[];
}

export const NAV_GROUPS = [
  {
    group: 'Telemetry & Observability',
    items: [
      { path: '/overview', label: 'Planetary Telemetry', icon: Activity },
      { path: '/messages', label: 'Message & Trace Explorer', icon: Inbox },
      { path: '/architecture', label: 'System Topology & Prom', icon: Cpu },
    ],
  },
  {
    group: 'Traffic & Providers',
    items: [
      { path: '/providers', label: 'Provider Matrix & Circuits', icon: Radio },
      { path: '/providers/configure', label: 'Provider Setup & Env Vault', icon: Key },
      { path: '/dlq', label: 'DLQ & Surgical Replay', icon: AlertTriangle },
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

export const ENGINEER_NAV_GROUP_CONFIGS: NavGroupConfig[] = [
  {
    groupKey: 'nav.groupTelemetry',
    items: [
      {
        path: '/overview',
        labelKey: 'nav.overview',
        icon: Activity,
        badgeKey: 'nav.overviewBadge',
        badgeVariant: 'emerald',
        badgeDot: true,
      },
      { path: '/messages', labelKey: 'nav.messages', icon: Inbox },
      { path: '/architecture', labelKey: 'nav.architecture', icon: Cpu },
    ],
  },
  {
    groupKey: 'nav.groupTraffic',
    items: [
      {
        path: '/providers',
        labelKey: 'nav.providers',
        icon: Radio,
        badgeKey: 'nav.providersBadge',
        badgeVariant: 'cyan',
      },
      {
        path: '/providers/configure',
        labelKey: 'nav.providerConfig',
        icon: Key,
        badgeKey: 'nav.providerConfigBadge',
        badgeVariant: 'emerald',
      },
      {
        path: '/dlq',
        labelKey: 'nav.dlq',
        icon: AlertTriangle,
        badgeKey: 'nav.dlqBadge',
        badgeVariant: 'amber',
      },
      { path: '/deliverability', labelKey: 'nav.deliverability', icon: ShieldCheck },
    ],
  },
  {
    groupKey: 'nav.groupEngineering',
    items: [
      { path: '/composer', labelKey: 'nav.composer', icon: Send },
      { path: '/policies', labelKey: 'nav.policies', icon: Sliders },
      { path: '/webhooks', labelKey: 'nav.webhooks', icon: Webhook },
      { path: '/audit', labelKey: 'nav.audit', icon: BookOpen },
    ],
  },
];

export const OPS_NAV_GROUP_CONFIGS: NavGroupConfig[] = [
  {
    groupKey: 'nav.groupOpsActivity',
    items: [
      {
        path: '/overview',
        labelKey: 'nav.overview',
        icon: Activity,
        badgeKey: 'nav.overviewBadge',
        badgeVariant: 'emerald',
        badgeDot: true,
      },
      { path: '/messages', labelKey: 'nav.messages', icon: Inbox },
    ],
  },
  {
    groupKey: 'nav.groupOpsChannels',
    items: [
      {
        path: '/providers',
        labelKey: 'nav.providers',
        icon: Radio,
      },
      {
        path: '/deliverability',
        labelKey: 'nav.deliverability',
        icon: ShieldCheck,
      },
    ],
  },
  {
    groupKey: 'nav.groupOpsTools',
    items: [
      { path: '/composer', labelKey: 'nav.composer', icon: Send },
      {
        path: '/dlq',
        labelKey: 'nav.dlq',
        icon: AlertTriangle,
      },
      { path: '/policies', labelKey: 'nav.policies', icon: Sliders },
    ],
  },
];

export const NAV_GROUP_CONFIGS = ENGINEER_NAV_GROUP_CONFIGS;

export interface WorkspaceEnvironment {
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

export interface SidebarProps {
  isCollapsed?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isCollapsed = false, isMobileOpen = false, onCloseMobile, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname === '/' ? '/overview' : location.pathname;
  const { t } = useI18n();
  const { mode } = useUiMode();

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

  const currentConfigs = mode === 'ops' ? OPS_NAV_GROUP_CONFIGS : ENGINEER_NAV_GROUP_CONFIGS;

  const navGroups = useMemo(
    () =>
      currentConfigs.map((g) => ({
        group: t(g.groupKey),
        items: g.items.map((item) => ({
          path: item.path,
          label: t(item.labelKey),
          icon: item.icon,
          badge: item.badgeKey ? t(item.badgeKey) : item.rawBadge,
          badgeVariant: item.badgeVariant,
          badgeDot: item.badgeDot,
        })),
      })),
    [t, currentConfigs],
  );

  return (
    <aside
      className={cn(
        'h-screen bg-slate-50/95 dark:bg-[#070a12]/95 border-r rtl:border-r-0 rtl:border-l border-slate-200/80 dark:border-slate-800/70 flex flex-col justify-between shrink-0 select-none glass-panel z-50 md:z-20 transition-all duration-200',
        isMobileOpen
          ? 'fixed inset-y-0 left-0 rtl:left-auto rtl:right-0 w-72 shadow-2xl translate-x-0'
          : 'hidden md:flex',
        !isMobileOpen && (isCollapsed ? 'w-18' : 'w-68'),
      )}
    >
      {/* Top Header & Interactive Workspace Switcher */}
      <div className="flex flex-col min-h-0 flex-1">
        {/* Workspace Brand Dropdown Container */}
        <div
          className={cn(
            'border-b border-slate-200/80 dark:border-slate-800/60 relative',
            isCollapsed ? 'p-2.5' : 'p-4',
          )}
          ref={dropdownRef}
        >
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            title={activeEnv.name}
            className={cn(
              'w-full flex items-center rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer group shadow-sm text-left rtl:text-right',
              isCollapsed ? 'justify-center p-2' : 'justify-between p-2',
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0 group-hover:scale-105 transition-transform">
                <Layers className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs tracking-tight text-slate-900 dark:text-white truncate">
                      {activeEnv.name}
                    </span>
                    <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      L7
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{activeEnv.region}</p>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 shrink-0',
                  dropdownOpen ? 'rotate-180 text-sky-500 dark:text-sky-400' : '',
                )}
              />
            )}
          </button>

          {/* Interactive Floating Workspace Selector Popover */}
          {dropdownOpen && (
            <div
              className={cn(
                'absolute top-full mt-1.5 p-2 bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1',
                isCollapsed ? 'left-2 w-64' : 'left-4 right-4',
              )}
            >
              <div className="px-2 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('nav.workspaceHeader')}
              </div>
              {ENVIRONMENTS.map((env) => {
                const isSelected = activeEnv.id === env.id;
                return (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => handleSelectEnvironment(env)}
                    className={cn(
                      'w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors group text-left rtl:text-right cursor-pointer',
                      isSelected
                        ? 'bg-sky-500/15 text-slate-900 dark:text-white font-semibold border border-sky-500/30'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/80 hover:text-slate-900 dark:hover:text-white',
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs truncate">{env.name}</span>
                          <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 px-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            {env.tier}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                          {env.region}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0" />}
                  </button>
                );
              })}

              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    toast.info(t('nav.connectCluster'));
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-500 hover:bg-sky-500/10 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t('nav.connectCluster')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    toast.info(t('nav.crossRegionTopology'));
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors cursor-pointer"
                >
                  <Globe className="w-3 h-3" />
                  <span>{t('nav.crossRegionTopology')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Sections */}
        <nav className={cn('flex-1 overflow-y-auto custom-scrollbar', isCollapsed ? 'p-2 space-y-3' : 'p-3 space-y-5')}>
          {navGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              {!isCollapsed ? (
                <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-400 uppercase">
                  {group.group}
                </div>
              ) : (
                <div className="my-1.5 border-t border-slate-200/50 dark:border-slate-800/50" />
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const hasMoreSpecificMatch = navGroups.some((g) =>
                  g.items.some(
                    (other) =>
                      other.path !== item.path &&
                      other.path.startsWith(item.path) &&
                      (currentPath === other.path || currentPath.startsWith(`${other.path}/`)),
                  ),
                );
                const isActive =
                  currentPath === item.path ||
                  (!hasMoreSpecificMatch && item.path !== '/overview' && currentPath.startsWith(`${item.path}/`));

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      if (onCloseMobile) onCloseMobile();
                    }}
                    title={item.label}
                    className={cn(
                      'relative w-full flex items-center rounded-xl text-xs font-medium transition-all duration-150 group overflow-hidden',
                      isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2',
                      isActive
                        ? 'bg-gradient-to-r rtl:bg-gradient-to-l from-sky-500/15 via-sky-500/8 to-transparent text-slate-900 dark:text-white font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-900/50',
                    )}
                  >
                    {/* Left Glowing Accent Bar for Active State */}
                    {isActive && (
                      <span className="absolute left-0 rtl:left-auto rtl:right-0 top-1.5 bottom-1.5 w-1 rounded-r rtl:rounded-r-none rtl:rounded-l bg-sky-500 dark:bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
                    )}

                    <div className={cn('flex items-center min-w-0', isCollapsed ? 'justify-center' : 'gap-2.5')}>
                      <Icon
                        className={cn(
                          'w-4 h-4 shrink-0 transition-transform group-hover:scale-110',
                          isActive
                            ? 'text-sky-500 dark:text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]'
                            : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200',
                        )}
                      />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {/* Badge */}
                    {item.badge && !isCollapsed && (
                      <span
                        className={cn(
                          'shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap leading-none border',
                          item.badgeVariant === 'emerald'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                            : item.badgeVariant === 'amber'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30'
                              : 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
                        )}
                      >
                        {item.badgeDot && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping inline-block" />
                        )}
                        <span>{item.badge}</span>
                      </span>
                    )}

                    {/* Collapsed dot indicator */}
                    {item.badge && isCollapsed && (
                      <span
                        className={cn(
                          'absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full',
                          item.badgeVariant === 'emerald'
                            ? 'bg-emerald-500'
                            : item.badgeVariant === 'amber'
                              ? 'bg-amber-500'
                              : 'bg-sky-500',
                        )}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Cluster Footer Card */}
      <div
        className={cn(
          'border-t border-slate-200/80 dark:border-slate-800/60 bg-gradient-to-b from-slate-100/40 dark:from-slate-950/40 to-slate-200/40 dark:to-slate-900/40',
          isCollapsed ? 'p-2' : 'p-3',
        )}
      >
        {!isCollapsed ? (
          <>
            <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{activeEnv.name}</span>
                </div>
                <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono font-medium px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                  v1.0.0
                </span>
              </div>

              <div className="text-[11px] space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>{t('nav.partition')}:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">y2026m08</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>{t('nav.outboxRelay')}:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold text-[10px]">
                    0 lag
                  </span>
                </div>
              </div>
            </div>

            {/* Command Hint & Collapse Button */}
            <div className="mt-2 px-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                <span>{t('nav.fastNav')}</span>
              </span>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 font-mono bg-slate-200 dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  {t('common.searchShortcut')}
                </kbd>
                {onToggleCollapse && (
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    title="Collapse Sidebar"
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-1 gap-2">
            <span className="relative flex h-2.5 w-2.5" title="Online Cluster">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Expand Sidebar"
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
