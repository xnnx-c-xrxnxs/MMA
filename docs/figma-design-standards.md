# Figma Design Standards

> **Reference file:** [Design System — Extraction Standards Reference](https://www.figma.com/design/pKM30rq1NExjxK5zaKVblq)
>
> This document mirrors the guidelines embedded in the Cover page of the reference Figma file. The Figma file is the canonical visual reference; this document is the text version for engineers and designers who prefer reading in the repo.

---

## 1. Purpose

The Figma design system file is structured so that an AI-powered pipeline can automatically extract components and convert them to production code (`@mma/ui` for web, `@mma/mobile-ui` for React Native).

Every component, variable, and page follows strict conventions. Following these rules ensures designs translate to code accurately and consistently.

---

## 2. File Structure

Pages are organised into two sections:

### Foundation

| Page | Content |
|---|---|
| ↳ Color | Global + semantic color palette with variable bindings |
| ↳ Typography | Type scale (heading + body families) |
| ↳ Spacing | Spacing bars + border-radius samples |
| ↳ Icons | Icon reference (placeholder) |
| ↳ Elevation | Shadow specimens (low / mid / high) |

### Core Components (29)

Accordion, Avatar, Badge, Button, Checkbox, Chip, Date Picker, Divider, Empty State, File Upload, Input Text, Input Group, Link, List Item, List Menu, Modal, Navigation, Notification Banner, Overlay, Pagination, Progress Bar, Radio, Select, Tab, Table, Textarea, Toggle, Tooltip, Wizard Stepper

### Page naming

- **Content pages:** `↳ ComponentName` (e.g. `↳ Button`, `↳ Input Text`)
- **Section dividers:** `––– Foundation –––`, `––– Core Components –––`

---

## 3. Variable Collections (5 Total, 416 Variables)

| Collection | Count | What it contains |
|---|---|---|
| `_global` | 116 | Color primitives (8 hues × 11 steps), base colors, alpha overlays, font-family strings, font sizes |
| `color` | 201 | Semantic aliases with **Light + Dark modes** (e.g. `surface/background/base/white`, `interactive/text/primary/default`) |
| `styles` | 55 | border-radius, border-width, spacing, icon-size, opacity, elevation |
| `typography` | 42 | Heading H1–H5, Body (subheading, md, sm, xs, xxs) — font-size, line-height, letter-spacing, weight |
| `screenSize` | 2 | Breakpoint + columns — Desktop + Mobile modes |

> ⚠️ The `color` collection has **two modes: Light and Dark**. Always verify components look correct in both modes before publishing.

---

## 4. Naming Conventions

### Pages

- Foundation pages: `↳ Color`, `↳ Typography`, `↳ Spacing`, etc.
- Component pages: `↳ Button`, `↳ Input Text`, `↳ Modal`, etc.
- Section dividers: `––– Foundation –––`, `––– Core Components –––`
- Use the `↳` prefix for content pages, `–––` prefix for dividers

### Components

- COMPONENT_SET name = **PascalCase**: `Button`, `Input Text`, `Badge`
- Must match the page name exactly (page `↳ Button` → set `Button`)

### Variants (inside COMPONENT_SET)

- Format: `Key=Value, Key=Value, Key=Value`
- Example: `Size=Medium, Variant=Primary, State=Default`
- Keys are PascalCase, Values are PascalCase
- Separate with comma + space

### Sub-elements (non-extractable internals)

- Prefix with `_🚫__` (underscore, emoji, double underscore)
- Example: `_🚫__ label`, `_🚫__ icon`, `_🚫__ container`
- This tells the pipeline to **skip** these nodes during extraction

---

## 5. COMPONENT_SET Rules (Critical)

The extraction pipeline **only reads COMPONENT_SET nodes**. Individual COMPONENTs, FRAMEs, and GROUPs are ignored. Every component page must have exactly **one COMPONENT_SET as a direct child of the page**.

### Rules

1. Each component page has **one COMPONENT_SET** (direct child of the page)
2. **Never** nest a COMPONENT_SET inside a FRAME or GROUP
3. Each variant inside the set is a COMPONENT (created via `Combine as Variants`)
4. Variant properties use comma-separated `Key=Value` format
5. Labels, notes, and grouping frames on the page are fine — they're ignored

### ✅ Correct

```
📄 Page: ↳ Button
   ├── 🟪 COMPONENT_SET "Button"        ← pipeline reads this
   │     ├── Size=Small, Variant=Primary
   │     ├── Size=Medium, Variant=Primary
   │     └── Size=Large, Variant=Primary
   ├── 📝 _🚫__ section-label             ← ignored (TEXT node)
   └── 🔲 _🚫__ notes-frame                ← ignored (FRAME node)
```

### ❌ Wrong

```
📄 Page: ↳ Button
   └── 🔲 FRAME "Button Section"          ← pipeline sees FRAME, skips
         └── 🟪 COMPONENT_SET "Button"    ← HIDDEN from scanner!
```

The scanner looks for COMPONENT_SET as `page.children`. Nesting it inside a frame hides it completely.

---

## 6. Variable Binding Rules

The pipeline reads which **Figma Variable** is bound to each property (fill, stroke, border-radius, spacing). It does **not** read raw hex values.

### Rules

- **Always** bind fills to `color` collection variables (semantic layer)
- **Always** bind border-radius to `styles` collection variables
- **Always** bind padding/gap to `styles/spacing/*` variables when possible
- **Never** use `_global` primitives directly on components — use semantic aliases
- **Never** hardcode hex values like `#3B82F6` — always bind to a variable

### ✅ Correct — Semantic variable binding

```
Button fill   →  interactive/background/primary/default
Button text   →  surface/text/white/normal
Button radius →  border-radius/sm
```

In Figma: Select the button → Design panel → Fill shows the variable name with 🔗 icon.

The pipeline reads: "this button uses the primary bg token" and maps it to `bg-primary` in Tailwind CSS.

### ❌ Wrong — Hardcoded hex / raw primitive

```
Button fill   →  #6366F1                      (no variable binding)
Button text   →  #FFFFFF                      (hardcoded white)
Button fill   →  _global/brand/brand-500      (raw primitive, not semantic)
```

The pipeline sees "fill is hex #6366F1" — cannot determine which token to use. Code output will have hardcoded colors that break when the theme changes.

`_global` primitives bypass the semantic layer — Dark mode won't work because dark aliases are only in the `color` collection.

---

## 7. Dark Mode

The `color` variable collection has two modes: **Light** and **Dark**. When a component's fills are bound to semantic color variables, switching the mode automatically updates every color — no manual overrides needed.

### How it works

1. Select a top-level frame on any page
2. In the Design panel, find "color" under Variable modes
3. Switch from Light → Dark
4. All variable-bound fills update instantly

### Why this matters

- The code pipeline generates both light and dark theme tokens
- If a fill is hardcoded (not variable-bound), it stays the same in Dark mode
- Users see the light color on a dark background — broken contrast

> 💡 Test every component in Dark mode before publishing. If a color doesn't change, it's hardcoded — fix the binding.

---

## 8. Adding a New Component — Checklist

- [ ] **1.** Create a new page named `↳ ComponentName`. Place it in alphabetical order under `––– Core Components –––`
- [ ] **2.** Design individual variants as COMPONENT nodes. Name each: `Key=Value, Key=Value` (PascalCase)
- [ ] **3.** Select all variants → Right-click → **Combine as Variants**. This creates a COMPONENT_SET as a direct child of the page
- [ ] **4.** Name the COMPONENT_SET in PascalCase: `DatePicker`, `FileUpload`. Must match the page name (without the `↳` prefix)
- [ ] **5.** Bind **all** fills to `color` collection variables (semantic). Check: select each element → Design panel → fill shows variable name
- [ ] **6.** Bind border-radius to `styles/border-radius/*` variables
- [ ] **7.** Prefix internal sub-elements with `_🚫__`. Labels, icons, containers, dividers — anything not a public prop
- [ ] **8.** Test in Dark mode. Switch color mode to Dark → verify all colors update correctly
- [ ] **9.** Review variant completeness. Include all meaningful combinations of Size × Variant × State. Common states: Default, Hover, Focus, Disabled, Error
- [ ] **10.** Notify the engineering team. The pipeline will auto-extract the component on next sync

---

## 9. Reference File Details

- **File:** [Design System — Extraction Standards Reference](https://www.figma.com/design/pKM30rq1NExjxK5zaKVblq)
- **Version:** v1.0 (May 2026)
- **Components:** 29 COMPONENT_SETs, 231 total variants
- **Variables:** 416 across 5 collections
- **Modes:** Light + Dark (color collection)
- **Font:** Mulish (Regular, SemiBold, ExtraBold, Black, Light, ExtraLight)
