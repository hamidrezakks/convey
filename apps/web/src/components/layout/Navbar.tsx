import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Globe, Menu, PanelLeftClose, PanelLeftOpen, RefreshCw, Search, Terminal } from 'lucide-react';
import { LanguageSwitcher, useI18n } from '../../i18n';
import { ThemeSwitcher } from '../../theme';
import { Button } from '../ui/button';

export interface NavbarProps {
  onOpenCommandPalette: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export function Navbar({ onOpenCommandPalette, onToggleSidebar, isSidebarCollapsed }: NavbarProps) {
  const isFetching = useIsFetching();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <header className="h-16 px-3 sm:px-6 border-b border-slate-200/80 dark:border-slate-800/70 bg-white/80 dark:bg-[#070a12]/80 backdrop-blur-xl flex items-center justify-between shrink-0 z-10 transition-colors duration-150 gap-2 sm:gap-3">
      {/* Left: Sidebar Toggle & Search Bar */}
      <div className="flex items-center gap-2 min-w-0 flex-1 max-w-sm">
        {onToggleSidebar && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            aria-label="Toggle Navigation Sidebar"
            className="h-9 w-9 p-0 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 shrink-0 cursor-pointer"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4 hidden md:block" />
            )}
            <Menu className="w-4 h-4 md:hidden" />
          </Button>
        )}

        <button
          type="button"
          aria-label={t('common.searchPlaceholder')}
          onClick={onOpenCommandPalette}
          className="flex-1 min-w-0 h-9 px-2.5 sm:px-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/90 hover:border-sky-500/40 hover:bg-slate-100 dark:hover:bg-slate-900/95 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all duration-150 flex items-center justify-between gap-2 group shadow-xs cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 truncate">
              {t('common.searchPlaceholder')}
            </span>
          </div>
          <div className="hidden 2xl:flex items-center gap-1 shrink-0">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-200/80 dark:bg-slate-800/90 rounded-md border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors shadow-inner">
              {t('common.searchShortcut')}
            </kbd>
          </div>
        </button>

        <div className="hidden 2xl:flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap shrink-0 select-none">
          <Globe className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
          <span>{t('common.region')}:</span>
          <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
            {t('common.primaryRegion')}
          </span>
        </div>
      </div>

      {/* Right Actions: Theme, Lang, Telemetry, Refresh, Swagger */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <ThemeSwitcher variant="navbar" />
        <LanguageSwitcher variant="navbar" />

        <div className="hidden 2xl:flex items-center gap-2 h-9 px-3 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium whitespace-nowrap shrink-0 select-none">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-mono text-[11px]">
            {isFetching > 0 ? t('common.syncing') : t('common.liveSseActive')}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="h-9 px-2.5 sm:px-3 gap-1.5 text-xs rounded-lg whitespace-nowrap shrink-0"
          isLoading={isFetching > 0}
          title={t('common.refresh')}
        >
          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">{t('common.refresh')}</span>
        </Button>

        <div className="flex items-center pl-1 rtl:pl-0 rtl:pr-1 border-l rtl:border-l-0 rtl:border-r border-slate-200 dark:border-slate-800">
          <Button
            variant="glow"
            size="sm"
            className="h-9 px-2.5 sm:px-3 gap-1.5 text-xs text-slate-950 font-bold rounded-lg whitespace-nowrap shrink-0 shadow-sm"
            onClick={() => window.open('/swagger', '_blank')}
            title={t('common.openApiSpec')}
          >
            <Terminal className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline">{t('common.openApiSpec')}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
