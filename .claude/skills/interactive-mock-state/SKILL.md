---
name: interactive-mock-state
description: 'Build the swappable _data/{domain}.adapter.ts that lets a webapp page run on INTERACTIVE mock state (useState-backed: filters narrow rows, form submit appends a row, status actions mutate a row) in pass 1, then be re-pointed at real @old-st/client-common hooks in pass 2 — with page.tsx byte-identical between passes. Use this whenever building a migration page via /migrate-page (--mock and --wire) or any page that must be demoable before its backend exists.'
---

# Interactive Mock State — Skill

A migration page is built **once, in its real `(protected)/{route}/` location**, and demoed before the backend exists. The trick is a single **adapter** file that exposes the SAME hook-shaped contract the page consumes — so the page never knows whether it is talking to mock `useState` or the real API.

> **Mock state MUST be interactive, never a frozen array.** Filters must narrow the visible rows; a create/edit submit must append/update a row; status actions must mutate a row. A static list is a bug, not a mock.

---

## The contract

`page.tsx` imports data only from `./_data/{domain}.adapter.ts`. The adapter exports functions whose names + return shapes match the page spec's `dataSources[].hook` (e.g. `useProjectsList`, `useProject`, `useCreateProject`). Each must return the same shape the real `@old-st/client-common` hook returns:

```ts
// query hook shape
{ data: T[] | T | undefined; isLoading: boolean; isError: boolean; refetch?: () => void }
// mutation hook shape
{ mutate: (input) => void; mutateAsync: (input) => Promise<T>; isPending: boolean; isError: boolean }
```

Because the contract is identical, `--wire` swaps ONLY this file. `page.tsx` stays byte-identical.

---

## Step 1 — Derive the fixture SHAPE from the domain spec

Read `.specs/domain-{domain}.yaml`. For each `entity.fields[]` produce a realistic value by type:

| Field type         | Mock value                                                  |
| ------------------ | ----------------------------------------------------------- |
| `ulid` / pk        | `crypto.randomUUID()` (or a `ulid()` stub)                  |
| `string`           | a short realistic label (use the field name as a hint)      |
| `email`            | `name@example.com`                                          |
| `url`              | `https://example.com/...`                                   |
| `number`/`integer` | a small plausible number                                    |
| `boolean`          | alternating `true`/`false`                                  |
| `date`/`datetime`  | ISO string within the last ~90 days                         |
| `enum`             | one of the enum's `values` (cycle through them across rows) |
| `json`             | a small representative object                               |

Generate **8–12 rows** so filters/pagination are demonstrable.

---

## Step 2 — Write the interactive adapter (`--mock`)

```ts
// apps/webapp/src/app/(protected)/projects/_data/project.adapter.ts
// MOCK ADAPTER — replaced wholesale by `/migrate-page --wire`. Do NOT import @old-st/client-common here.
'use client';

import { useCallback, useState } from 'react';

export type Project = {
  id: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
};

const SEED: Project[] = [
  /* 8–12 rows derived from domain-project.yaml */
];

// list hook — filters NARROW the visible rows
export function useProjectsList(filters?: { status?: string; search?: string }) {
  const [rows] = useState<Project[]>(SEED);
  const data = rows.filter((r) => {
    if (filters?.status && r.status !== filters.status) return false;
    if (filters?.search && !r.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });
  return { data, isLoading: false, isError: false };
}

// create hook — submit APPENDS a row to shared local state
export function useCreateProject() {
  return {
    isPending: false,
    isError: false,
    mutate: (_input: Omit<Project, 'id' | 'createdAt'>) => {
      /* see store note below */
    },
    mutateAsync: async (input: Omit<Project, 'id' | 'createdAt'>) => ({
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }),
  };
}
```

**Shared mutable state across hooks:** so that "submit the form" actually shows up in "the list", back all hooks with one module-level store + a `useSyncExternalStore` (or a tiny event-emitter + `useState` + `useEffect`) rather than per-hook `useState`. Keep it local to the adapter file — it is throwaway.

```ts
// minimal shared store inside the adapter
let store: Project[] = [...SEED];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function useStore() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return store;
}
function addProject(p: Project) {
  store = [p, ...store];
  emit();
}
function updateProject(id: string, patch: Partial<Project>) {
  store = store.map((r) => (r.id === id ? { ...r, ...patch } : r));
  emit();
}
```

Then `useProjectsList` reads `useStore()`, `useCreateProject().mutate` calls `addProject(...)`, and status actions call `updateProject(...)`. Now filter + add + status-change are all interactive and consistent.

---

## Step 3 — Swap to real hooks (`--wire`)

Rewrite ONLY the adapter so each export re-exports / thinly wraps the real hook. Delete the seed, the store, and the `useState`/`useSyncExternalStore` plumbing.

```ts
// apps/webapp/src/app/(protected)/projects/_data/project.adapter.ts
// WIRED ADAPTER — real API. This is the only file that changed from the mock pass.
export { useProjectsList, useProject, useCreateProject } from '@old-st/client-common';
export type { Project } from '@old-st/contracts/project';
```

If the real hook's return shape differs from what `page.tsx` consumes, prefer a thin wrapper here (re-map fields in the adapter) over editing `page.tsx`. Only touch `page.tsx` if unavoidable, and flag it.

---

## Step 4 — The auth bypass (mock pass only)

`(protected)/layout.tsx` carries a permanent guard that skips the auth redirect when `process.env.NEXT_PUBLIC_MOCK_PREVIEW === 'true'` AND `process.env.NEXT_PUBLIC_STAGE === 'local'` (the client-readable mirror of `STAGE` — the server-only `STAGE` var is not exposed to client components). The developer sets both in `.env.local` to view the mock, and unsets `NEXT_PUBLIC_MOCK_PREVIEW` (or it defaults false) once wired. The guard is **never** removed from the layout and is never set in production — the API re-validates every request, so layout auth is UX only (Rule #23e).

```bash
# .env.local — mock pass only
NEXT_PUBLIC_MOCK_PREVIEW=true
NEXT_PUBLIC_STAGE=local
```

---

## Checklist

- [ ] Adapter exports match the page spec `dataSources[].hook` names + return shapes.
- [ ] Mock list filters narrow rows; create appends; status action mutates — all via ONE shared store.
- [ ] `page.tsx` imports from the adapter only — NEVER `@old-st/client-common` in the mock pass.
- [ ] `--wire` changes ONLY the adapter; `page.tsx` stays byte-identical.
- [ ] MOCK_PREVIEW guard present in `(protected)/layout.tsx` (gated on `NEXT_PUBLIC_MOCK_PREVIEW` + `NEXT_PUBLIC_STAGE=local`).
