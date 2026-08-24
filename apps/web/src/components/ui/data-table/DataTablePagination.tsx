import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button } from '../button';
import { Select } from '../select';
import type { DataTablePaginationConfig } from './types';

export interface DataTablePaginationProps {
  config: DataTablePaginationConfig;
  className?: string;
}

export function DataTablePagination({ config, className }: DataTablePaginationProps) {
  const {
    page,
    pageSize,
    total,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 15, 25, 50],
    showTotalCount = true,
    showPageNumbers = true,
  } = config;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(total, page * pageSize);

  // Generate visible page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/80 dark:border-slate-800/80 text-xs select-none',
        className,
      )}
    >
      {/* Total item count / range */}
      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-mono">
        {showTotalCount && (
          <span>
            {total > 0 ? (
              <>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {startItem.toLocaleString()} - {endItem.toLocaleString()}
                </span>{' '}
                of <span className="font-semibold text-slate-800 dark:text-slate-200">{total.toLocaleString()}</span>
              </>
            ) : (
              '0 records'
            )}
          </span>
        )}

        {/* Page Size Selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ms-2 ps-2 border-s border-slate-200 dark:border-slate-800 font-sans">
            <span className="text-[11px] text-slate-500">Rows:</span>
            <Select
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 text-xs py-0 px-2 rounded-lg font-mono"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1.5 ms-auto">
        {/* First Page */}
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          className="h-8 w-8 p-0 rounded-xl"
          title="First page"
          aria-label="First page"
        >
          <ChevronsLeft className="w-4 h-4 rtl:rotate-180" />
        </Button>

        {/* Previous Page */}
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-8 px-2.5 rounded-xl gap-1"
          title="Previous page"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
          <span className="hidden sm:inline">Prev</span>
        </Button>

        {/* Numeric Page Buttons */}
        {showPageNumbers && (
          <div className="hidden md:flex items-center gap-1">
            {getPageNumbers().map((p, idx) =>
              typeof p === 'number' ? (
                <Button
                  // biome-ignore lint/suspicious/noArrayIndexKey: Page list is computed
                  key={`page-${p}-${idx}`}
                  variant={page === p ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => onPageChange(p)}
                  className={cn('h-8 w-8 p-0 rounded-xl font-mono text-xs', page === p && 'shadow-2xs font-bold')}
                >
                  {p}
                </Button>
              ) : (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: Ellipsis is static
                  key={`ellipsis-${idx}`}
                  className="px-1 text-slate-400 dark:text-slate-600 font-mono"
                >
                  ...
                </span>
              ),
            )}
          </div>
        )}

        {/* Current page indicator on small screens */}
        <div className="md:hidden text-xs font-mono text-slate-600 dark:text-slate-300 px-1.5">
          {page} / {totalPages}
        </div>

        {/* Next Page */}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-8 px-2.5 rounded-xl gap-1"
          title="Next page"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </Button>

        {/* Last Page */}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="h-8 w-8 p-0 rounded-xl"
          title="Last page"
          aria-label="Last page"
        >
          <ChevronsRight className="w-4 h-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
