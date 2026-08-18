import type React from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, containerClassName, children, ...props }, ref) => {
    return (
      <div className={cn('relative w-full', containerClassName)}>
        <select
          ref={ref}
          className={cn(
            'flex h-10 w-full appearance-none rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60 disabled:cursor-not-allowed disabled:opacity-50 transition-all pr-9 cursor-pointer shadow-2xs [&>option]:bg-white dark:[&>option]:bg-slate-900 [&>option]:text-slate-900 dark:[&>option]:text-slate-100 [&>optgroup]:bg-slate-100 dark:[&>optgroup]:bg-slate-950 [&>optgroup]:text-slate-600 dark:[&>optgroup]:text-slate-400 [&>optgroup]:font-bold',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  },
);

Select.displayName = 'Select';
