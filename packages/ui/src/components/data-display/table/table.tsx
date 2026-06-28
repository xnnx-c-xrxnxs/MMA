import * as React from 'react';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, MoreHorizIcon, SortIcon } from '../../../icons';
import { cn } from '../../../lib/utils';
import { Button } from '../../form-controls/button';
import { Select } from '../../form-controls/select';

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto rounded border border-input bg-background">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('bg-muted [&_tr]:border-b [&_tr]:border-input', className)} {...props} />
  ),
);
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  ),
);
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('border-b border-input transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted/40', className)}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

export type TableSortDirection = 'asc' | 'desc';

export interface TableSortButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  direction?: TableSortDirection;
  active?: boolean;
}

const TableSortButton = React.forwardRef<HTMLButtonElement, TableSortButtonProps>(
  ({ className, direction, active = false, children, type = 'button', ...props }, ref) => (
    <Button
      ref={ref}
      type={type}
      variant="ghost"
      size="sm"
      className={cn(
        'group h-auto rounded px-1 py-0 text-inherit',
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      <SortIcon
        size={14}
        className={cn(
          'shrink-0 transition-colors',
          active ? 'text-foreground' : 'text-muted-foreground',
          direction === 'desc' && 'rotate-180',
        )}
      />
    </Button>
  ),
);
TableSortButton.displayName = 'TableSortButton';

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDirection?: TableSortDirection;
  onSort?: React.MouseEventHandler<HTMLButtonElement>;
  sortLabel?: string;
  align?: 'left' | 'right';
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, sortable = false, sortDirection, onSort, sortLabel, align = 'left', children, ...props }, ref) => {
    const isSortable = sortable || typeof onSort === 'function';
    const ariaSort = isSortable
      ? sortDirection === 'asc'
        ? 'ascending'
        : sortDirection === 'desc'
          ? 'descending'
          : 'none'
      : props['aria-sort'];

    return (
      <th
        ref={ref}
        aria-sort={ariaSort}
        className={cn(
          'h-13 px-6 py-3 align-middle text-sm font-semibold text-foreground [&:has([role=checkbox])]:pr-0',
          align === 'right' ? 'text-right' : 'text-left',
          className,
        )}
        {...props}
      >
        {isSortable ? (
          <TableSortButton
            active={Boolean(sortDirection)}
            direction={sortDirection}
            onClick={onSort}
            aria-label={sortLabel}
            className={cn('w-full', align === 'right' ? 'justify-end text-right' : 'justify-start text-left')}
          >
            {children}
          </TableSortButton>
        ) : (
          children
        )}
      </th>
    );
  },
);
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn('px-6 py-3 align-middle text-sm text-foreground [&:has([role=checkbox])]:pr-0', className)}
      {...props}
    />
  ),
);
TableCell.displayName = 'TableCell';

type PaginationItem = number | 'ellipsis-left' | 'ellipsis-right';

function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-right', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis-left', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [
    1,
    'ellipsis-left',
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
    'ellipsis-right',
    totalPages,
  ];
}

export interface TablePaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  totalResults: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  resultsPerPage?: number;
  onResultsPerPageChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

const TablePagination = React.forwardRef<HTMLDivElement, TablePaginationProps>(
  (
    {
      className,
      totalResults,
      currentPage,
      totalPages,
      onPageChange,
      resultsPerPage = 10,
      onResultsPerPageChange,
      pageSizeOptions = [10, 20, 50],
      ...props
    },
    ref,
  ) => {
    const items = getPaginationItems(currentPage, totalPages);
    const canGoPrev = currentPage > 1;
    const canGoNext = currentPage < totalPages;

    return (
      <div
        ref={ref}
        className={cn(
          'flex w-full flex-wrap items-center justify-between gap-3 rounded-sm px-1 py-0.5 text-sm',
          className,
        )}
        {...props}
      >
        <p className="font-semibold text-muted-foreground">Total Results: {totalResults.toLocaleString()}</p>

        <nav aria-label="Table pagination" className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            onClick={() => canGoPrev && onPageChange(currentPage - 1)}
            disabled={!canGoPrev}
            className="h-8 w-8 rounded-full p-1 text-gray-700 hover:bg-secondary-100 hover:text-gray-800"
          >
            <ChevronLeftIcon size={24} />
          </Button>

          {items.map((item) => {
            if (typeof item === 'string') {
              return (
                <Button
                  key={item}
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="More pages"
                  disabled
                  className="h-8 w-8 rounded-full p-1 text-gray-700 disabled:opacity-100"
                >
                  <MoreHorizIcon size={24} />
                </Button>
              );
            }

            const isActive = item === currentPage;

            return (
              <Button
                key={item}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(item)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'h-8 min-w-8 rounded-xs px-2',
                  isActive
                    ? 'bg-secondary-50 font-extrabold text-secondary-500'
                    : 'font-semibold text-muted-foreground hover:bg-secondary-100 hover:text-foreground',
                )}
              >
                {item}
              </Button>
            );
          })}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next page"
            onClick={() => canGoNext && onPageChange(currentPage + 1)}
            disabled={!canGoNext}
            className="h-8 w-8 rounded-full p-1 text-gray-700 hover:bg-secondary-100 hover:text-gray-800"
          >
            <ChevronRightIcon size={24} />
          </Button>
        </nav>

        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="font-semibold">Rows per page:</span>
          <div className="relative">
            <Select
              aria-label="Rows per page"
              className="h-8 min-w-14.5 appearance-none border-0 bg-transparent px-2 py-0 pr-6 font-extrabold text-secondary-500 shadow-none focus-visible:ring-0"
              value={resultsPerPage}
              onChange={(event) => onResultsPerPageChange?.(Number(event.target.value))}
              disabled={!onResultsPerPageChange}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
            <ChevronDownIcon
              size={16}
              className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-secondary-500"
            />
          </div>
        </div>
      </div>
    );
  },
);
TablePagination.displayName = 'TablePagination';

export { Table, TableHeader, TableBody, TableRow, TableSortButton, TableHead, TableCell, TablePagination };
