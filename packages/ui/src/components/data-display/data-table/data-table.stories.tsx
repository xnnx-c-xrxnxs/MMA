import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../badge';
import { Button } from '../../form-controls/button';
import { DataTable, type ColumnDef, type DataTableColumn } from './data-table';

interface Person {
  id: string;
  name: string;
  email: string;
  status: 'Active' | 'Pending' | 'Suspended';
}

const data: Person[] = [
  { id: '1', name: 'Ada Lovelace', email: 'ada@example.com', status: 'Active' },
  { id: '2', name: 'Alan Turing', email: 'alan@example.com', status: 'Pending' },
  { id: '3', name: 'Grace Hopper', email: 'grace@example.com', status: 'Active' },
  { id: '4', name: 'Linus Torvalds', email: 'linus@example.com', status: 'Suspended' },
];

const columns: ColumnDef<Person>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'status', header: 'Status' },
];

const meta: Meta<typeof DataTable<Person, unknown>> = {
  title: 'Data Display/DataTable',
  component: DataTable,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DataTable<Person, unknown>>;

export const Default: Story = {
  render: () => <DataTable columns={columns} data={data} />,
};

export const Empty: Story = {
  render: () => <DataTable columns={columns} data={[]} emptyMessage="No people yet." />,
};

export const NotSortable: Story = {
  render: () => <DataTable columns={columns} data={data} sortable={false} />,
};

const componentColumns: DataTableColumn<Person>[] = [
  { accessorKey: 'name', header: 'Name' },
  {
    id: 'status-badge',
    header: 'Status',
    component: (row) => (
      <Badge variant={row.status === 'Active' ? 'success' : row.status === 'Pending' ? 'warning' : 'danger'}>
        {row.status}
      </Badge>
    ),
  },
  {
    id: 'cta',
    header: 'Action',
    component: (row) => (
      <Button size="sm" variant="secondary" type="button">
        View {row.name.split(' ')[0]}
      </Button>
    ),
  },
];

export const WithComponentColumns: Story = {
  render: () => <DataTable columns={componentColumns} data={data} />,
};

export const WithPagination: Story = {
  render: () => {
    const [page, setPage] = React.useState(1);
    const [resultsPerPage, setResultsPerPage] = React.useState(2);

    const totalResults = data.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));
    const pagedData = data.slice((page - 1) * resultsPerPage, page * resultsPerPage);

    return (
      <DataTable
        columns={componentColumns}
        data={pagedData}
        pagination={{
          totalResults,
          currentPage: page,
          totalPages,
          onPageChange: setPage,
          resultsPerPage,
          onResultsPerPageChange: (size) => {
            setResultsPerPage(size);
            setPage(1);
          },
          pageSizeOptions: [2, 3, 4],
        }}
      />
    );
  },
};
