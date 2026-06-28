import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TablePagination } from './table';

interface TaskRow {
  id: string;
  task: string;
  detail: string;
  project: string;
  dateStarted: string;
  lastUpdated: string;
  status: 'running' | 'completed';
}

const TASK_QUEUE_ROWS: TaskRow[] = Array.from({ length: 27 }, (_, index) => {
  const ordinal = index + 1;
  const running = index % 4 !== 0;

  return {
    id: `task-${ordinal}`,
    task: running ? `AI Screening Batch ${ordinal}` : `Retrieve Search Results ${ordinal}`,
    detail: running ? '2,500 records pending review' : '2,500 records from PubMed and Google Scholar',
    project: ['Hip Arthroplasty Outcomes', 'Knee Replacement Safety', 'Spine Surgery Complications'][index % 3],
    dateStarted: '2 May 2026, 10:00 AM',
    lastUpdated: running ? `${(index % 5) + 1}m ago` : 'Completed',
    status: running ? 'running' : 'completed',
  };
});

const meta: Meta<typeof Table> = {
  title: 'Data Display/Table',
  component: Table,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Table>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Ada Lovelace</TableCell>
          <TableCell>Engineer</TableCell>
          <TableCell>Active</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Alan Turing</TableCell>
          <TableCell>Researcher</TableCell>
          <TableCell>Pending</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const SelectedRow: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow data-state="selected">
          <TableCell>Highlighted row</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Default row</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const SortableColumns: Story = {
  render: () => {
    const [sortState, setSortState] = React.useState<{ key: 'study' | 'confidence'; direction: 'asc' | 'desc' }>(
      { key: 'study', direction: 'asc' },
    );

    const toggleSort = (key: 'study' | 'confidence') => {
      setSortState((prev) => {
        if (prev.key === key) {
          return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
        }
        return { key, direction: 'asc' };
      });
    };

    return (
      <Table className="min-w-180">
        <TableHeader>
          <TableRow>
            <TableHead
              sortable
              sortLabel="Sort by study"
              sortDirection={sortState.key === 'study' ? sortState.direction : undefined}
              onSort={() => toggleSort('study')}
            >
              Study
            </TableHead>
            <TableHead>Decision</TableHead>
            <TableHead
              sortable
              align="right"
              sortLabel="Sort by confidence"
              sortDirection={sortState.key === 'confidence' ? sortState.direction : undefined}
              onSort={() => toggleSort('confidence')}
            >
              Confidence
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Long-term outcomes of hip implant arthroplasty</TableCell>
            <TableCell>AI Included</TableCell>
            <TableCell className="text-right">High</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Hip implant complications: meta-analysis</TableCell>
            <TableCell>User Excluded</TableCell>
            <TableCell className="text-right">-</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  },
};

export const TaskQueue: Story = {
  render: () => {
    const [page, setPage] = React.useState(1);
    const [resultsPerPage, setResultsPerPage] = React.useState(5);
    const totalResults = TASK_QUEUE_ROWS.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));

    const pagedRows = React.useMemo(() => {
      const startIndex = (page - 1) * resultsPerPage;
      const endIndex = startIndex + resultsPerPage;
      return TASK_QUEUE_ROWS.slice(startIndex, endIndex);
    }, [page, resultsPerPage]);

    const handlePageChange = (nextPage: number) => {
      const clampedPage = Math.min(Math.max(nextPage, 1), totalPages);
      setPage(clampedPage);
    };

    const handleResultsPerPageChange = (nextSize: number) => {
      setResultsPerPage(nextSize);
      setPage(1);
    };

    return (
      <div className="space-y-3">
        <Table className="min-w-245">
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Date Started</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {row.status === 'running' ? (
                      <span className="inline-flex h-4 w-4 rounded-full border-2 border-primary border-r-transparent animate-spin" />
                    ) : (
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-success text-success-foreground">✓</span>
                    )}
                    <div>
                      <p className="font-semibold">{row.task}</p>
                      <p className="text-xs text-muted-foreground">{row.detail}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{row.project}</TableCell>
                <TableCell>{row.dateStarted}</TableCell>
                <TableCell>{row.lastUpdated}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <TablePagination
          totalResults={totalResults}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          resultsPerPage={resultsPerPage}
          onResultsPerPageChange={handleResultsPerPageChange}
          pageSizeOptions={[5, 10, 20]}
        />
      </div>
    );
  },
};
