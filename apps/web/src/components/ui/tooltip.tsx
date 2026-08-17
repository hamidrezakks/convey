import type React from 'react';
import { useState } from 'react';
import { cn } from '../../lib/utils';

export interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[11px] font-medium text-slate-100 bg-slate-900/95 dark:bg-slate-950/95 border border-slate-700/80 dark:border-slate-800 rounded-md shadow-xl whitespace-nowrap z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100',
            className,
          )}
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-slate-950" />
        </div>
      )}
    </div>
  );
}
