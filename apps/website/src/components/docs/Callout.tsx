import { AlertCircle, AlertTriangle, CheckCircle2, Info, ShieldCheck } from 'lucide-react';
import type React from 'react';
import { cn } from '../../lib/utils';

export interface CalloutProps {
  type?: 'note' | 'tip' | 'important' | 'warning' | 'security';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Callout({ type = 'note', title, children, className }: CalloutProps) {
  const configs = {
    note: {
      icon: Info,
      defaultTitle: 'Note',
      containerClass: 'bg-sky-500/10 border-sky-500/30 text-sky-200',
      iconClass: 'text-sky-400',
      titleClass: 'text-sky-400',
    },
    tip: {
      icon: CheckCircle2,
      defaultTitle: 'Tip',
      containerClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
      iconClass: 'text-emerald-400',
      titleClass: 'text-emerald-400',
    },
    important: {
      icon: AlertCircle,
      defaultTitle: 'Important',
      containerClass: 'bg-purple-500/10 border-purple-500/30 text-purple-200',
      iconClass: 'text-purple-400',
      titleClass: 'text-purple-400',
    },
    warning: {
      icon: AlertTriangle,
      defaultTitle: 'Warning',
      containerClass: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
      iconClass: 'text-amber-400',
      titleClass: 'text-amber-400',
    },
    security: {
      icon: ShieldCheck,
      defaultTitle: 'Security Best Practice',
      containerClass: 'bg-rose-500/10 border-rose-500/30 text-rose-200',
      iconClass: 'text-rose-400',
      titleClass: 'text-rose-400',
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div
      className={cn('rounded-xl border p-4 my-4 text-xs sm:text-sm leading-relaxed', config.containerClass, className)}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', config.iconClass)} />
        <div className="space-y-1">
          <div className={cn('font-semibold text-xs uppercase tracking-wider', config.titleClass)}>
            {title || config.defaultTitle}
          </div>
          <div className="text-slate-300 [&>p]:m-0 [&>p]:leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}
