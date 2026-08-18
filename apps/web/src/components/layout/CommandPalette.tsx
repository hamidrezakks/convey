import { useNavigate } from '@tanstack/react-router';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Briefcase,
  Cpu,
  Globe,
  Inbox,
  Monitor,
  Moon,
  Radio,
  Search,
  Send,
  ShieldCheck,
  Sliders,
  Sun,
  Webhook,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { SupportedLocale, TranslationKey } from '../../i18n';
import { useI18n } from '../../i18n';
import { cn } from '../../lib/utils';
import { useUiMode } from '../../mode';
import { useTheme } from '../../theme';
import { Dialog, DialogContent } from '../ui/dialog';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: string;
  icon: React.ElementType;
  onSelect: () => void;
  badge?: string;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t, locale, setLocale, supportedLocales } = useI18n();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { mode, setMode } = useUiMode();

  const navigationCommands: Array<{ path: string; titleKey: TranslationKey; icon: React.ElementType }> = [
    { path: '/overview', titleKey: 'overview.title', icon: Activity },
    { path: '/messages', titleKey: 'messages.title', icon: Inbox },
    { path: '/providers', titleKey: 'providers.title', icon: Radio },
    { path: '/providers/configure', titleKey: 'nav.providerConfig', icon: Radio },
    { path: '/dlq', titleKey: 'nav.dlq', icon: AlertTriangle },
    { path: '/deliverability', titleKey: 'deliverability.title', icon: ShieldCheck },
    { path: '/policies', titleKey: 'policies.title', icon: Sliders },
    { path: '/composer', titleKey: 'composer.title', icon: Send },
    { path: '/webhooks', titleKey: 'webhooks.title', icon: Webhook },
    { path: '/architecture', titleKey: 'architecture.title', icon: Cpu },
    { path: '/audit', titleKey: 'audit.title', icon: BookOpen },
  ];

  const allCommands = useMemo<CommandItem[]>(() => {
    const navItems: CommandItem[] = navigationCommands.map((c) => ({
      id: c.path,
      title: t(c.titleKey),
      category: t('commandPalette.categoryNavigation'),
      icon: c.icon,
      onSelect: () => {
        navigate({ to: c.path });
        onOpenChange(false);
      },
    }));

    const modeItems: CommandItem[] = [
      {
        id: 'mode_engineer',
        title: t('commandPalette.switchToEngineer'),
        category: t('commandPalette.categoryMode'),
        icon: Cpu,
        badge: mode === 'engineer' ? t('commandPalette.activeLanguage') : 'Shift + E',
        onSelect: () => {
          setMode('engineer');
          onOpenChange(false);
        },
      },
      {
        id: 'mode_ops',
        title: t('commandPalette.switchToOps'),
        category: t('commandPalette.categoryMode'),
        icon: Briefcase,
        badge: mode === 'ops' ? t('commandPalette.activeLanguage') : 'Shift + E',
        onSelect: () => {
          setMode('ops');
          onOpenChange(false);
        },
      },
    ];

    const themeItems: CommandItem[] = [
      {
        id: 'theme_light',
        title: t('commandPalette.themeLight'),
        category: t('commandPalette.categoryTheme'),
        icon: Sun,
        badge: theme === 'light' ? t('commandPalette.activeLanguage') : undefined,
        onSelect: () => {
          setTheme('light');
          onOpenChange(false);
          toast.success(t('common.themeLight'), { description: t('common.switchedTheme') });
        },
      },
      {
        id: 'theme_dark',
        title: t('commandPalette.themeDark'),
        category: t('commandPalette.categoryTheme'),
        icon: Moon,
        badge: theme === 'dark' ? t('commandPalette.activeLanguage') : undefined,
        onSelect: () => {
          setTheme('dark');
          onOpenChange(false);
          toast.success(t('common.themeDark'), { description: t('common.switchedTheme') });
        },
      },
      {
        id: 'theme_system',
        title: t('commandPalette.themeSystem'),
        category: t('commandPalette.categoryTheme'),
        icon: Monitor,
        badge: theme === 'system' ? `${t('commandPalette.activeLanguage')} (${resolvedTheme})` : undefined,
        onSelect: () => {
          setTheme('system');
          onOpenChange(false);
          toast.success(t('common.themeSystem'), { description: t('common.switchedTheme') });
        },
      },
    ];

    const langItems: CommandItem[] = supportedLocales.map((loc) => ({
      id: `lang_${loc.code}`,
      title: `${loc.flag} ${loc.nativeName} (${loc.name})`,
      category: t('commandPalette.categoryLanguage'),
      icon: Globe,
      badge: loc.code === locale ? t('commandPalette.activeLanguage') : loc.dir.toUpperCase(),
      onSelect: () => {
        setLocale(loc.code as SupportedLocale);
        onOpenChange(false);
        toast.success(`${loc.nativeName} (${loc.name})`);
      },
    }));

    return [...modeItems, ...navItems, ...themeItems, ...langItems];
  }, [t, navigate, onOpenChange, supportedLocales, locale, setLocale, theme, setTheme, resolvedTheme, mode, setMode]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const lowerQuery = query.toLowerCase();
    return allCommands.filter(
      (c) =>
        c.title.toLowerCase().includes(lowerQuery) ||
        c.category.toLowerCase().includes(lowerQuery) ||
        c.id.toLowerCase().includes(lowerQuery),
    );
  }, [allCommands, query]);

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
        filteredCommands[selectedIndex].onSelect();
        setQuery('');
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
      <DialogContent className="p-0 max-w-xl bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-sky-500 dark:text-sky-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder={t('commandPalette.placeholder')}
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="p-2 max-h-80 overflow-y-auto space-y-1 custom-scrollbar">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
              {t('commandPalette.noResults')}
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isHighlighted = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => {
                    cmd.onSelect();
                    setQuery('');
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors group cursor-pointer text-left rtl:text-right',
                    isHighlighted
                      ? 'bg-sky-500/15 text-slate-900 dark:text-white font-medium border border-sky-500/30'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isHighlighted
                          ? 'text-sky-500 dark:text-sky-400'
                          : 'text-slate-400 group-hover:text-sky-500 dark:group-hover:text-sky-400',
                      )}
                    />
                    <span className="truncate">{cmd.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {cmd.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        {cmd.badge}
                      </span>
                    )}
                    <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-slate-500">
                      {cmd.category}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
