---
name: mobile-ui-primitive
description: Add a new shared UI component to the @old-st/mobile-ui package. Use this when creating a new React Native primitive (e.g. Dialog, Checkbox, Textarea, Tooltip) in packages/mobile-ui/src/components/. Covers the variant record pattern, theme token usage, StyleSheet.create, and barrel export.
---

# Adding a UI Primitive to @old-st/mobile-ui

Canonical references:
- With variants: `packages/mobile-ui/src/components/badge.tsx`, `packages/mobile-ui/src/components/button.tsx`
- Compound component: `packages/mobile-ui/src/components/card.tsx`
- Simple component: `packages/mobile-ui/src/components/input.tsx`, `packages/mobile-ui/src/components/separator.tsx`
- Theme tokens: `packages/mobile-ui/src/lib/theme.ts`
- Barrel: `packages/mobile-ui/src/index.ts`

---

## Required Information — Ask First

1. **What component?** (e.g. Dialog, Checkbox, Textarea, Tooltip, Accordion)
2. **Does it need variants?** (e.g. size, variant — if yes, uses variant record pattern)
3. **Is it a compound component?** (e.g. Dialog has DialogTrigger, DialogContent, DialogTitle)
4. **Does it wrap a specific RN core component?** (Pressable, TextInput, View, etc.)

---

## Component Patterns

The `@old-st/mobile-ui` package uses three component shapes. All use theme tokens from `lib/theme.ts` and `StyleSheet.create()`.

### Pattern A — Component with Variant Records

Use when the component has visual variants (e.g. Badge, Button).

File: `packages/mobile-ui/src/components/{component}.tsx`

```typescript
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radii, fontSizes, spacing } from '../lib/theme';

export type {Component}Variant = 'default' | 'secondary' | 'destructive' | 'outline';

export interface {Component}Props {
  variant?: {Component}Variant;
  children: React.ReactNode;
  style?: ViewStyle;
}

const variantStyles: Record<{Component}Variant, { container: ViewStyle; textColor: string }> = {
  default: { container: { backgroundColor: colors.primary }, textColor: colors.primaryForeground },
  secondary: { container: { backgroundColor: colors.secondary }, textColor: colors.secondaryForeground },
  destructive: { container: { backgroundColor: colors.destructive }, textColor: colors.destructiveForeground },
  outline: { container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }, textColor: colors.foreground },
};

export function {Component}({ variant = 'default', children, style }: {Component}Props) {
  const v = variantStyles[variant];
  return (
    <View style={[styles.container, v.container, style]}>
      <Text style={[styles.text, { color: v.textColor }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
});
```

**Rules:**
- Define a `{Component}Variant` type and export it.
- Use a `Record<Variant, { container: ViewStyle; textColor: string }>` for variant styling — not conditional logic.
- Default variant is always `'default'`.
- Compose styles with array syntax: `[styles.base, v.container, style]` — consumer's `style` prop wins last.
- Export both the component and variant/props types.

### Pattern B — Simple Component without Variants

Use for form elements and simple wrappers (e.g. Input, Separator).

```typescript
import React from 'react';
import { TextInput, StyleSheet, type TextStyle } from 'react-native';
import { colors, radii, fontSizes, spacing } from '../lib/theme';

export interface {Component}Props {
  // ... specific props
  style?: TextStyle;
}

export function {Component}({ style, ...props }: {Component}Props) {
  return <TextInput style={[styles.input, style]} {...props} />;
}

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.sm,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
});
```

### Pattern C — Compound Component

Use for complex components with multiple related parts (e.g. Card).

```typescript
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { colors, radii, spacing, fontSizes } from '../lib/theme';

/* ─── {Component} ─── */
export interface {Component}Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function {Component}({ children, style }: {Component}Props) {
  return <View style={[styles.root, style]}>{children}</View>;
}

/* ─── {Component}Header ─── */
export interface {Component}HeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function {Component}Header({ children, style }: {Component}HeaderProps) {
  return <View style={[styles.header, style]}>{children}</View>;
}

/* ─── {Component}Title ─── */
export interface {Component}TitleProps {
  children: React.ReactNode;
  style?: TextStyle;
}

export function {Component}Title({ children, style }: {Component}TitleProps) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

/* ─── {Component}Content ─── */
export interface {Component}ContentProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function {Component}Content({ children, style }: {Component}ContentProps) {
  return <View style={[styles.content, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: { padding: spacing.lg, gap: spacing.xs },
  title: { fontSize: fontSizes.lg, fontWeight: '600', color: colors.cardForeground },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
```

**Rules:**
- Each sub-component is a separate named function (not nested).
- Each gets its own props interface, exported individually.
- Use section comments (`/* ─── Name ─── */`) to visually separate sub-components.

---

## Theme Token Usage

All styling must use tokens from `packages/mobile-ui/src/lib/theme.ts`:

| Token | Purpose | Values |
|---|---|---|
| `colors.*` | Semantic color names | `primary`, `secondary`, `destructive`, `muted`, `border`, `background`, `foreground`, `card`, `successBg/Text`, `warningBg/Text` |
| `spacing.*` | Padding, margins, gaps | `xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 24`, `xxl: 32` |
| `radii.*` | Border radius values | `sm: 6`, `md: 8`, `lg: 12`, `xl: 16`, `full: 9999` |
| `fontSizes.*` | Text sizes | `xs: 12`, `sm: 14`, `md: 16`, `lg: 18`, `xl: 20`, `xxl: 24` |

**Rules:**
- Always import tokens from `'../lib/theme'`.
- Never use raw color values (except `'transparent'` and shadow colors like `'#000'`).
- Never use raw numbers for spacing, radius, or font size — always use the token objects.
- Add new tokens to `theme.ts` if a component needs a semantic value not yet defined (e.g. a new color pair).
- Color token names mirror the web Tailwind tokens from `@old-st/ui` to keep badge-variant maps consistent.

---

## Barrel Export

File: `packages/mobile-ui/src/index.ts`

After creating the component, add it to the barrel export:

```typescript
export { {Component}, type {Component}Props, type {Component}Variant } from './components/{component}';
```

**Rules:**
- Export the component function, props interface, and variant type (if Pattern A).
- Compound components export all sub-components and their props.
- Maintain logical grouping: theme first, then components in alphabetical order.
- The barrel is the only public API — consumers import from `@old-st/mobile-ui`, never from individual files.

---

## Differences from @old-st/ui (Web)

| Aspect | `@old-st/ui` (web) | `@old-st/mobile-ui` (mobile) |
|---|---|---|
| Styling | Tailwind CSS + `cn()` + `cva()` | `StyleSheet.create()` + theme tokens |
| Variants | `class-variance-authority` | `Record<Variant, StyleObject>` |
| Ref forwarding | `ref` as a regular prop (React 19) — no `forwardRef` for new code | Not used (RN components don't need ref forwarding for most cases) |
| Base elements | HTML elements (`div`, `span`, `button`) | RN core components (`View`, `Pressable`, `Text`, `TextInput`) |
| Merge utility | `cn()` (clsx + tailwind-merge) | Array style composition: `[styles.base, variant, prop]` |
| Color tokens | CSS variables (`hsl(var(--primary))`) | JS constants (`colors.primary`) |

When adding a mobile equivalent of an existing web component:
1. Read the web component in `packages/ui/src/components/` for API design reference.
2. Translate Tailwind classes to `StyleSheet` using theme tokens.
3. Keep the same variant names and prop names where possible.
4. Export the same type names (e.g. `BadgeVariant`, `ButtonSize`) for cross-platform consistency.

---

## Common Mistakes to Avoid

- **Using inline style objects** — always use `StyleSheet.create()`. Exception: one-off dynamic values like `{ color: v.textColor }`.
- **Using raw color values** — always use `colors.*` from theme. Exception: `'transparent'` and shadow colors.
- **Using `className` or Tailwind** — React Native uses the `style` prop, not CSS classes.
- **Forgetting the barrel export** — components not exported from `index.ts` can't be imported via `@old-st/mobile-ui`.
- **Missing `type` keyword on exported interfaces** — use `export type { ... }` or `export { type FooProps }` in the barrel.
- **Nesting sub-components** — compound component parts must be top-level exports, not static properties.
