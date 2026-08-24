import { useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import { Table } from '../table';
import { DataTableBody } from './DataTableBody';
import { DataTableHeader } from './DataTableHeader';
import { DataTablePagination } from './DataTablePagination';
import type { DataTableProps, SortState } from './types';

export function DataTable<TData>({
  columns,
  data,
  getRowKey,
  isLoading = false,
  skeletonRows = 5,
  emptyState,
  sortState: controlledSortState,
  onSortChange: controlledOnSortChange,
  pagination,
  density = 'normal',
  stickyHeader = false,
  striped = false,
  bordered = false,
  onRowClick,
  rowClassName,
  className,
  tableClassName,
  headerClassName,
}: DataTableProps<TData>) {
  // Internal sort state when not externally controlled
  const [internalSortState, setInternalSortState] = useState<SortState | null>(null);

  const isControlledSort = controlledOnSortChange !== undefined;
  const activeSortState = isControlledSort ? controlledSortState : internalSortState;

  const handleSortChange = (newSort: SortState | null) => {
    if (isControlledSort) {
      controlledOnSortChange?.(newSort);
    } else {
      setInternalSortState(newSort);
    }
  };

  // Perform client-side sorting when sorting is uncontrolled and data is provided
  const processedData = useMemo(() => {
    if (isControlledSort || !activeSortState || !activeSortState.key) {
      return data;
    }

    const { key, direction } = activeSortState;
    const sorted = [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)?.[key];
      const bVal = (b as Record<string, unknown>)?.[key];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return sorted;
  }, [data, isControlledSort, activeSortState]);

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-colors',
        bordered && 'border-slate-300 dark:border-slate-700',
        className,
      )}
    >
      <Table className={tableClassName}>
        <DataTableHeader
          columns={columns}
          sortState={activeSortState}
          onSortChange={handleSortChange}
          sticky={stickyHeader}
          density={density}
          className={headerClassName}
        />
        <DataTableBody
          columns={columns}
          data={processedData}
          getRowKey={getRowKey}
          isLoading={isLoading}
          skeletonRows={skeletonRows}
          emptyState={emptyState}
          density={density}
          striped={striped}
          onRowClick={onRowClick}
          rowClassName={rowClassName}
        />
      </Table>

      {pagination && <DataTablePagination config={pagination} />}
    </div>
  );
}
