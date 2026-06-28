---
name: webapp-data-table
description: Build sortable, selectable, column-toggleable tables in the webapp using the `<DataTable>` primitive (built on `@tanstack/react-table`) from `@old-st/ui`. Use this when migrating a hand-rolled `<Table>` to a feature-richer surface or when adding a new list page that needs sorting / row selection.
---

# Webapp DataTable

The shared `<DataTable>` primitive in `@old-st/ui` is a thin headless-table wrapper around `@tanstack/react-table` that renders into the existing shadcn `<Table>` shell. Pages stay thin: they own the column definitions and pass the data array.

Source: `packages/ui/src/components/data-display/data-table/data-table.tsx`.

## When to use it

- Sortable columns
- Column visibility toggle (e.g. "Show / hide Email")
- Row selection with checkboxes
- Sticky toolbars that need to reach into the table state via `tableRef`

For simple read-only tables with no interaction, the existing `<Table>` primitive is enough. **Do not** migrate every table — only the ones that benefit from sorting or selection.

## Minimal example

```tsx
'use client';
import { DataTable, type ColumnDef, Badge } from '@old-st/ui';
import type { EntityResponse } from '@old-st/contracts/{domain}';
import { useUsersByStatus } from '@old-st/client-common';

const columns: ColumnDef<UserResponse>[] = [
  {
    accessorKey: 'firstName',
    header: 'First name',
  },
  {
    accessorKey: 'lastName',
    header: 'Last name',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge>{row.original.status}</Badge>,
  },
];

export function UsersDataTable() {
  const { data } = useUsersByStatus({ userStatus: 'ACTIVE' });
  return (
    <DataTable
      columns={columns}
      data={data?.data ?? []}
      data-testid="users-table"
    />
  );
}
```

## Sorting

Enabled by default (`sortable={true}`). Click a header to toggle asc → desc → none. The primitive renders a ▲ / ▼ glyph on the active sort column. To disable for a specific column:

```ts
{ accessorKey: 'createdAt', header: 'Created', enableSorting: false }
```

## Row selection

```tsx
const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

<DataTable
  columns={columns}
  data={data}
  enableRowSelection
  rowSelection={rowSelection}
  onRowSelectionChange={setRowSelection}
/>
```

Add a checkbox column manually:

```ts
{
  id: 'select',
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(v) => row.toggleSelected(!!v)}
    />
  ),
  enableSorting: false,
}
```

## Reaching into the table from a toolbar

```tsx
const tableRef = React.useRef<TableInstance<UserResponse> | null>(null);

<DataTableToolbar
  onClearSelection={() => tableRef.current?.resetRowSelection()}
/>
<DataTable columns={columns} data={data} tableRef={tableRef} />
```

## Empty state

```tsx
<DataTable
  columns={columns}
  data={[]}
  emptyMessage={
    <div className="space-y-2">
      <p>No users yet.</p>
      <Button>Create one</Button>
    </div>
  }
/>
```

## Migration checklist

- [ ] Replace hand-rolled `<TableHeader>` / `<TableRow>` markup with a `columns` array.
- [ ] Move the row's status-badge JSX into the column's `cell` renderer.
- [ ] Keep `data-testid` on the outer wrapper; row test IDs come from each column's cell.
- [ ] If the page had a "Select all" / "Bulk delete" UI, lift selection state up and pass `rowSelection` / `onRowSelectionChange`.
