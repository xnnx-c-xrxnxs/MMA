# Figma → Code — End-to-End Walkthrough

This is the **complete journey** for a developer who:
1. Just cloned this template into a fresh repo.
2. Has been handed a **Figma design system file** (and possibly screen designs).
3. Wants to end up with: a working webapp and all primitives in `@mma/ui` mirroring the Figma library.

Follow it top-to-bottom. Each part lists which **slash command** to run in Claude Code.

> **Time estimate (first time):** ~2–3 hours of active work for a typical design system with ~12 primitives + ~5 screens.
>
> **Mental model:** The Figma file is **the source of truth**. We pull tokens → primitives → screens out of it. No part of this guide asks you to hand-author component code.
>
> **Why no Code Connect?** Figma Code Connect (which makes Dev Mode return real `<Button variant="brand" />` imports for inspected frames) requires a Figma **Organization or Enterprise** plan. This template targets teams on Professional and below, so the Code Connect workflow, skill, and CI job have been removed. If your team upgrades, follow the [official Code Connect docs](https://www.figma.com/code-connect-docs/) to re-introduce it.

---

## High-level flow at a glance

| Phase | Slash command | Skill(s) | Outcome |
|---|---|---|---|
| 1. Bootstrap repo | (one-time task) `Project: Bootstrap (One-Step)` | — | Repo renamed, examples removed, `develop` created, rulesets applied |
| 2. Verify local dev | (no AI) `Dev: Start All` VS Code task | — | Webapp boots at `http://localhost:4200`, auth works |
| 3. Set up Figma MCP server | (one-time task) `claude mcp add` + `/mcp` to authenticate | — | Figma MCP tools available in Claude Code, authenticated with Figma account |
| 4. Pull Figma → tokens + primitives + screens | `/figma-import` | `figma-to-ui-component`, `figma-to-ui-screen`, `fe-design-tokens`, `webapp-ui-primitive`, `webapp-new-page` | `packages/ui/src/components/*` populated, tokens in `globals.css`, screens in `apps/webapp/src/app/(protected)/` |
| 5. Verify primitives render | (no AI) `pnpm nx run ui:storybook` + visit `/design-preview` | — | Visual confirmation every primitive matches Figma |

---

## Part 1 — Bootstrap a fresh repository (one-time, ~10 min)

Skip this part if your repo has already been bootstrapped (i.e. `pnpm-workspace.yaml` no longer mentions `@mma`, `examples/` is gone, and `develop` branch exists).

### 1.1 Clone the template

```powershell
git clone <your-repo-url> my-project
cd my-project
nvm use         # picks Node 24 from .nvmrc
```

### 1.2 Install dependencies

```powershell
npm install -g pnpm
pnpm install
```

### 1.3 Run the bootstrap task

Open the workspace in VS Code → **Terminal → Run Task…** → pick **`Project: Bootstrap (One-Step)`**.

You'll be prompted for:
- `initScope` — your npm scope, e.g. `@acme`
- `initName` — short project slug, e.g. `time-tracker`
- `initOwner` — GitHub org or username
- `initOrg` — GitHub org for CODEOWNERS
- `initDisplayName` — pretty name, e.g. `Acme Time Tracker`

The task:
- Renames `@mma/*` → `@<your-scope>/*` across the workspace.
- Deletes `examples/`.
- Creates the `develop` branch.
- Applies branch protection rulesets to `main` + `develop`.
- Creates per-env GitHub environments (`dev`, `staging`, `prod`).

When it finishes, **commit and push** any leftover dirty state, then move on.

> Reference: [docs/bootstrap.md](bootstrap.md) for what the bootstrap actually does.

---

## Part 2 — Verify the local dev loop (one-time, ~5 min)

Before you start pulling Figma assets, confirm the local stack works.

### 2.1 Create `.env.local`

```powershell
Copy-Item .env.local.example .env.local
```

### 2.2 Run `Dev: Start All`

VS Code → **Run Task…** → **`Dev: Start All`**. This:
1. Starts Docker + LocalStack + Postgres.
2. Runs Prisma migrations.
3. Boots all backend services + the webapp in parallel.

Wait ~30s, then open `http://localhost:4200`. Sign in with **`admin@test.com` / `Password123!`** (the local auth mock — see Golden Rule #29 in [CLAUDE.md](../CLAUDE.md)).

If anything is red, use `/debug-local-dev` in Claude Code. **Do not proceed to Figma steps until the webapp boots.**

---

## Part 3 — Set up the Figma MCP Server in Claude Code (one-time, ~5 min)

Before you can pull designs from Figma, you need the **Figma MCP server** connected to Claude Code. The MCP server gives Claude Code structured access to your Figma files — design context, components, variables, screenshots, and the ability to write back to the canvas.

> **Plan requirement:** The **remote** Figma MCP server (the one we use) is available on **all Figma seats and plans**, including the free plan. No paid Figma plan is required for read access.

### 3.1 Check if the workspace already has the MCP config

This template ships with a pre-configured **project-scoped** `.mcp.json` at the repo root that already includes the Figma server (alongside `github` and `context7`). Open `.mcp.json` and confirm it contains:

```json
{
  "mcpServers": {
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

A project-scoped server is shared with the whole team via this committed file. The first time Claude Code sees a new project-scoped server it will ask you to approve it. If the file exists and contains the `figma` entry, **skip to step 3.3** (authentication). If it doesn't, follow step 3.2 to add it.

### 3.2 Add the Figma MCP server manually (if not already configured)

If `.mcp.json` is missing the Figma entry (e.g. you deleted it, or you're working outside this template), add it from a terminal in the repo root:

```bash
claude mcp add --transport http figma --scope project https://mcp.figma.com/mcp
```

- `--scope project` writes the entry to `.mcp.json` so it's committed and shared with the team. Use `--scope user` instead if you only want it for yourself across all your projects.
- This is equivalent to hand-editing `.mcp.json` with the JSON block shown in 3.1.

### 3.3 Authenticate with your Figma account

After the server is configured, authenticate it with Figma. This is a **one-time OAuth flow** — you don't need a Personal Access Token for the remote server.

1. In a Claude Code session, run:

   ```
   /mcp
   ```

2. The MCP panel lists every configured server. `figma` will show **`! Needs authentication`**. Select it and choose **Authenticate**.

3. Claude Code opens your default browser to Figma's OAuth page. **Sign in to Figma** (if needed) and **click "Allow"**.

   > This grants read access to your Figma files and (for the remote server) write access to the canvas. The token is stored securely (system keychain / Claude Code credentials store) — never in `.mcp.json`.

4. The browser redirects back; in the `/mcp` panel the `figma` server status flips to **`✓ Connected`** and its tools become available.

> **Tip:** If the browser doesn't open automatically, Claude Code prints a URL in the terminal — open it manually, complete the OAuth flow, and paste the callback URL back when prompted.

### 3.4 Verify the connection

From a terminal:

```bash
claude mcp list          # shows every server + connection status
claude mcp get figma     # shows the figma server's URL, scope, and auth status
```

Or, inside a Claude Code session, run `/mcp` and confirm `figma` shows **`✓ Connected`** with a non-zero tool count (e.g. `get_design_context`, `get_screenshot`, `get_metadata`, `use_figma`). If it shows `! Needs authentication`, go back to step 3.3.

### 3.5 Re-authentication and troubleshooting

| Scenario | What to do |
|---|---|
| Server shows `! Needs authentication` after a restart | Run `/mcp`, select `figma`, choose **Authenticate**. You should not need to re-authorize unless your session expired. |
| "Unauthorized" or "Token expired" error | Run `/mcp` → select `figma` → **Clear authentication**, then **Authenticate** again to trigger a fresh OAuth flow. |
| Browser opens but redirects fail | Claude Code prints the auth URL in the terminal as a fallback — open it manually and paste the callback URL back when prompted. |
| Figma account has 2FA enabled | The OAuth flow supports 2FA — enter your code on the Figma sign-in page as normal. No extra configuration needed. |
| Want to switch Figma accounts | Run `/mcp` → `figma` → **Clear authentication** → sign out of Figma in your browser → **Authenticate** again with the new account. |
| Using a corporate Figma (SSO/SAML) | The OAuth flow supports SSO. When you click "Allow", Figma redirects through your identity provider as normal. |
| Headless / CI (no browser) | Browser OAuth can't run headless. Either authenticate once interactively (the refreshable token is reused), or use a static `Authorization` header via `--header` / the `headers` block in `.mcp.json`. |

> **Note on Personal Access Tokens:** The **remote** Figma MCP server (`https://mcp.figma.com/mcp`) uses **OAuth browser-based authentication** — you do _not_ need to generate or manage a Figma Personal Access Token. The OAuth flow handles everything. Personal Access Tokens are only needed if you're using the Figma REST API directly or the _desktop_ MCP server (not recommended for this template).

---

## Part 4 — Import the Figma design into code (~1–2 h)

This is the big AI-driven step. You have **three import surfaces** to choose from depending on what your designer gave you:

| You have… | Use this slash command | Skill behind it |
|---|---|---|
| A whole Figma file URL with everything (library + screens) | **`/figma-import`** *(recommended — covers everything)* | bundles `figma-to-ui-component`, `figma-to-ui-screen`, `fe-design-tokens`, `webapp-ui-primitive`, `webapp-new-page` |
| Just one Figma component URL (e.g. only the Button) | `/figma-component` | `figma-to-ui-component` |
| Just one Figma screen URL (e.g. the Dashboard frame) | `/figma-page` | `figma-to-ui-screen` |

For a fresh project with a real design system, **start with `/figma-import`**. It produces tokens, primitives, screens, and a `/design-preview` route in one orchestrated pass.

### 4.1 Get the Figma URLs you need

From your designer, collect:
1. **File URL** — the root of the design file, e.g. `https://www.figma.com/design/<fileKey>/<file-name>`
2. **Components/Library page URL** — the page inside the file that shows every Button variant, every Input state, etc. (the orchestrator asks for this explicitly).

> ⚠️ **Confirm the Figma file is published.** Open it → **Assets panel (left side)** → click the **ⓘ** icon next to the library → **Publish library**. The MCP-driven import in this part needs the file published.

### 4.2 Run `/figma-import` in Claude Code

In a Claude Code session:

```
/figma-import https://www.figma.com/design/<fileKey>/<file-name>
```

The orchestrator enters a **two-phase plan-then-execute** flow:

- **Phase 0 — Interview.** Answers requested:
  - Components/Library page URL (the one from §4.1)
  - Scope: `whole file` *(default for fresh projects)*
  - Route prefix for screens: usually `/` so screens become `/dashboard`, `/users`, etc.
  - Mirror to mobile? `yes` for atomic primitives
  - Overwrite existing? `no` *(safe default; fresh repo has nothing to overwrite anyway)*
  - Generate domain hooks? `no` for the first pass (stub UI only — wire to backend later)
  - Drift mode: `sync` *(Figma is source of truth)*
  - Re-run mode: `full` *(first run)*

- **Phase A — PLAN (read-only).** Produces a **single Markdown approval document** listing:
  - Every token that will land in `packages/ui/src/lib/tokens.ts` and `apps/webapp/src/app/globals.css`.
  - Every primitive that will be created in `packages/ui/src/components/<category>/<name>/`.
  - Every screen that will be scaffolded under `apps/webapp/src/app/(protected)/`.
  - The classification of each primitive as VISUAL vs BEHAVIORAL.
  - **Phase A WRITES NOTHING.** Review carefully.

- **Approval gate.** Reply with `approve` to continue, `cancel` to abort, or ask follow-up questions to refine.

- **Phase B — EXECUTE.** Writes files, runs `pnpm nx build` on touched projects, surfaces any failures.

> If the file is huge or you only want a slice, run `/figma-import` with `Scope: single page` and pass the URL of one Figma page at a time.

### 4.3 What you'll have after Phase B

- `packages/ui/src/lib/tokens.ts` populated with brand colors, neutrals, spacing, radii, font sizes pulled from Figma Variables.
- `apps/webapp/src/app/globals.css` regenerated with matching CSS variables (light + dark).
- `packages/ui/src/components/**/` containing one folder per primitive — each with `.tsx` + `index.ts` + `*.stories.tsx` + `*.spec.tsx`.
- `apps/webapp/src/app/(protected)/<screen-slug>/page.tsx` for each Figma screen.
- `apps/webapp/src/app/design-preview/` mirroring your Figma library page 1:1 for visual diffing.

### 4.4 Commit incrementally

```powershell
git checkout -b feature/figma-import
git add packages/ui apps/webapp
git commit -m "feat(ui): import design tokens + primitives from Figma"
git push origin feature/figma-import
```

Open a PR but don't merge yet — verify in Part 5 first.

---

## Part 5 — Verify the primitives render (~10 min)

### 5.1 Storybook

```powershell
pnpm nx run ui:storybook
```

Opens `http://localhost:4400`. Cycle through every primitive. Toggle the dark/light addon. Each variant in Figma should have a matching story.

### 5.2 `/design-preview` route

While `Dev: Start All` is running, visit `http://localhost:4200/design-preview`. This is a 1:1 visual mirror of the Figma library page. If a primitive looks wrong here, the mapping in Phase 7 will be wrong too — fix it now.

If anything's off:
- **Wrong color value** → re-run `/figma-import` with `drift-check` mode to see what changed.
- **Missing variant** → run `/figma-component <name>` to re-import that single primitive.
- **Layout breaks** → check the primitive's `*.stories.tsx` and adjust `cva()` if needed.

---

## Daily workflow after bootstrap

Once Parts 1–5 are done, every future change follows this pattern:

| Trigger | Run | Result |
|---|---|---|
| Add a brand-new primitive to `@mma/ui` | `/figma-component <figma-url>` | New `.tsx` + stories + tests in `packages/ui/src/components/` |
| Add a new screen | `/figma-page <figma-url>` | Page in `apps/webapp/src/app/(protected)/<slug>/` |
| Designer changed a token value | `/figma-import` (drift-check first, then sync) | `globals.css` regenerated; visual diff in `/design-preview` |
| Designer added a new variant axis | `/figma-component <figma-url>` for that primitive | Updated `cva()` + new story variants |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/figma-import` says "no Figma tools available" | Figma MCP server not configured or not authenticated | Follow **Part 3** to set up and authenticate the Figma MCP server, then re-run `/mcp` to confirm it shows `✓ Connected` |
| `/figma-import` Phase A plan looks wrong (wrong components page) | Wrong URL given for "Components/Library page" in Phase 0 | Cancel, re-run with the correct URL |
| Primitives created but visually wrong | Token mismatch | Run `/figma-import` with `drift-check` mode to compare; then `sync` to apply |
| `mcp_figma_get_design_context` returns generic JSX (raw hex, no `@mma/ui` imports) | Code Connect is not wired (requires Figma Organization/Enterprise plan) | Expected on Professional and below — use the generated JSX as a reference and adapt it to the existing primitives manually |
| Designer expects "click component in Dev Mode → see real `<Button variant=\"brand\" />`" | Same — Code Connect feature not available on Professional | Either upgrade the Figma workspace to Organization, or keep using `/figma-component` / `/figma-page` for code generation |

---

## Reference

- **Workflow orchestrators (slash commands):**
  - [.claude/commands/figma-import.md](../.claude/commands/figma-import.md)
  - [.claude/commands/figma-component.md](../.claude/commands/figma-component.md)
  - [.claude/commands/figma-page.md](../.claude/commands/figma-page.md)
  - [.claude/commands/ui-to-figma-page.md](../.claude/commands/ui-to-figma-page.md) — reverse direction (code → Figma)
- **Skills (the rules each phase follows):**
  - [.claude/skills/figma-to-ui-component/SKILL.md](../.claude/skills/figma-to-ui-component/SKILL.md)
  - [.claude/skills/figma-to-ui-screen/SKILL.md](../.claude/skills/figma-to-ui-screen/SKILL.md)
  - [.claude/skills/fe-design-tokens/SKILL.md](../.claude/skills/fe-design-tokens/SKILL.md)
  - [.claude/skills/webapp-ui-primitive/SKILL.md](../.claude/skills/webapp-ui-primitive/SKILL.md)
- **If you upgrade to Figma Organization/Enterprise:** follow the [official Code Connect docs](https://www.figma.com/code-connect-docs/) to install `@figma/code-connect`, author `*.figma.tsx` mapping files next to each primitive, and add a publish step to CI.

---

## Command cheat sheet

```powershell
# --- local dev ---
pnpm install
docker compose up -d
# VS Code: run `Dev: Start All` task

# --- design system import ---
# In Claude Code:
#   /figma-import <file-url>
#   /figma-component <component-url>     # single primitive
#   /figma-page <screen-url>              # single screen

# --- design preview ---
pnpm nx run ui:storybook                  # http://localhost:4400
# Webapp /design-preview                  http://localhost:4200/design-preview
```

---

**Next step:** if your repo is bootstrapped and your Figma file URL is ready, jump to **Part 3** (Figma MCP setup) and then **Part 4** to run `/figma-import`.
