# @mma/nx-plugin Package Context

This file loads automatically for any file inside `packages/nx-plugin/`. The package contains **custom Nx generators** that scaffold workspace artefacts (domain packages, use cases, etc.) following this template's Clean Architecture conventions.

---

## What This Package Provides

| Generator | Invoked via | Purpose |
|---|---|---|
| `domain` | `pnpm nx g @mma/nx-plugin:domain` | Scaffolds a complete `packages/{domain}-domain/` + `packages/contracts/{domain}/` + `apps/{domain}/{service}/`. Used by `/new-domain`, `/new-domain-dynamo`, `/quick-crud-domain`. |
| `use-case` | `pnpm nx g @mma/nx-plugin:use-case` | Adds a single use case to an existing domain (`create`, `get-by-id`, `update`, `delete`, `action`, `list`). Used by `/new-use-case`. |
| `ui-primitive` | `pnpm nx g @mma/nx-plugin:ui-primitive` | Scaffolds a new `@mma/ui` primitive: `{name}.tsx` + `index.ts` + `{name}.stories.tsx` + `{name}.spec.tsx` under the correct category subfolder, and adds the export to `packages/ui/src/index.ts`. Patterns: `simple-variants` (cva + forwardRef), `simple-no-variants` (forwardRef + cn only), `compound` (multiple sub-components). Used by `/new-ui-primitive`. |

---

## Architectural Rules (Strictly Enforced)

1. **Generators are the canonical scaffold.** Never hand-write the boilerplate that a generator can produce — invoke the generator and then refine. Phase 0 of every domain workflow prompt enforces this.

2. **Generated code MUST follow all Golden Rules.** A generator that emits a Clean Architecture violation (e.g. controller calling a use case directly, domain importing NestJS) is a bug — fix the generator template, not the output.

3. **Templates live in `src/generators/{name}/files/`** with EJS-style tokens. Token names use `__name__`, `__entity__`, `__className__`, etc. — see existing templates.

4. **Every generator change MUST update its `.spec.ts`** snapshot test under `src/generators/{name}/generator.spec.ts`. The snapshot validates the generated tree.

5. **Generators are versioned with the workspace.** Breaking changes to generator output require a coordinated update of every existing domain that was scaffolded with the previous version (or an explicit migration plan).

6. **Run `pnpm nx test nx-plugin` after any change** — generator snapshot tests catch regressions early.

---

## Skills That Govern This Package

| Task | Skill |
|---|---|
| Discovering / using existing generators | `nx-generate` |
| Understanding workspace project layout the generators target | `nx-workspace` |

There is intentionally **no `extend-nx-plugin` skill** — extending the plugin is rare and high-risk. When you do extend it, follow these steps:

1. Read the existing generator closest to your goal (`domain` or `use-case`) end-to-end.
2. Update or add EJS templates under `src/generators/{name}/files/`.
3. Update `schema.json` + `schema.d.ts` for the new option.
4. Update / add the snapshot test.
5. Run `pnpm nx test nx-plugin`.
6. Update the relevant orchestrator prompt (e.g. `new-domain.md`) so the new option is collected during Phase 0.
7. Run a real generator invocation in a throwaway directory and inspect the output.

---

## When NOT to Use a Generator

- Adding a property to an existing entity → use `/new-feature`, not the `domain` generator.
- Adding a Radix primitive → use the `webapp-radix-primitive-wrap` skill, not a generator.
- Adding a Terraform module → use the `infra-new-module` skill, not a generator.
