# ADR-001: examples/ Is a Frozen Isolated Workspace

**Status:** ACCEPTED  
**Date:** 2026-05

## Context

The template ships with complete reference implementations (users, products, orders domains). These need to exist as learning references but must not pollute the main Nx graph, bloat CI, or couple new projects to example-specific code.

## Decision

`examples/` is a self-contained frozen snapshot with its own `pnpm-workspace.yaml`, own `nx.json`, own `node_modules`, and its own root `tsconfig.base.json`. It is **not** part of the main Nx workspace graph.

Shared packages (`@old-st/ui`, `@old-st/telemetry`, `@old-st/client-common`, etc.) are consumed from the main workspace via the pnpm `link:` protocol — not vendored or copied.

## Rationale

- Keeps `nx graph` and `nx affected` scoped to production code only
- All CI/CD workflows ignore `examples/**` via `paths-ignore`
- New projects cloning the template can delete `examples/` entirely via `scripts/init-project.mjs --keep-examples=false`, or via the standalone `scripts/remove-examples.mjs` script when only the deletion (no scope rename, no git re-init) is wanted
- `link:` ensures examples always consume the live version of shared packages without maintaining a separate copy

## Alternatives Rejected

- **Parallel Nx workspace (shared graph):** Would cause all example projects to appear in `nx affected`, bloating CI and producing false failures when example code breaks.
- **Vendoring shared packages:** Creates drift — example packages would lag behind main package changes silently.
- **Single workspace with Nx tags to exclude:** Tag-based exclusion is fragile; a tag mismatch would silently include examples in CI runs.

## Constraints

- `examples/` must never be imported from main workspace code — enforced by the `skills-no-example-imports` lint check in `scripts/lint-standards.ts`
- `examples/` must be independently installable via `cd examples && pnpm install`
- Every CI workflow must include `paths-ignore: ['examples/**']` on all push/PR triggers
