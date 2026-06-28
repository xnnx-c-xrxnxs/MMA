// Module 06 — Page as Thin Orchestrator
// Shows the full vertical slice: Page → Domain Component → Hook → API Client.

export default {
    id: '06-page-thin-orchestrator',
    level: 3,
    complexityLabel: 'L3 · Page Pattern',
    domain: 'Webapp',
    title: 'Page as Thin Orchestrator',
    introShort: 'A page wires hooks and domain components — it never contains table markup or API calls.',
    intro: "Golden Rule #19: pages are thin orchestrators. A page component's only job is to connect the right hooks, pass state to domain components, and arrange layout. All rendering logic lives in domain-scoped components. All data-fetching logic lives in React Query hooks. A reviewer should be able to understand a page's purpose in 10 lines.",

    specTitle: 'Webapp · Page Pattern',
    specBodyHtml: `
    <p><strong>Old template — page owns everything:</strong></p>
    <ul>
      <li>API calls made with <code>axios.get()</code> inside <code>useEffect()</code> in the page component.</li>
      <li>Table markup (<code>&lt;table&gt;&lt;tr&gt;&lt;td&gt;</code>) written inline in the page.</li>
      <li>Status badge colour calculated with inline ternaries in JSX.</li>
      <li>Sidebar layout imported directly: <code>&lt;WithSidebar&gt;</code> wraps the page.</li>
    </ul>
    <p><strong>New template — pages delegate everything:</strong></p>
    <ul>
      <li>Page imports a domain component (e.g. <code>&lt;UsersTable&gt;</code>) and passes hooks' state to it.</li>
      <li>Domain component owns the table/card markup using <code>@mma/ui</code> primitives.</li>
      <li>React Query hook (<code>useUsers()</code>) owns server state, caching, and loading/error states.</li>
      <li>Sidebar lives in the route group layout — the page never renders layout chrome.</li>
      <li><code>error.tsx</code> and <code>loading.tsx</code> co-located with the route handle error/loading without touching the page.</li>
    </ul>
    <p>The complete vertical slice: <strong>Page → Component → Hook → ApiClient → Backend</strong></p>
  `,

    entityFilename: 'users/page.tsx',
    entityCode: `// apps/webapp/src/app/(protected)/users/page.tsx
// ─────────────────────────────────────────────────────────────────
//  OLD TEMPLATE — page owns data fetching + rendering
// ─────────────────────────────────────────────────────────────────
// 'use client';
// import { useEffect, useState } from 'react';
// import { UserApi } from '@web-app/data-access/api/user';
//
// export default function UsersPage() {
//   const [users, setUsers] = useState([]);
//   const [loading, setLoading] = useState(true);
//
//   useEffect(() => {
//     new UserApi().getUsers().then(data => {
//       setUsers(data);
//       setLoading(false);
//     });
//   }, []);
//
//   if (loading) return <div>Loading...</div>;
//
//   return (
//     <table>                              ← table markup in the page
//       <thead><tr><th>Name</th>...</tr></thead>
//       <tbody>
//         {users.map(u => (
//           <tr key={u.id}>
//             <td>{u.firstName} {u.lastName}</td>
//             <td>
//               <span style={{ color: u.status === 'ACTIVE' ? 'green' : 'red' }}>
//                 {u.status}              ← inline status logic
//               </span>
//             </td>
//           </tr>
//         ))}
//       </tbody>
//     </table>
//   );
// }

// ─────────────────────────────────────────────────────────────────
//  NEW TEMPLATE — page is 10 lines; all logic is delegated
// ─────────────────────────────────────────────────────────────────

// No 'use client' needed — this is a React Server Component wrapper.
// Data fetching and interaction happen inside the domain component.
import { UsersTable } from '@/components/users/users-table';

export default function UsersPage() {
  // ✅ Page contains ZERO markup, ZERO fetch calls, ZERO state.
  // It only names the page and places the domain component.
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">Manage user accounts and roles.</p>
      </div>
      <UsersTable />
    </div>
  );
}`,

    concepts: [
        'Pages are Server Components by default — add "use client" only if needed',
        'Co-located error.tsx + loading.tsx handle error/loading per route segment',
        'Domain components live in components/{domain}/ — not in app/',
        'React Query hook owns loading/error/data — not useState + useEffect',
        'Sidebar + layout chrome live in the (protected)/layout.tsx — not in pages',
        'Status variants use enum constants from @mma/contracts/{domain}',
    ],

    exceptionsFilename: 'users-table.tsx',
    exceptionsCode: `// apps/webapp/src/components/users/users-table.tsx
// Domain component — renders the users table using @mma/ui primitives.
// Imports the React Query hook; never imports API clients directly.
'use client';

import { useState } from 'react';
import { useUsers } from '@mma/client-common';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@mma/ui';
import { UserStatusEnum } from '@mma/contracts/user';
import { USER_STATUS_VARIANTS } from '@/lib/status-variants';

export function UsersTable() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // ✅ Hook owns ALL server state — loading, error, data, refetch
  const { data, isLoading, isError } = useUsers({ status: statusFilter !== 'ALL' ? statusFilter : undefined });

  if (isLoading) return null;  // loading.tsx handles the skeleton
  if (isError)   return null;  // error.tsx handles the error state

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {Object.values(UserStatusEnum).map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table — @mma/ui primitives, never raw <table> */}
      <Table data-testid="users-table">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.items.map(user => (
            <TableRow key={user.userId} data-testid={\`user-row-\${user.userId}\`}>
              <TableCell className="font-medium">
                {user.firstName} {user.lastName}
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.userRole}</TableCell>
              <TableCell>
                {/* ✅ Variant from status-variants.ts — no inline ternaries */}
                <Badge
                  variant={USER_STATUS_VARIANTS[user.userStatus] ?? 'default'}
                  data-testid="user-status-badge"
                >
                  {user.userStatus}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" asChild>
                  <a href={\`/users/\${user.userId}\`}>View</a>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}`,

    pitfalls: [
        '<strong>Calling <code>useQuery()</code> directly in a page:</strong> hooks belong in <code>components/{domain}/</code> so they can be tested in isolation and reused across pages. A page that calls a hook directly becomes hard to test and violates the orchestrator pattern.',
        '<strong>Inline status colour logic (<code>status === "ACTIVE" ? "green" : "red"</code>):</strong> this pattern is scattered and silently breaks when a new status is added. Use the central <code>status-variants.ts</code> map.',
        '<strong>Missing <code>data-testid</code> attributes:</strong> E2E tests (Playwright) select elements by <code>data-testid</code>. Every table, row, badge, filter, and action button must have one. See <code>apps/webapp-e2e/src/utils/selectors.ts</code> for the naming convention.',
    ],
};
