---
name: write-webapp-tests
description: Write unit tests for Next.js webapp pages, domain components, and utility functions. Use this when adding tests for new or existing UI components in apps/webapp/, following the Jest + React Testing Library patterns used in this codebase.
---

# Writing Webapp Tests

Tests are co-located alongside their source files (`.spec.tsx` next to `.tsx`).

---

## What Gets Tested and Where

| Layer | Test file location | What to test |
|---|---|---|
| Status variant helpers | `src/lib/status-variants.spec.ts` | Every status maps to the correct badge variant |
| Domain table component | `src/components/{domain}/{domain}s-table.spec.tsx` | Renders rows, badges, empty state, links |
| Domain action component | `src/components/{domain}/{domain}-actions.spec.tsx` | Conditional buttons by status, click handlers |
| Domain form component | `src/components/{domain}/create-{domain}-form.spec.tsx` | Input binding, mutation call on submit |
| Layout components | `src/components/layout/*.spec.tsx` | Navigation links, brand name |
| Page orchestrators | Thin — test only if they contain logic beyond wiring hooks to components |

---

## Test Setup (jest.config.cts)

The webapp uses `next/jest` with jsdom environment. Key config:

```typescript
const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: __dirname });

module.exports = createJestConfig({
  displayName: 'webapp',
  testEnvironment: 'jsdom',
  coverageDirectory: '../../coverage/apps/webapp',
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
  },
});
```

---

## Mock Patterns

### Mocking React Query Hooks

Mock `@old-st/client-common` to intercept hook calls. Return query-shaped data for read hooks and mutation-shaped objects for mutations:

```typescript
jest.mock('@old-st/client-common', () => ({
  useUsers: jest.fn(),
  useCreateUser: jest.fn(),
  useDeleteUser: jest.fn(),
}));

import { useUsers, useCreateUser, useDeleteUser } from '@old-st/client-common';

const mockUseUsers = useUsers as jest.Mock;
const mockUseCreateUser = useCreateUser as jest.Mock;
const mockUseDeleteUser = useDeleteUser as jest.Mock;
```

**Query hook mock shape:**
```typescript
mockUseUsers.mockReturnValue({
  data: { data: [mockUser1, mockUser2] },
  isLoading: false,
});
```

**Mutation hook mock shape:**
```typescript
const mockMutate = jest.fn();
mockUseCreateUser.mockReturnValue({
  mutate: mockMutate,
  isPending: false,
});
```

### Mocking next/navigation

```typescript
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/users',
  useParams: () => ({ userId: 'u-1' }),
}));
```

### Mocking next/link

`next/link` renders as `<a>` in jsdom; usually no mock is needed. If you need to assert navigation:

```typescript
// Just check the href on the rendered <a> tag
expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute('href', '/users/u-1');
```

---

## Status Variant Tests

Status variant functions are pure functions — test with `it.each`:

```typescript
import { userStatusVariant } from './status-variants';
import { EntityStatusEnum } from '@old-st/contracts/{domain}';

describe('userStatusVariant', () => {
  it.each([
    [EntityStatusEnum.ACTIVE, 'success'],
    [EntityStatusEnum.PENDING, 'warning'],
    [EntityStatusEnum.INACTIVE, 'secondary'],
    [EntityStatusEnum.DELETED, 'destructive'],
    ['UNKNOWN', 'outline'],
  ] as const)('maps %s → %s', (status, expected) => {
    expect(userStatusVariant(status)).toBe(expected);
  });
});
```

**Always include the unknown/default case** to verify the fallback.

---

## Table Component Tests

Table components render a list of entities with status badges and action links.

```typescript
import { render, screen } from '@testing-library/react';
import { UsersTable } from './users-table';
import type { EntityResponse } from '@old-st/contracts/{domain}';

jest.mock('@old-st/client-common', () => ({
  useDeleteUser: () => ({ mutate: jest.fn(), isPending: false }),
}));

const mockUser: UserResponse = {
  userId: 'u-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  userRole: 'USER',
  userStatus: 'ACTIVE',
  data: {},
  dateCreated: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
};

describe('UsersTable', () => {
  it('renders user rows with name, email, role and status', () => {
    render(<UsersTable users={[mockUser]} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('renders empty message when no users', () => {
    render(<UsersTable users={[]} />);
    expect(screen.getByText(/no users/i)).toBeInTheDocument();
  });

  it('renders detail links', () => {
    render(<UsersTable users={[mockUser]} />);
    expect(screen.getByRole('link', { name: /view/i })).toHaveAttribute('href', '/users/u-1');
  });
});
```

**Table test checklist:**
- [ ] Renders rows with key entity fields
- [ ] Status badge with correct text
- [ ] Empty state message
- [ ] Detail/action links point to correct routes
- [ ] Conditional actions (e.g., no Delete for non-DRAFT orders)

---

## Action Component Tests

Action components show conditional buttons based on entity status.

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { UserActions } from './user-actions';

describe('UserActions', () => {
  it('shows Activate for PENDING users', () => {
    const onAction = jest.fn();
    render(<UserActions userId="u-1" status="PENDING" onAction={onAction} />);

    expect(screen.getByText('Activate')).toBeInTheDocument();
    expect(screen.queryByText('Deactivate')).not.toBeInTheDocument();
  });

  it('calls onAction when button is clicked', () => {
    const onAction = jest.fn();
    render(<UserActions userId="u-1" status="PENDING" onAction={onAction} />);

    fireEvent.click(screen.getByText('Activate'));
    expect(onAction).toHaveBeenCalled();
  });

  it('shows no actions for DELETED users', () => {
    render(<UserActions userId="u-1" status="DELETED" onAction={jest.fn()} />);

    expect(screen.queryByText('Activate')).not.toBeInTheDocument();
    expect(screen.queryByText('Deactivate')).not.toBeInTheDocument();
  });
});
```

**Action test checklist:**
- [ ] Each status shows/hides the correct set of buttons
- [ ] Click handlers receive correct arguments
- [ ] Destructive actions (Delete) are conditionally shown

---

## Form Component Tests

Form components use `react-hook-form` + Zod resolver (Golden Rule #23a). Test the rendered output, mutation call, and inline validation messages via `<FormMessage>`.

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateUserForm } from './create-user-form';

jest.mock('@old-st/client-common', () => ({
  useCreateUser: jest.fn(),
}));

// Mock the toast so we can assert on it
jest.mock('@old-st/ui', () => ({
  ...jest.requireActual('@old-st/ui'),
  toast: { success: jest.fn(), error: jest.fn() },
}));

import { useCreateUser } from '@old-st/client-common';
import { toast } from '@old-st/ui';

const mockMutateAsync = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useCreateUser as jest.Mock).mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });
});

describe('CreateUserForm', () => {
  it('calls mutateAsync with form values on valid submit', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();
    render(<CreateUserForm onClose={mockOnClose} />);

    await user.type(screen.getByPlaceholderText('user@example.com'), 'alice@example.com');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'alice@example.com' }),
      );
    });
  });

  it('shows success toast and calls onClose on success', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();
    mockMutateAsync.mockResolvedValueOnce({});
    render(<CreateUserForm onClose={mockOnClose} />);

    // Fill required fields...
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => expect(mockOnClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('created'));
  });

  it('shows error toast when mutation throws', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(new Error('Email already exists'));
    render(<CreateUserForm onClose={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Email already exists'),
    );
  });

  it('disables submit button while pending', () => {
    (useCreateUser as jest.Mock).mockReturnValue({ mutateAsync: mockMutateAsync, isPending: true });
    render(<CreateUserForm onClose={jest.fn()} />);
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();
    render(<CreateUserForm onClose={mockOnClose} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
```

**Form test checklist:**
- [ ] Valid submit calls `mutateAsync` (not `mutate`) with the correct payload
- [ ] Success: calls `onClose` + `toast.success`
- [ ] Error: calls `toast.error` with the thrown message (no inline `isError` block)
- [ ] `isPending`: submit button is disabled and shows loading text
- [ ] Cancel: calls `onClose`
- [ ] Zod validation errors: assert `<FormMessage>` text for invalid inputs

> **Note:** Mock `toast` at the `@old-st/ui` module level so you can spy on `toast.success` and `toast.error`. Use `userEvent.setup()` (async) over `fireEvent` for more realistic interaction.

---

## Layout Component Tests

```typescript
import { render, screen } from '@testing-library/react';
import { Sidebar } from './sidebar';

jest.mock('next/navigation', () => ({
  usePathname: () => '/users',
}));

describe('Sidebar', () => {
  it('renders all navigation items', () => {
    render(<Sidebar />);

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
  });

  it('renders correct navigation links', () => {
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: /users/i })).toHaveAttribute('href', '/users');
  });
});
```

---

## Running Tests

```bash
# Run all webapp tests
npx nx test webapp

# Run with coverage
npx nx test webapp --coverage

# Run a single spec file
npx nx test webapp --testFile=src/components/users/users-table.spec.tsx
```

---

## Common Mistakes

| Mistake | Correct approach |
|---|---|
| Not mocking `@old-st/client-common` hooks | Mock ALL hooks used by the component, even if only reading data |
| Using `getByText` for optional elements | Use `queryByText` when the element may not be present |
| Not providing mock data matching the contract type | Build mock objects that satisfy the full `{Entity}Response` type |
| Testing page components with full rendering | Pages are thin orchestrators — prefer testing the child components directly |
| Asserting on CSS classes instead of behavior | Assert on text content, visibility, and interactions, not implementation details |
| Missing `jest.clearAllMocks()` in `beforeEach` | Always clear mocks to prevent test pollution |
