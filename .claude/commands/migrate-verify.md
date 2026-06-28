---
description: "Verify that the rebuilt DESTINATION pages render the same structure as the SOURCE-mock pages when both are driven by the SAME shared fixtures. Boots the destination webapp in MOCK_PREVIEW mode, spawns the parity-verifier subagent per route to diff DOM structure (columns, row counts, badge text, headings, empty-state copy) against {slug}-migration/screenshots/{route}/{state}.dom.json, produces side-by-side PNGs, and writes parity/PARITY-{route}.md. Ends at 🚦 GATE #2 — the final developer sign-off. This is Step 7 (last) of the migration workflow. USE WHEN the user says 'migrate-verify', 'verify parity', 'check the rebuilt pages match the source', or after /migrate-page has built and wired the pages."
---

# Migrate Verify — Source-Mock ↔ Destination Parity (Gate #2)

You run the **final parity check** of the migration: every rebuilt destination page must render the
**same structure** as its source-mock counterpart when both are fed the **same shared fixtures**.
Structural parity (DOM) is the hard signal; visual side-by-side PNGs are advisory. You finish at
**Gate #2**, the developer's final sign-off.

> Prerequisites: `/mock-source-app` (Gate #1 approved) produced `{slug}-migration/fixtures/` +
> `screenshots/{route}/{state}.dom.json`. `/migrate-page` rebuilt the destination pages with a
> fixture-seeded `_data/{domain}.adapter.ts`. The destination must be runnable in MOCK_PREVIEW mode.

**Do NOT call tools or write files until Phase A is approved.**

---

## Phase A — PLAN (interview, read-only)

Ask and wait:

1. **Migration folder?** e.g. `old-st-flow-migration`. Default: auto-detect the single `*-migration/`.
2. **Routes to verify?** Default: all routes that have BOTH a `screenshots/{route}/` capture set AND a built destination page under `apps/webapp/src/app/(protected)/`.
3. **Destination boot command + URL?** Default: `pnpm nx run webapp:serve` (MOCK_PREVIEW) at `http://localhost:4200`. Confirm `NEXT_PUBLIC_MOCK_PREVIEW=true` + `NEXT_PUBLIC_STAGE=local` are set.
4. **States per route?** Default: every state present in each route's manifest (`populated`, `empty`, `single`, …).

---

## Phase A.5 — Pre-flight (parallel, read-only)

Run in parallel:

- `Glob` `{slug}-migration/screenshots/` → enumerate captured route × state sets.
- `Glob` `apps/webapp/src/app/(protected)/` → enumerate built destination pages; intersect with captured routes.
- Verify each target route's `_data/{domain}.adapter.ts` is seeded from `{slug}-migration/fixtures/` (otherwise parity is inconclusive — flag it).
- Confirm Playwright is available; confirm the destination boot command.

Present the **verify plan**: the matched route list (captured ∩ built), states per route, any routes
that are captured-but-not-built or built-but-not-captured (reported as gaps, not verified), and the
boot command. End with: _"Reply `approve` to boot the destination and run parity, or adjust."_

---

## Phase B — VERIFY (after approval)

1. Boot the destination webapp in MOCK_PREVIEW mode (`Bash`, background). Wait for ready.
2. For each matched route, spawn the parity verifier:

   ```
   Agent(
     name="parity-verifier",
     prompt="route={route} migrationRoot={slug}-migration destinationUrl=http://localhost:4200 destRoute={destRoute} states={states}"
   )
   ```

   Independent routes may be verified sequentially (one booted app, shared browser). Collect each
   subagent's verdict + `parity/PARITY-{route}.md`.

3. After all routes: aggregate into `{slug}-migration/parity/PARITY-SUMMARY.md` (one row per route,
   overall PASS only if every route PASSED).
4. Run `Bash` on nothing new (read-only) — but report any inconclusive routes (adapter not
   fixture-seeded) distinctly from FAIL.

---

## Phase C — 🚦 GATE #2 (HALT — final sign-off)

Present:

- `PARITY-SUMMARY.md` — per-route structural verdicts.
- The side-by-side PNGs per route × state for visual confirmation.
- Any FAILs with the exact mismatched dimension, and any inconclusive routes.

Ask the developer to confirm the rebuilt pages match the source for production acceptance.

End with: _"Reply `approve` to sign off the migration parity (Gate #2 complete), or list the routes
to fix — re-run `/migrate-page` for those routes then `/migrate-verify` again."_

**On approve:** the migration's UI parity is signed off. **On FAIL/reject:** loop — the developer
fixes the flagged destination pages via `/migrate-page`, then re-runs `/migrate-verify`.

**Do not declare the migration verified without explicit Gate #2 approval.**

---

## Final report

```markdown
# /migrate-verify — Result

**Migration:** {slug}   **Routes verified:** {n}   **Gate #2:** ✅ approved | ⛔ blocked

| Route            | States | Verdict | Notes                         |
| ---------------- | ------ | ------- | ----------------------------- |
| projects-client  | 3      | PASS    | —                             |
| timelog          | 4      | FAIL    | row count mismatch on `single`|

## Artifacts
- {slug}-migration/parity/PARITY-{route}.md (per route)
- {slug}-migration/parity/PARITY-SUMMARY.md
- side-by-side PNGs per route × state

## Next
- FAIL/inconclusive routes → fix via /migrate-page → re-run /migrate-verify.
- All PASS + Gate #2 approved → migration UI parity complete.
```

---

## Constraints

- Read-only on all production code — only `parity/**` reports + side-by-side PNGs are written.
- DOM structure is the hard signal; PNGs are advisory and never the sole cause of FAIL.
- A route is verified ONLY if its destination adapter is seeded from `{slug}-migration/fixtures/`
  (same fixtures as the source-mock) — otherwise report `inconclusive`, never a false PASS.
- Gate #2 is mandatory and halting.
- Idempotent: re-running overwrites prior `PARITY-{route}.md` for the re-verified routes.
