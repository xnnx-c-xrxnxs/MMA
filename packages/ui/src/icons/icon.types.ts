/**
 * Shared icon contract.
 *
 * Every icon in `@old-st/ui/icons` accepts these props. The icon SVG itself
 * always uses `currentColor` for strokes / fills so the icon inherits the
 * surrounding text color via Tailwind utilities (`text-primary`,
 * `text-muted-foreground`, etc.) — dark mode is automatic.
 *
 * Override `color` ONLY when an icon must visually disagree with its text
 * context (rare — e.g. a destructive icon next to neutral text).
 *
 * Two-color filled icons also accept `color2` — the secondary fill color.
 * When omitted, secondary shapes fall back to `currentColor` (single-color).
 */
export interface IIcon {
  /** Pixel size for both width and height. Defaults to 16. */
  size?: number;
  /**
   * Primary CSS color value. Defaults to `currentColor` (inherits from parent).
   * For stroke icons: sets the stroke color.
   * For filled icons: sets the fill color (via CSS `color` property → `currentColor`).
   */
  color?: string;
  /**
   * Secondary fill color for two-color filled icons.
   * Exposed as the `--icon-color-2` CSS custom property on the SVG root.
   * Secondary paths use `fill="var(--icon-color-2, currentColor)"`.
   * When omitted, secondary shapes render in the same color as primary.
   *
   * Usage:
   *   <MyIcon color="#1a1a1a" color2="#7f56d9" />
   *   <MyIcon className="text-gray-900" color2="#7f56d9" />
   */
  color2?: string;
  /** Tailwind classes — typically `text-*` to drive `currentColor`. */
  className?: string;
  /** Optional accessible label. When omitted, icon is `aria-hidden`. */
  'aria-label'?: string;
}

/** Internal helper used by every icon component. */
export function iconAttrs(props: IIcon) {
  const { size = 16, color, color2, className, 'aria-label': ariaLabel } = props;

  // Set CSS `color` so filled icons' `fill="currentColor"` resolves correctly,
  // and expose `--icon-color-2` for secondary shapes in two-color icons.
  const style =
    color || color2
      ? ({
          ...(color ? { color } : {}),
          ...(color2 ? { '--icon-color-2': color2 } : {}),
        } as React.CSSProperties)
      : undefined;

  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color ?? 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style,
    role: ariaLabel ? 'img' : undefined,
    'aria-label': ariaLabel,
    'aria-hidden': ariaLabel ? undefined : true,
    focusable: false,
  };
}

