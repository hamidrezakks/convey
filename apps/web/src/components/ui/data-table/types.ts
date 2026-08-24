import type React from 'react';

export type TableAlignment = 'start' | 'center' | 'end';
export type TableDensity = 'compact' | 'normal' | 'relaxed';
export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface ColumnDef<TData, TValue = unknown> {
  /** Unique column identifier or key name in TData */
  id?: string;
  /** Property key on data item to access value directly */
  accessorKey?: keyof TData | string;
  /** Header label or custom header render function */
  header:
    | React.ReactNode
    | ((props: {
        column: ColumnDef<TData, TValue>;
        sortState?: SortState | null;
        onSort?: () => void;
      }) => React.ReactNode);
  /** Custom cell render function */
  cell?: (props: { row: TData; value: TValue; index: number }) => React.ReactNode;
  /** Horizontal content alignment (automatically adapts to RTL / LTR) */
  align?: TableAlignment;
  /** Column width specification (e.g., 'w-48', 'max-w-xs', '180px') */
  width?: string;
  /** Header class overrides */
  headerClassName?: string;
  /** Cell class overrides */
  cellClassName?: string;
  /** Enable sorting on this column */
  enableSorting?: boolean;
  /** Custom sort comparator or server sort key */
  sortKey?: string;
  /** Dynamic column visibility toggle (e.g. `!isOps`, `isEngineer`) */
  hidden?: boolean;
}

export interface DataTablePaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showTotalCount?: boolean;
  showPageNumbers?: boolean;
}

export interface DataTableEmptyConfig {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export interface DataTableProps<TData> {
  /** Column definitions */
  columns: ColumnDef<TData, unknown>[];
  /** Array of row data */
  data: TData[];
  /** Unique key extractor for each row (default: (row) => row.id || row.publicId || index) */
  getRowKey?: (row: TData, index: number) => string | number;
  /** Loading state flag */
  isLoading?: boolean;
  /** Number of skeleton rows to render during loading (default: 5) */
  skeletonRows?: number;
  /** Empty state configuration or custom component */
  emptyState?: DataTableEmptyConfig | React.ReactNode;
  /** Sorting state and callback */
  sortState?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  /** Pagination configuration (optional) */
  pagination?: DataTablePaginationConfig;
  /** Visual presentation variants */
  density?: TableDensity;
  stickyHeader?: boolean;
  striped?: boolean;
  bordered?: boolean;
  /** Row click handler */
  onRowClick?: (row: TData, index: number) => void;
  /** Custom row class extractor */
  rowClassName?: (row: TData, index: number) => string;
  /** Outer container class overrides */
  className?: string;
  /** Table element class overrides */
  tableClassName?: string;
  /** Header container class overrides */
  headerClassName?: string;
}
