import { cn } from '../../../lib/utils';
import type { ColumnDef, TableDensity } from './types';

export interface DataTableSkeletonProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  rowCount?: number;
  density?: TableDensity;
}

export function DataTableSkeleton<TData>({ columns, rowCount = 5, density = 'normal' }: DataTableSkeletonProps<TData>) {
  const visibleColumns = columns.filter((col) => !col.hidden);

  const rowPadding = density === 'compact' ? 'py-2 px-3' : density === 'relaxed' ? 'py-4 px-5' : 'py-3.5 px-4';

  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <tr
          // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholder rows are static and unkeyed
          key={`skeleton-row-${rowIndex}`}
          className="border-b border-slate-100 dark:border-slate-800/40 animate-pulse"
        >
          {visibleColumns.map((col, colIndex) => {
            const widthClass =
              col.width || (colIndex === 0 ? 'w-32' : colIndex === visibleColumns.length - 1 ? 'w-20' : 'w-24');

            const isEnd = col.align === 'end';
            const isCenter = col.align === 'center';

            return (
              <td
                // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton cells match column index
                key={`skeleton-cell-${rowIndex}-${colIndex}`}
                className={cn(rowPadding, col.cellClassName)}
              >
                <div
                  className={cn(
                    'h-4 rounded-md bg-slate-200/80 dark:bg-slate-800/80',
                    widthClass,
                    isEnd && 'ms-auto',
                    isCenter && 'mx-auto',
                  )}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
