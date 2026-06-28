# Pulling Template Updates Into a Downstream Project

This template ships as a one-shot scaffold — `init-project.mjs` rewrites identifiers, removes examples, re-initializes git, and self-deletes. After that, **your project's git history is independent of the template's**.

That's deliberate (you don't want template churn polluting your client repo's history), but it means you need a workflow to pull in **future template improvements** — new skills, security fixes, infra modules, prompt orchestrators, dependency bumps.

This doc describes the recommended workflow.

## TL;DR

1. Add the template as a `template` git remote.
2. When you want updates, fetch and inspect specific commits.
3. Cherry-pick (or manually apply) the diffs you want.
4. Re-run the structural lints before merging.

## One-time setup (per downstream project)

```sh
# In your downstream project, after init-project.mjs ran:
git remote add template https://github.com/xnnx-c-xrxnxs/mma.git
git remote -v
# origin   git@github.com:acme/acme-platform.git (fetch/push)
# template https://github.com/xnnx-c-xrxnxs/mma.git (fetch/push)
```

## When the template publishes a new feature you want

```sh
# Fetch the latest template main (don't merge — there's no shared history)
git fetch template main

# Browse what's new since you bootstrapped
git log template/main --oneline -30

# Diff a specific area against your current code
git diff HEAD..template/main -- .claude/skills/
git diff HEAD..template/main -- infra/modules/
```

## Strategy 1 — Cherry-pick a single commit

Best for: a new skill, a new orchestrator prompt, a Terraform module fix.

```sh
git cherry-pick template/<commit-sha>
```

If the commit touches files that contain your project's renamed scope (`@acme/` instead of `@mma/`), the cherry-pick will conflict. Resolve by re-running the rename mentally — usually a sed away.

## Strategy 2 — Manual file copy

Best for: a self-contained new file (skill, prompt, doc, workflow).

```sh
git checkout template/main -- .claude/skills/new-skill-name/
git checkout template/main -- .github/workflows/ci-fast-check.yml

# Then review and adjust references to the template scope/org
```

## Strategy 3 — Subtree-style refresh of a known-pure subtree

For paths that should be **kept identical** to the template (e.g. workflow files, lint scripts, the structural-lint config), establish a convention that the team is willing to refresh wholesale:

```sh
# Refresh ALL workflows except project-specific overrides
git checkout template/main -- .github/workflows/
git status  # review the diff
```

Only do this for paths your team has explicitly NOT customized. We recommend keeping **`.claude/skills/`** and **`scripts/lint-standards.ts`** as such "pure" paths.

## Strategy 4 — Fork-flow

For long-lived projects that want a tight relationship with the template:

1. Fork the template repo into your org.
2. Bootstrap your client project from your fork instead of the upstream.
3. In your fork, periodically `git merge upstream/main` (your fork DOES share history with the upstream template).
4. Cherry-pick from your fork into client projects as above.

This is more overhead but gives you a controlled "blessed" template version per client.

## What's safe to refresh wholesale vs what isn't

| Path | Refresh wholesale? | Why |
|---|---|---|
| `.claude/skills/` | ✅ usually safe | Skill content is template-pure |
| `.claude/commands/` | ✅ usually safe | Same |
| `.github/workflows/security-*.yml` | ✅ usually safe | Generic security automation |
| `.github/workflows/ci-*.yml`, `cd-*.yml` | ⚠️ review | You may have project-specific jobs |
| `scripts/lint-standards.ts`, `coding-standards.config.ts` | ✅ usually safe | Pure structural rules |
| `scripts/template-hygiene.mjs` | ✅ usually safe | Pure security scan |
| `infra/modules/` | ⚠️ review | You may have customized variables |
| `infra/environments/` | ❌ never | Project-specific |
| `infra/bootstrap/` | ⚠️ review | Account-specific |
| `apps/auth`, `apps/files`, `apps/monitoring` | ⚠️ review | You may have extended these |
| `apps/webapp`, `apps/mobile` | ❌ never | Project-specific |
| `packages/contracts/` | ❌ never | Project-specific schemas |
| `packages/ui`, `packages/mobile-ui` | ⚠️ review | Tokens may be project-specific |
| `package.json`, `pnpm-lock.yaml` | ⚠️ review | Dependency bumps yes; deps removal may break |
| `docs/` | ⚠️ review | Mix of generic and project-specific |
| `README.md` | ❌ never | Project-specific |

## CI gate after refreshing

After any template-pull, **always** run:

```sh
pnpm install
pnpm tsx scripts/lint-standards.ts
node scripts/template-hygiene.mjs
pnpm nx affected -t lint,test,build
```

If any of those fail, undo and apply the change in smaller pieces.

## When in doubt

- Ask in the template repo's GitHub Discussions which commits are recommended for backporting.
- Subscribe to the template repo's releases (when we cut tagged releases).
- Don't refresh more than one subsystem per PR — small diffs are easy to review and roll back.
