import { Inbox } from 'lucide-react';
import { isValidElement, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import type { DataTableEmptyConfig } from './types';

export interface DataTableEmptyProps {
  config?: DataTableEmptyConfig | ReactNode;
  colSpan?: number;
  className?: string;
}

export function DataTableEmpty({ config, colSpan = 1, className }: DataTableEmptyProps) {
  if (isValidElement(config)) {
    return (
      <tr>
        <td colSpan={colSpan} className={cn('p-0', className)}>
          {config}
        </td>
      </tr>
    );
  }

  const emptyConfig = (config || {}) as DataTableEmptyConfig;
  const icon = emptyConfig.icon || <Inbox className="w-8 h-8 text-slate-400 dark:text-slate-500 stroke-[1.5]" />;
  const title = emptyConfig.title || 'No records found';
  const description = emptyConfig.description;
  const action = emptyConfig.action;

  return (
    <tr>
      <td colSpan={colSpan} className={cn('py-14 px-4 text-center select-none', className)}>
        <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
          <div className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
            {icon}
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{title}</h3>
            {description && <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>}
          </div>
          {action && <div className="pt-1">{action}</div>}
        </div>
      </td>
    </tr>
  );
}
