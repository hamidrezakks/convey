import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'purple' | 'cyan' | 'outline';
  dot?: boolean;
}

export function Badge({ className, variant = 'default', dot = false, children, ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium';

  const variants = {
    default: 'bg-slate-800 text-slate-300 border border-slate-700/60',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    destructive: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    cyan: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
    outline: 'border border-slate-700 text-slate-400',
  };

  const dotColors = {
    default: 'bg-slate-400',
    success: 'bg-emerald-400 animate-pulse',
    warning: 'bg-amber-400',
    destructive: 'bg-rose-400',
    purple: 'bg-purple-400',
    cyan: 'bg-sky-400',
    outline: 'bg-slate-500',
  };

  return (
    <span className={cn(baseStyles, variants[variant], className)} {...props}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}
