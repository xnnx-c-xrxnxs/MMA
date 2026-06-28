import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TablePagination } from './table';

describe('Table', () => {
  it('renders semantic table structure', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ada</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument();
  });

  it('forwards className on the table', () => {
    render(
      <Table className="custom-table">
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('table')).toHaveClass('custom-table');
  });

  it('renders sortable header button and calls sort handler', async () => {
    const user = userEvent.setup();
    const onSort = jest.fn();

    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sortable sortDirection="asc" sortLabel="Sort by name" onSort={onSort}>
              Name
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );

    const header = screen.getByRole('columnheader', { name: /name/i });
    const button = screen.getByRole('button', { name: /sort by name/i });

    expect(header).toHaveAttribute('aria-sort', 'ascending');
    await user.click(button);
    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('sets aria-sort to none for sortable unsorted header', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sortable sortLabel="Sort by confidence">
              Confidence
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );

    expect(screen.getByRole('columnheader', { name: /confidence/i })).toHaveAttribute('aria-sort', 'none');
  });

  it('renders pagination summary and page controls', () => {
    render(
      <TablePagination
        totalResults={1000}
        currentPage={1}
        totalPages={20}
        onPageChange={jest.fn()}
        resultsPerPage={5}
        onResultsPerPageChange={jest.fn()}
        pageSizeOptions={[5, 10, 20]}
      />,
    );

    expect(screen.getByText('Total Results: 1,000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
  });

  it('calls pagination callbacks on page and page-size change', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    const onResultsPerPageChange = jest.fn();

    render(
      <TablePagination
        totalResults={1000}
        currentPage={2}
        totalPages={20}
        onPageChange={onPageChange}
        resultsPerPage={5}
        onResultsPerPageChange={onResultsPerPageChange}
        pageSizeOptions={[5, 10, 20]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '20');
    expect(onResultsPerPageChange).toHaveBeenCalledWith(20);
  });

  it('renders the correct item count at the first page window', () => {
    render(
      <TablePagination
        totalResults={1000}
        currentPage={1}
        totalPages={20}
        onPageChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '6' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument();
  });

  it('renders the correct item count at a middle page window', () => {
    render(
      <TablePagination
        totalResults={1000}
        currentPage={7}
        totalPages={20}
        onPageChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '9' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '4' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '10' })).not.toBeInTheDocument();
  });
});
