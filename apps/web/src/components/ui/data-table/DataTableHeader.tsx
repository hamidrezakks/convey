import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { TableHeader as PrimitiveHeader, TableHead, TableRow } from '../table';
import type { ColumnDef, SortState, TableDensity } from './types';

export interface DataTableHeaderProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  sortState?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  sticky?: boolean;
  density?: TableDensity;
  className?: string;
}

export function DataTableHeader<TData>({
  columns,
  sortState,
  onSortChange,
  sticky = false,
  density = 'normal',
  className,
}: DataTableHeaderProps<TData>) {
  const visibleColumns = columns.filter((col) => !col.hidden);

  const getAlignmentClass = (align?: 'start' | 'center' | 'end') => {
    switch (align) {
      case 'end':
        return 'text-end rtl:text-left';
      case 'center':
        return 'text-center';
      default:
        return 'text-start rtl:text-right';
    }
  };

  const getDensityClass = (d: TableDensity) => {
    switch (d) {
      case 'compact':
        return 'h-8 px-3 py-1 text-[11px]';
      case 'relaxed':
        return 'h-12 px-5 py-3 text-xs';
      default:
        return 'h-10 px-4 py-2 text-xs';
    }
  };

  const handleSort = (column: ColumnDef<TData, unknown>) => {
    if (!column.enableSorting || !onSortChange) return;

    const columnKey = (column.sortKey || column.id || column.accessorKey) as string;
    if (!columnKey) return;

    if (!sortState || sortState.key !== columnKey) {
      onSortChange({ key: columnKey, direction: 'asc' });
    } else if (sortState.direction === 'asc') {
      onSortChange({ key: columnKey, direction: 'desc' });
    } else {
      onSortChange(null);
    }
  };

  return (
    <PrimitiveHeader sticky={sticky} className={className}>
      <TableRow>
        {visibleColumns.map((col, index) => {
          const columnKey = (col.id || col.accessorKey || `col-${index}`) as string;
          const isSorted = sortState?.key === (col.sortKey || col.id || col.accessorKey);
          const sortDirection = isSorted ? (sortState?.direction ?? null) : null;
          const isSortable = !!col.enableSorting && !!onSortChange;

          const alignClass = getAlignmentClass(col.align);
          const densityClass = getDensityClass(density);

          return (
            <TableHead
              key={columnKey}
              className={cn(
                alignClass,
                densityClass,
                col.width,
                isSortable && 'cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors',
                col.headerClassName,
              )}
              onClick={() => handleSort(col)}
              aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
            >
              <div
                className={cn(
                  'inline-flex items-center gap-1.5',
                  col.align === 'end' && 'justify-end w-full',
                  col.align === 'center' && 'justify-center w-full',
                  col.align === 'start' && 'justify-start',
                )}
              >
                <span>
                  {typeof col.header === 'function'
                    ? col.header({
                        column: col,
                        sortState,
                        onSort: () => handleSort(col),
                      })
                    : col.header}
                </span>

                {isSortable && (
                  <span className="text-slate-400 shrink-0">
                    {sortDirection === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 stroke-[2.5]" />
                    ) : sortDirection === 'desc' ? (
                      <ArrowDown className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 stroke-[2.5]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100 transition-opacity" />
                    )}
                  </span>
                )}
              </div>
            </TableHead>
          );
        })}
      </TableRow>
    </PrimitiveHeader>
  );
}
