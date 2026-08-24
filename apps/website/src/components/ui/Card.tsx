import type React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
}

export function Card({ className, hover = false, glow = false, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'glass-panel rounded-2xl p-6 transition-all duration-300',
        hover && 'glass-panel-hover',
        glow && 'border-sky-500/30 shadow-[0_0_25px_-5px_rgba(56,189,248,0.15)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
