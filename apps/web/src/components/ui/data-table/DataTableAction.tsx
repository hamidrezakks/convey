import { RefreshCw } from 'lucide-react';
import type React from 'react';

export type DataTableActionVariant = 'default' | 'outline' | 'ghost' | 'danger' | 'success' | 'primary';

export interface DataTableActionProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  icon?: React.ReactNode;
  label?: React.ReactNode;
  variant?: DataTableActionVariant;
  isLoading?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  title?: string;
}

/**
 * Standardized enterprise row action button for DataTables.
 * Provides unified dimensions (h-7, rounded-lg, text-xs), consistent padding,
 * uniform icon sizing (3.5x3.5), and cohesive micro-animations across all pages.
 */
export function DataTableAction({
  icon,
  label,
  variant = 'default',
  isLoading = false,
  onClick,
  className = '',
  disabled,
  title,
  ...props
}: DataTableActionProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!disabled && !isLoading && onClick) {
      onClick(e);
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-sky-600 hover:bg-sky-500 text-white shadow-2xs border border-sky-500/30';
      case 'danger':
        return 'border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40 hover:text-rose-700 dark:hover:text-rose-300';
      case 'success':
        return 'border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-700 dark:hover:text-emerald-300';
      case 'ghost':
        return 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80';
      case 'outline':
        return 'border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white';
      default:
        return 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 dark:hover:bg-sky-950/40 dark:hover:text-sky-400 dark:hover:border-sky-700/60 shadow-2xs';
    }
  };

  const isIconOnly = !label && !!icon;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      title={title}
      className={`
        inline-flex items-center justify-center font-medium text-xs rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
        h-7
        ${isIconOnly ? 'w-7 px-0' : 'px-2.5 gap-1.5'}
        ${getVariantStyles()}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-current" />
      ) : (
        icon && <span className="shrink-0 flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
      )}
      {label && <span className="truncate">{label}</span>}
    </button>
  );
}

export interface DataTableActionGroupProps {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
}

/**
 * Standardized action container for aligning row actions in DataTables.
 */
export function DataTableActionGroup({ children, className = '', align = 'end' }: DataTableActionGroupProps) {
  const alignClass = align === 'start' ? 'justify-start' : align === 'center' ? 'justify-center' : 'justify-end';

  return (
    <div className={`inline-flex items-center ${alignClass} gap-1.5 whitespace-nowrap ${className}`}>{children}</div>
  );
}
