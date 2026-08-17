import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, icon, ...props }, ref) => {
  return (
    <div className="relative flex items-center w-full">
      {icon && (
        <div className="absolute left-3 text-slate-400 dark:text-slate-400 pointer-events-none flex items-center">
          {icon}
        </div>
      )}
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-1 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          icon ? 'pl-9' : '',
          className,
        )}
        ref={ref}
        {...props}
      />
    </div>
  );
});

Input.displayName = 'Input';
