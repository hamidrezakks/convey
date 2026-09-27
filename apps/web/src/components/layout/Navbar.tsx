import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Menu, RefreshCw, Search, Terminal } from 'lucide-react';
import { LanguageSwitcher, useI18n } from '../../i18n';
import { getSession, setSession } from '../../lib/session';
import { useUiMode } from '../../mode';
import { ThemeSwitcher } from '../../theme';
import { Button } from '../ui/button';

export interface NavbarProps {
  onOpenCommandPalette: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export function Navbar({ onOpenCommandPalette, onToggleSidebar }: NavbarProps) {
  const isFetching = useIsFetching();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { isEngineer } = useUiMode();

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <header className="h-16 px-3 sm:px-6 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#0d1322]/95 backdrop-blur-md flex items-center justify-between shrink-0 z-20 transition-colors duration-150 gap-2 sm:gap-4">
      {/* Left: Quick Search & Mobile Drawer Menu */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 max-w-md">
        {onToggleSidebar && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            aria-label="Toggle Navigation Sidebar"
            className="h-9 w-9 p-0 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 shrink-0 cursor-pointer md:hidden"
          >
            <Menu className="w-4 h-4" />
          </Button>
        )}

        <button
          type="button"
          aria-label={t('common.searchPlaceholder')}
          onClick={onOpenCommandPalette}
          className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-all duration-150 flex items-center justify-between gap-2 group cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 shrink-0 group-hover:text-sky-500 dark:group-hover:text-sky-400 transition-colors" />
            <span className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 truncate">
              {t('common.searchPlaceholder')}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 shadow-2xs">
              {t('common.searchShortcut')}
            </kbd>
          </div>
        </button>
      </div>

      {/* Right Controls: Theme, Lang, Telemetry, Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          className="text-xs px-2 py-1"
          onClick={() => {
            queryClient.clear();
            setSession('', null);
          }}
        >
          Sign out ({getSession()?.keyName})
        </button>
        <ThemeSwitcher variant="navbar" />
        <LanguageSwitcher variant="navbar" />

        {/* Live Telemetry Status Pill */}
        <div className="hidden lg:flex items-center gap-2 h-9 px-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium whitespace-nowrap shrink-0 select-none">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-mono text-[11px]">
            {isFetching > 0 ? t('common.syncing') : t('common.liveSseActive')}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="h-9 px-2.5 sm:px-3 gap-1.5 text-xs rounded-xl whitespace-nowrap shrink-0"
          isLoading={isFetching > 0}
          title={t('common.refresh')}
        >
          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">{t('common.refresh')}</span>
        </Button>

        {isEngineer && (
          <div className="flex items-center pl-1 rtl:pl-0 rtl:pr-1 border-l rtl:border-l-0 rtl:border-r border-slate-200/80 dark:border-slate-800">
            <Button
              variant="primary"
              size="sm"
              className="h-9 px-2.5 sm:px-3 gap-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 shadow-2xs"
              onClick={() => window.open('/swagger', '_blank')}
              title={t('common.openApiSpec')}
            >
              <Terminal className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">{t('common.openApiSpec')}</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
