import type React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'purple' | 'cyan' | 'outline';
  dot?: boolean;
}

export function Badge({ className, variant = 'default', dot = false, children, ...props }: BadgeProps) {
  const baseStyles =
    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors select-none';

  const variants = {
    default:
      'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700/60',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25',
    warning: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/25',
    destructive: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25',
    purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25',
    cyan: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25',
    outline: 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-transparent',
  };

  const dotColors = {
    default: 'bg-slate-400',
    success: 'bg-emerald-500 dark:bg-emerald-400',
    warning: 'bg-amber-500 dark:bg-amber-400',
    destructive: 'bg-rose-500 dark:bg-rose-400',
    purple: 'bg-purple-500 dark:bg-purple-400',
    cyan: 'bg-sky-500 dark:bg-sky-400',
    outline: 'bg-slate-400 dark:bg-slate-500',
  };

  return (
    <span className={cn(baseStyles, variants[variant], className)} {...props}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 animate-pulse', dotColors[variant])} />}
      {children}
    </span>
  );
}
