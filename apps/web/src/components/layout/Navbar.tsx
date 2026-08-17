import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Globe, RefreshCw, Search, Terminal } from 'lucide-react';
import { Button } from '../ui/button';

export interface NavbarProps {
  onOpenCommandPalette: () => void;
}

export function Navbar({ onOpenCommandPalette }: NavbarProps) {
  const isFetching = useIsFetching();
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <header className="h-16 px-6 border-b border-slate-800/70 bg-[#070a12]/80 backdrop-blur-xl flex items-center justify-between shrink-0 z-10">
      {/* Global Quick Search Button (⌘K) */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          type="button"
          aria-label="Quick search commands, messages, and providers (Press Command K)"
          onClick={onOpenCommandPalette}
          className="w-80 md:w-96 h-9 px-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 hover:border-sky-500/40 hover:bg-slate-900/95 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all duration-150 flex items-center justify-between gap-3 group shadow-sm cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Search className="w-4 h-4 text-sky-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-xs text-slate-400 group-hover:text-slate-200 truncate whitespace-nowrap">
              Search messages, providers, traces...
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-slate-800/90 rounded-md border border-slate-700 text-slate-400 group-hover:text-slate-200 group-hover:border-slate-600 transition-colors shadow-inner">
              ⌘K
            </kbd>
          </div>
        </button>

        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 pl-1">
          <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Region:</span>
          <span className="font-mono text-slate-200 font-semibold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
            us-east-1 (Primary)
          </span>
        </div>
      </div>

      {/* Action Controls & Health */}
      <div className="flex items-center gap-3">
        {/* TanStack Query Reactive Fetching Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-mono text-[11px]">{isFetching > 0 ? 'Syncing...' : 'SSE Active (1.5s)'}</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="h-8 gap-1.5 text-xs rounded-lg"
          isLoading={isFetching > 0}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </Button>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <Button
            variant="glow"
            size="sm"
            className="h-8 gap-1.5 text-xs text-slate-950 font-bold rounded-lg"
            onClick={() => window.open('/swagger', '_blank')}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>OpenAPI Spec</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
