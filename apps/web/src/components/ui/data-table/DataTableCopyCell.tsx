import { Check, Copy } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { cn } from '../../../lib/utils';

export interface DataTableCopyCellProps {
  value: string;
  displayValue?: string;
  tooltip?: string;
  className?: string;
  buttonClassName?: string;
  showIconAlways?: boolean;
}

export function DataTableCopyCell({
  value,
  displayValue,
  tooltip = 'Copy to clipboard',
  className,
  buttonClassName,
  showIconAlways = false,
}: DataTableCopyCellProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('inline-flex items-center gap-1.5 group/copy font-mono text-xs', className)}>
      <span className="truncate">{displayValue ?? value}</span>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'p-0.5 rounded transition-all duration-150 cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
          showIconAlways ? 'opacity-100' : 'opacity-0 group-hover/copy:opacity-100 group-hover:opacity-100',
          copied && 'opacity-100 text-emerald-500 dark:text-emerald-400',
          buttonClassName,
        )}
        title={copied ? 'Copied!' : tooltip}
        aria-label={copied ? 'Copied' : tooltip}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 stroke-[2.5]" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
