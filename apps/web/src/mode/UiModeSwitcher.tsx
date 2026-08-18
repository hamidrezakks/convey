import { Briefcase, Cpu, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n';
import { cn } from '../lib/utils';
import { useUiMode } from './UiModeContext';

export interface UiModeSwitcherProps {
  variant?: 'navbar' | 'compact' | 'card' | 'sidebar';
  className?: string;
}

export function UiModeSwitcher({ variant = 'sidebar', className }: UiModeSwitcherProps) {
  const { mode, setMode, toggleMode } = useUiMode();
  const { t } = useI18n();

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleMode}
        title={mode === 'engineer' ? 'Switch to Operations Mode (Shift+E)' : 'Switch to Engineer Mode (Shift+E)'}
        className={cn(
          'w-9 h-9 flex items-center justify-center rounded-xl transition-all cursor-pointer border shadow-2xs mx-auto',
          mode === 'engineer'
            ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 hover:bg-sky-500/20'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
          className,
        )}
      >
        {mode === 'engineer' ? <Cpu className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
      </button>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2',
          className,
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-500" />
            <span className="text-xs font-semibold text-slate-900 dark:text-white">Workspace View Mode</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            Shift + E
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => setMode('engineer')}
            className={cn(
              'flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer select-none',
              mode === 'engineer'
                ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200',
            )}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{t('mode.engineerMode')}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('ops')}
            className={cn(
              'flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer select-none',
              mode === 'ops'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200',
            )}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>{t('mode.opsMode')}</span>
          </button>
        </div>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div
        className={cn(
          'grid grid-cols-2 gap-1 p-1 bg-slate-100/90 dark:bg-slate-900/90 rounded-xl border border-slate-200/80 dark:border-slate-800/80 select-none shadow-2xs',
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setMode('engineer')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer select-none',
            mode === 'engineer'
              ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium',
          )}
        >
          <Cpu className={cn('w-3.5 h-3.5 shrink-0', mode === 'engineer' ? 'scale-105' : 'opacity-70')} />
          <span className="truncate">{t('mode.engineerMode')}</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('ops')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer select-none',
            mode === 'ops'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium',
          )}
        >
          <Briefcase className={cn('w-3.5 h-3.5 shrink-0', mode === 'ops' ? 'scale-105' : 'opacity-70')} />
          <span className="truncate">{t('mode.opsMode')}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative inline-flex items-center p-1 rounded-xl bg-slate-100/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 select-none gap-0.5 shadow-2xs',
        className,
      )}
    >
      {/* Engineer Mode Button */}
      <button
        type="button"
        onClick={() => setMode('engineer')}
        title="Engineering Mode: Deep telemetry, W3C trace waterfalls, queue depths, V8 memory & circuits (Shift + E)"
        className={cn(
          'relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all duration-150 cursor-pointer',
          mode === 'engineer'
            ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/80'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium',
        )}
      >
        <Cpu
          className={cn('w-3.5 h-3.5 shrink-0 transition-transform', mode === 'engineer' ? 'scale-105' : 'opacity-70')}
        />
        <span className="truncate">{t('mode.engineerMode')}</span>
      </button>

      {/* Operations Mode Button */}
      <button
        type="button"
        onClick={() => setMode('ops')}
        title="Operations Mode: Clean business dashboard, delivery timelines, plain explanations (Shift + E)"
        className={cn(
          'relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all duration-150 cursor-pointer',
          mode === 'ops'
            ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs border border-slate-200/80 dark:border-slate-700/80'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium',
        )}
      >
        <Briefcase
          className={cn('w-3.5 h-3.5 shrink-0 transition-transform', mode === 'ops' ? 'scale-105' : 'opacity-70')}
        />
        <span className="truncate">{t('mode.opsMode')}</span>
      </button>
    </div>
  );
}
