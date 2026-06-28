---
description: "Import Figma Variables to tokens.ts. USE WHEN: 'figma import tokens', 'import figma tokens', 'export figma variables to tokens', 'update design tokens from Figma', 'run tokens:sync'. Works with any Figma variables export."
---

# Import Figma Variables → tokens.ts

Imports color primitive scales from a Figma export into
`packages/design-tokens/src/lib/tokens.ts`, then regenerates `tokens.css`.

---

## Phase 0 — Get the variables file

If the user has not already provided a file path, ask:

> "Please provide the path to your downloaded `variables.json` file (e.g. `~/Downloads/variables.json`).
>
> **Don't have it yet?**
> 1. Install the **Variable Gen JSON** Figma plugin: `figma.com/community/plugin/1572805660073830528`
> 2. Open your Figma file → run the plugin → the file downloads as `variables.json`
> 3. Paste the file path here"

**Do not proceed until a file path is provided.**

---

## Phase 1 — Run the import

Once a file path is provided, run:

```bash
pnpm tokens:sync --from-file <path>
```

The script reads `FIGMA_PRIMITIVES_COLLECTION` and `FIGMA_COMPACT_PRIMITIVE_GROUPS`
from `.env.local` automatically — no inline env vars needed as long as they
are set there (see `.env.local.example` § Figma design tokens sync).

The script auto-detects the plugin's output format and applies a targeted
patch — only existing primitive hex values in `tokens.ts` are updated.
Semantic aliases are left unchanged.

---

## Phase 2 — Verify

1. Run `Bash` on `packages/design-tokens/src/lib/tokens.ts` and fix any TypeScript errors.
2. Regenerate CSS:
   ```bash
   pnpm tokens:gen
   ```

---

## Phase 3 — Report

Report:

> "✓ tokens.ts updated — N primitive key(s) patched from Figma.
> tokens.css regenerated. Run `pnpm nx run ui:storybook` to verify visually."

---

## What gets imported

- ✅ Primitive scale values: `brand25..950`, `gray25..950`, `grayDark25..950`,
  `danger25..950`, `warning25..950`, `success25..950`
- ❌ Semantic aliases (background, foreground, border, etc.) — update manually
  when the design system changes semantic variable names

---

## Adding a new color palette

If the design system adds a new palette not yet in `tokens.ts`:

1. Add the new keys manually to the `FIGMA:SYNC` block in
   `packages/design-tokens/src/lib/tokens.ts`
2. Register the new group mapping in `.env.local`:
   ```
   FIGMA_COMPACT_PRIMITIVE_GROUPS={"color/primary":"brand","color/neutral":"gray","color/new-palette":"newPalette"}
   ```
3. Re-run the import

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Many keys show "no match — skipped" | Those keys don't exist in `tokens.ts` yet — add them first (see above) |
| Plugin output format not recognised | Paste the first 5 lines of the JSON into chat — a new parser can be added |
