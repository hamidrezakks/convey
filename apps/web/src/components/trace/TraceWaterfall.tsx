import type { TraceSpan } from '@convey/shared';
import { Check, Clock, Copy, Info, Layers } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../i18n/context';
import { cn, formatDurationMs } from '../../lib/utils';
import { Badge } from '../ui/badge';

export interface TraceWaterfallProps {
  traceparent?: string;
  spans?: TraceSpan[];
}

export function TraceWaterfall({ traceparent, spans = [] }: TraceWaterfallProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  // Compute total duration of the trace
  const totalDurationMs = spans.reduce((max, s) => Math.max(max, (s.startTimeMs || 0) + (s.durationMs || 0)), 0) || 1;

  const handleCopyTraceparent = () => {
    if (traceparent) {
      navigator.clipboard.writeText(traceparent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getServiceColor = (serviceName: string) => {
    if (serviceName.includes('api')) return 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30';
    if (serviceName.includes('postgres') || serviceName.includes('db'))
      return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30';
    if (serviceName.includes('worker') || serviceName.includes('queue'))
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    if (serviceName.includes('router') || serviceName.includes('scheduler'))
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30';
    if (serviceName.includes('webhook'))
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
    return 'bg-slate-100 dark:bg-slate-700/30 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  const getSpanBarGradient = (serviceName: string, status: 'OK' | 'ERROR') => {
    if (status === 'ERROR') return 'from-rose-500 to-rose-600';
    if (serviceName.includes('api')) return 'from-sky-500 to-cyan-400';
    if (serviceName.includes('postgres') || serviceName.includes('db')) return 'from-indigo-500 to-purple-500';
    if (serviceName.includes('worker')) return 'from-amber-500 to-orange-400';
    if (serviceName.includes('router') || serviceName.includes('scheduler')) return 'from-violet-500 to-fuchsia-500';
    if (serviceName.includes('webhook')) return 'from-emerald-500 to-teal-400';
    return 'from-sky-500 to-blue-600';
  };

  return (
    <div className="space-y-4">
      {/* Trace Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">{t('trace.title')}</span>
              <Badge variant="cyan">{spans.length} Spans</Badge>
            </div>
            {traceparent && (
              <p
                className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-md"
                style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
              >
                {traceparent}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Clock className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            <span>{formatDurationMs(totalDurationMs)}</span>
          </div>

          {traceparent && (
            <button
              type="button"
              onClick={handleCopyTraceparent}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
              title={t('trace.copyTraceparent')}
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Waterfall Visualizer */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 p-4 space-y-2">
        {/* Timeline Axis */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-200 dark:border-slate-800/80 mb-3">
          <span>0ms</span>
          <span>{formatDurationMs(totalDurationMs * 0.25)}</span>
          <span>{formatDurationMs(totalDurationMs * 0.5)}</span>
          <span>{formatDurationMs(totalDurationMs * 0.75)}</span>
          <span>{formatDurationMs(totalDurationMs)}</span>
        </div>

        {/* Spans List */}
        <div className="space-y-2">
          {spans.map((span) => {
            const leftPercent = Math.min(98.5, Math.max(0, ((span.startTimeMs || 0) / totalDurationMs) * 100));
            const widthPercent = Math.min(
              100 - leftPercent,
              Math.max(1.5, ((span.durationMs || 0) / totalDurationMs) * 100),
            );
            const isSelected = selectedSpanId === span.id;

            return (
              <div
                key={span.id}
                onClick={() => setSelectedSpanId(isSelected ? null : span.id)}
                className={cn(
                  'p-2.5 rounded-lg border transition-all cursor-pointer group',
                  isSelected
                    ? 'bg-white dark:bg-slate-900 border-sky-500/50 shadow-md'
                    : 'bg-white/80 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900/80 border-slate-200 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700',
                )}
              >
                {/* Span Header */}
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-[10px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded border',
                        getServiceColor(span.serviceName),
                      )}
                    >
                      {span.serviceName}
                    </span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-medium group-hover:text-sky-600 dark:group-hover:text-sky-300 transition-colors">
                      {span.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {formatDurationMs(span.durationMs)}
                    </span>
                    <Badge variant={span.status === 'OK' ? 'success' : 'destructive'}>{span.status}</Badge>
                  </div>
                </div>

                {/* Gantt Bar Line */}
                <div className="relative h-2 w-full bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-300/60 dark:border-slate-800/40">
                  <div
                    className={cn(
                      'absolute h-full rounded-full bg-gradient-to-r transition-all duration-300 shadow-sm',
                      getSpanBarGradient(span.serviceName, span.status),
                    )}
                    style={{
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                    }}
                  />
                </div>

                {/* Expanded Details Drawer */}
                {isSelected && span.attributes && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 text-[11px] space-y-1.5 font-mono text-slate-700 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-950/40 p-2.5 rounded-lg">
                    <div className="text-[10px] uppercase font-sans font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Info className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                      <span>Span Attributes & OpenTelemetry Metadata</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                      {Object.entries(span.attributes).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between bg-white dark:bg-slate-900/80 px-2 py-1 rounded border border-slate-200 dark:border-slate-800/80"
                        >
                          <span className="text-slate-500 dark:text-slate-400">{k}:</span>
                          <span className="text-sky-600 dark:text-sky-300 font-semibold">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
