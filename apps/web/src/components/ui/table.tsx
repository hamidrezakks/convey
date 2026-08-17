import type React from 'react';
import { cn } from '../../lib/utils';

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn('w-full caption-bottom text-sm text-start rtl:text-right', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        '[&_tr]:border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/40 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-start rtl:text-right',
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('[&_tr:last-child]:border-0 divide-y divide-slate-100 dark:divide-slate-800/60', className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-slate-100 dark:border-slate-800/60 transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-800/40 data-[state=selected]:bg-slate-100 dark:data-[state=selected]:bg-slate-800',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-10 px-4 text-start rtl:text-right align-middle font-medium text-slate-500 dark:text-slate-400 [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'p-4 align-middle text-start rtl:text-right text-slate-700 dark:text-slate-300 [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  );
}
