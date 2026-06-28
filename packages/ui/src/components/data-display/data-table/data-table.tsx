'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
  type Table as ReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  type TablePaginationProps,
} from '../table';
import { cn } from '../../../lib/utils';

export type { ColumnDef } from '@tanstack/react-table';

export type DataTableColumn<TData, TValue = unknown> = ColumnDef<TData, TValue> & {
  /**
   * Optional shorthand to render a React component in the column cell.
   * Useful for CTA buttons, badges, and row action controls.
   */
  component?: (row: TData) => React.ReactNode;
};

export type DataTablePaginationProps = Omit<TablePaginationProps, 'className'> & {
  /** Optional className override for pagination wrapper. */
  className?: string;
};

export interface DataTableProps<TData, TValue> {
  columns: DataTableColumn<TData, TValue>[];
  data: TData[];
  /** Optional empty-state message. */
  emptyMessage?: React.ReactNode;
  /** Enable sorting (uses table's getSortedRowModel). Default: true. */
  sortable?: boolean;
  /** Initial sort. */
  initialSorting?: SortingState;
  /** Controlled column visibility map. */
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: React.Dispatch<React.SetStateAction<VisibilityState>>;
  /** Enable row selection. */
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  /** Pass-through ref to the underlying table instance, e.g. for toolbars. */
  tableRef?: React.MutableRefObject<ReactTable<TData> | null>;
  /** Optional pagination config. When set, renders <TablePagination> below the table. */
  pagination?: DataTablePaginationProps;
  /** Optional className on the outer wrapper. */
  className?: string;
  /** Optional data-testid on the table element. */
  'data-testid'?: string;
}

/**
 * Headless-table primitive built on `@tanstack/react-table`. Renders into the
 * shared `<Table>` shadcn primitive so styling stays consistent. Pages compose
 * columns + data and stay thin.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = 'No results.',
  sortable = true,
  initialSorting,
  columnVisibility,
  onColumnVisibilityChange,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
  tableRef,
  pagination,
  className,
  ...rest
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(
    initialSorting ?? [],
  );

  const table = useReactTable<TData>({
    data,
    columns,
    state: {
      sorting: internalSorting,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setInternalSorting,
    onColumnVisibilityChange,
    onRowSelectionChange,
    enableRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: sortable ? getSortedRowModel() : undefined,
  });

  React.useEffect(() => {
    if (tableRef) tableRef.current = table;
  }, [table, tableRef]);

  const testId = rest['data-testid'];

  return (
    <div className={className}>
      <Table data-testid={testId}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isSortable = sortable && header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                const sortDirection = sorted === 'asc' || sorted === 'desc' ? sorted : undefined;

                return (
                  <TableHead
                    key={header.id}
                    sortable={isSortable}
                    sortDirection={sortDirection}
                    sortLabel={
                      typeof header.column.columnDef.header === 'string'
                        ? `Sort by ${header.column.columnDef.header}`
                        : 'Sort column'
                    }
                    onSort={isSortable ? header.column.getToggleSortingHandler() : undefined}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={
                  enableRowSelection && row.getIsSelected() ? 'selected' : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {(() => {
                      const columnDef = cell.column.columnDef as DataTableColumn<TData, TValue>;

                      if (columnDef.component) {
                        return columnDef.component(row.original);
                      }

                      return flexRender(columnDef.cell, cell.getContext());
                    })()}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {pagination ? (
        <TablePagination
          {...pagination}
          className={cn('mt-3', pagination.className)}
        />
      ) : null}
    </div>
  );
}
