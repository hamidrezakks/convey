import { cn } from '../../../lib/utils';
import { TableBody, TableCell, TableRow } from '../table';
import { DataTableEmpty } from './DataTableEmpty';
import { DataTableSkeleton } from './DataTableSkeleton';
import type { ColumnDef, DataTableEmptyConfig, TableDensity } from './types';

export interface DataTableBodyProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  getRowKey?: (row: TData, index: number) => string | number;
  isLoading?: boolean;
  skeletonRows?: number;
  emptyState?: DataTableEmptyConfig | React.ReactNode;
  density?: TableDensity;
  striped?: boolean;
  onRowClick?: (row: TData, index: number) => void;
  rowClassName?: (row: TData, index: number) => string;
}

export function DataTableBody<TData>({
  columns,
  data,
  getRowKey,
  isLoading = false,
  skeletonRows = 5,
  emptyState,
  density = 'normal',
  striped = false,
  onRowClick,
  rowClassName,
}: DataTableBodyProps<TData>) {
  const visibleColumns = columns.filter((col) => !col.hidden);
  const totalColumns = visibleColumns.length || 1;

  if (isLoading) {
    return (
      <TableBody>
        <DataTableSkeleton columns={columns} rowCount={skeletonRows} density={density} />
      </TableBody>
    );
  }

  if (data.length === 0) {
    return (
      <TableBody>
        <DataTableEmpty config={emptyState} colSpan={totalColumns} />
      </TableBody>
    );
  }

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
        return 'py-2 px-3 text-xs';
      case 'relaxed':
        return 'py-4 px-5 text-sm';
      default:
        return 'py-3 px-4 text-xs';
    }
  };

  return (
    <TableBody>
      {data.map((row, rowIndex) => {
        const rowKey = getRowKey
          ? getRowKey(row, rowIndex)
          : (row as Record<string, unknown>)?.id !== undefined
            ? String((row as Record<string, unknown>).id)
            : (row as Record<string, unknown>)?.publicId !== undefined
              ? String((row as Record<string, unknown>).publicId)
              : (row as Record<string, unknown>)?.key !== undefined
                ? String((row as Record<string, unknown>).key)
                : rowIndex;

        const customRowClass = rowClassName ? rowClassName(row, rowIndex) : '';
        const isClickable = !!onRowClick;

        return (
          <TableRow
            key={rowKey}
            onClick={isClickable ? () => onRowClick(row, rowIndex) : undefined}
            className={cn(
              'group transition-colors',
              isClickable && 'cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/60',
              striped && rowIndex % 2 === 1 && 'bg-slate-50/40 dark:bg-slate-900/30',
              customRowClass,
            )}
          >
            {visibleColumns.map((col, colIndex) => {
              const columnKey = (col.id || col.accessorKey || `col-${colIndex}`) as string;
              const alignClass = getAlignmentClass(col.align);
              const densityClass = getDensityClass(density);

              const cellValue = col.accessorKey
                ? (row as Record<string, unknown>)[col.accessorKey as string]
                : undefined;

              return (
                <TableCell key={columnKey} className={cn(alignClass, densityClass, col.width, col.cellClassName)}>
                  {col.cell
                    ? col.cell({ row, value: cellValue, index: rowIndex })
                    : cellValue !== undefined
                      ? String(cellValue)
                      : null}
                </TableCell>
              );
            })}
          </TableRow>
        );
      })}
    </TableBody>
  );
}
