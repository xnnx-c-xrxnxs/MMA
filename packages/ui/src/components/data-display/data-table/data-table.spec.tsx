import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type ColumnDef, type DataTableColumn } from './data-table';

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Name' }];

describe('DataTable', () => {
  it('renders header and row data', () => {
    const data: Row[] = [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
    ];
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('shows the empty message when data is empty', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Nothing here." />);
    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
  });

  it('forwards data-testid to the underlying table', () => {
    render(<DataTable columns={columns} data={[]} data-testid="people-table" />);
    expect(screen.getByTestId('people-table')).toBeInTheDocument();
  });

  it('renders custom components through column component shorthand', () => {
    const data: Row[] = [{ id: '1', name: 'Alpha' }];
    const customColumns: DataTableColumn<Row>[] = [
      { accessorKey: 'name', header: 'Name' },
      {
        id: 'cta',
        header: 'Action',
        component: (row) => <button type="button">Open {row.id}</button>,
      },
    ];

    render(<DataTable columns={customColumns} data={data} />);
    expect(screen.getByRole('button', { name: 'Open 1' })).toBeInTheDocument();
  });

  it('still supports tanstack cell renderers', () => {
    const data: Row[] = [{ id: '1', name: 'Alpha' }];
    const customColumns: ColumnDef<Row>[] = [
      { accessorKey: 'name', header: 'Name' },
      {
        id: 'badge',
        header: 'Status',
        cell: () => <span data-testid="status-badge">Active</span>,
      },
    ];

    render(<DataTable columns={customColumns} data={data} />);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Active');
  });

  it('renders and wires pagination when pagination prop is provided', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    const onResultsPerPageChange = jest.fn();

    render(
      <DataTable
        columns={columns}
        data={[{ id: '1', name: 'Alpha' }]}
        pagination={{
          totalResults: 100,
          currentPage: 2,
          totalPages: 10,
          onPageChange,
          resultsPerPage: 5,
          onResultsPerPageChange,
          pageSizeOptions: [5, 10, 20],
        }}
      />,
    );

    expect(screen.getByText('Total Results: 100')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '10');
    expect(onResultsPerPageChange).toHaveBeenCalledWith(10);
  });
});
