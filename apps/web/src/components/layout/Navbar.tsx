import { Command, Globe, RefreshCw, Terminal } from 'lucide-react';
import { Button } from '../ui/button';

export interface NavbarProps {
  onOpenCommandPalette: () => void;
  onRefresh?: () => void;
  isLiveStreaming?: boolean;
}

export function Navbar({ onOpenCommandPalette, onRefresh, isLiveStreaming = true }: NavbarProps) {
  return (
    <header className="h-16 px-6 border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md flex items-center justify-between shrink-0">
      {/* Global Quick Search Button (⌘K) */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all w-72 justify-between group shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Command className="w-3.5 h-3.5 text-sky-400" />
            <span>Search messages, providers, traces...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 rounded border border-slate-700 text-slate-400 group-hover:text-slate-300">
            ⌘K
          </kbd>
        </button>

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 pl-2">
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span>Region:</span>
          <span className="font-mono text-slate-200 font-medium">us-east-1 (Primary)</span>
        </div>
      </div>

      {/* Action Controls & Health */}
      <div className="flex items-center gap-3">
        {/* Live Stream Heartbeat Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Telemetry: {isLiveStreaming ? 'SSE Active (1s)' : 'Polling'}</span>
        </div>

        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} className="h-8 gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        )}

        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <Button
            variant="glow"
            size="sm"
            className="h-8 gap-1.5 text-xs text-slate-950 font-bold"
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
