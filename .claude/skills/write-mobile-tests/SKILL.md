---
name: write-mobile-tests
description: Write unit tests for Expo (React Native) mobile screens, domain components, and utility functions. Use this when adding tests for new or existing UI components in apps/mobile/, following the Jest + React Native Testing Library patterns used in this codebase.
---

# Writing Mobile Tests

Canonical references:
- `apps/mobile/src/lib/status-variants.spec.ts`
- `apps/mobile/src/components/users/users-list.spec.tsx`
- `apps/mobile/src/app/users/user-detail.spec.tsx`
- `apps/mobile/src/app/orders/order-detail.spec.tsx`

Tests are co-located — `.spec.tsx` files live next to their source files.

---

## What Gets Tested and Where

| Layer | Test file location | What to test |
|---|---|---|
| Status variant helpers | `src/lib/status-variants.spec.ts` | Every status maps to the correct badge variant |
| Domain list component | `src/components/{domain}/{domain}s-list.spec.tsx` | Renders items, loading state, empty state, navigation on press |
| Detail screen | `src/app/{domain}/{entity}-detail.spec.tsx` | Renders entity data, conditional action buttons, mutation calls |
| Tab screen | `src/app/(tabs)/{domain}.spec.tsx` | Filter state, hook wiring (optional — thin orchestrators) |

---

## Test Setup

The mobile app uses `jest-expo` preset with `babel-jest` transform and `@testing-library/react-native`.

Key config (`jest.config.cts`):
```typescript
module.exports = {
  displayName: 'mobile',
  preset: 'jest-expo',
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
  },
};
```

The test setup file (`src/test-setup.ts`) mocks `expo/src/winter/ImportMetaRegistry` and polyfills `structuredClone`.

---

## Mock Patterns

### Mocking expo-router

```typescript
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ entityId: 'id-1' }),
  Stack: { Screen: () => null },
  Redirect: () => null,
  Tabs: { Screen: () => null },
}));

const mockPush = jest.fn();
```

### Mocking React Query Hooks

Same pattern as webapp — mock `@mma/client-common`:

```typescript
jest.mock('@mma/client-common', () => ({
  useUser: jest.fn(),
  useActivateUser: () => ({ mutate: mockMutate, isPending: false }),
  useDeactivateUser: () => ({ mutate: mockMutate, isPending: false }),
}));

const { useUser } = jest.requireMock('@mma/client-common');

// In test:
useUser.mockReturnValue({ data: mockUserData, isLoading: false });
```

**Key difference from webapp:** Use `jest.requireMock()` to get the mocked module reference since mobile tests use `babel-jest` transform rather than `ts-jest`.

### Mocking react-native-safe-area-context

If a component uses `SafeAreaView`, the test may render without wrapping. If needed:

```typescript
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  SafeAreaProvider: ({ children }: any) => children,
}));
```

---

## Status Variant Tests

Identical pattern to webapp — pure functions, use `it.each`:

```typescript
import { userStatusVariant } from './status-variants';
import { EntityStatusEnum } from '@mma/contracts/{domain}';

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

---

## List Component Tests (FlatList)

List components use `FlatList` and navigate on press.

```typescript
import { render, screen, fireEvent } from '@testing-library/react-native';
import { UsersList } from './users-list';
import type { EntityResponse } from '@mma/contracts/{domain}';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
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

describe('UsersList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders user items with name, email, and status', () => {
    render(<UsersList users={[mockUser]} isLoading={false} />);

    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByText('alice@example.com')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('shows loading indicator when loading with no data', () => {
    render(<UsersList users={[]} isLoading={true} />);
    expect(screen.queryByText('No users found')).toBeNull();
  });

  it('shows empty message when no users and not loading', () => {
    render(<UsersList users={[]} isLoading={false} />);
    expect(screen.getByText('No users found')).toBeTruthy();
  });

  it('navigates to detail on press', () => {
    render(<UsersList users={[mockUser]} isLoading={false} />);
    fireEvent.press(screen.getByText('Alice Smith'));
    expect(mockPush).toHaveBeenCalledWith('/users/u-1');
  });
});
```

**List test checklist:**
- [ ] Renders items with key entity fields
- [ ] Status badge shows correct text
- [ ] Loading state shows indicator (no empty message)
- [ ] Empty state shows "No {entities} found"
- [ ] Press navigates to detail route with correct ID

---

## Detail Screen Tests

Detail screens fetch an entity and show conditional action buttons based on status.

```typescript
import { render, screen, fireEvent } from '@testing-library/react-native';
import UserDetailScreen from './[userId]';
import { EntityStatusEnum } from '@mma/contracts/{domain}';

const mockMutate = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ userId: 'u-1' }),
  Stack: { Screen: () => null },
}));

jest.mock('@mma/client-common', () => ({
  useUser: jest.fn(),
  useActivateUser: () => ({ mutate: mockMutate, isPending: false }),
  useDeactivateUser: () => ({ mutate: mockMutate, isPending: false }),
}));

const { useUser } = jest.requireMock('@mma/client-common');

describe('UserDetailScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders loading state when data is loading', () => {
    useUser.mockReturnValue({ data: undefined, isLoading: true });
    render(<UserDetailScreen />);
    expect(screen.queryByText('Alice')).toBeNull();
  });

  it('renders entity details when loaded', () => {
    useUser.mockReturnValue({
      data: { userId: 'u-1', firstName: 'Alice', lastName: 'Smith', userStatus: 'ACTIVE', /* ... */ },
      isLoading: false,
    });
    render(<UserDetailScreen />);
    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('shows Activate for PENDING status', () => {
    useUser.mockReturnValue({
      data: { /* ..., */ userStatus: UserStatusEnum.PENDING },
      isLoading: false,
    });
    render(<UserDetailScreen />);
    expect(screen.getByText('Activate')).toBeTruthy();
    expect(screen.queryByText('Deactivate')).toBeNull();
  });

  it('calls mutation on button press', () => {
    useUser.mockReturnValue({
      data: { /* ..., */ userStatus: UserStatusEnum.PENDING },
      isLoading: false,
    });
    render(<UserDetailScreen />);
    fireEvent.press(screen.getByText('Activate'));
    expect(mockMutate).toHaveBeenCalledWith('u-1');
  });
});
```

**Detail screen test checklist:**
- [ ] Loading state (no entity data rendered)
- [ ] Renders all entity fields when loaded
- [ ] Each status shows/hides the correct action buttons
- [ ] Button press calls the correct mutation with entity ID
- [ ] Payment/nested data renders when present (order detail)

---

## React Native Testing Library API Reference

Key differences from `@testing-library/react`:

| Web (`@testing-library/react`) | RN (`@testing-library/react-native`) |
|---|---|
| `screen.getByText('X')` | `screen.getByText('X')` (same) |
| `screen.getByRole('button')` | RN buttons don't have ARIA roles — use `getByText` on button label |
| `fireEvent.click(el)` | `fireEvent.press(el)` |
| `toBeInTheDocument()` | `.toBeTruthy()` (element exists) |
| `not.toBeInTheDocument()` | `.toBeNull()` (element does not exist) |

---

## Running Tests

```bash
# Run all mobile tests
npx nx test mobile

# Run with coverage
npx nx test mobile --coverage

# Run a single spec file
npx nx test mobile --testFile=src/components/users/users-list.spec.tsx
```

---

## Common Mistakes

| Mistake | Correct approach |
|---|---|
| Using `fireEvent.click` instead of `fireEvent.press` | RN uses `press`, not `click` |
| Using `toBeInTheDocument()` matcher | RN Testing Library uses `.toBeTruthy()` / `.toBeNull()` |
| Mocking `react-native` modules unnecessarily | `jest-expo` preset handles most RN module mocks |
| Not mocking `expo-router` | Always mock `useRouter`, `useLocalSearchParams`, `Stack` |
| Rendering `SafeAreaView` without mock | `jest-expo` usually handles this, but mock if tests fail |
| Using `screen.getByRole('button')` for RN buttons | RN buttons don't have ARIA roles — find by text content |
