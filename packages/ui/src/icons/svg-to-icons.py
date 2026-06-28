#!/usr/bin/env python3
"""
svg-to-icons.py — SVG → icons.tsx converter for @old-st/ui
=============================================================
Converts a folder of SVG files into React forwardRef icon components
following the iconAttrs(props) / IIcon pattern used in this package.

Usage (from workspace root):
    python3 packages/ui/src/icons/svg-to-icons.py
    python3 packages/ui/src/icons/svg-to-icons.py --dry-run
    python3 packages/ui/src/icons/svg-to-icons.py --svg-dir /path/to/export

Options:
    --svg-dir PATH   Source folder of .svg files  (default: ./svg/ next to this script)
    --out     FILE   Output .tsx file             (default: ./icons.tsx next to this script)
    --dry-run        Print generated code, do not write

Component names are derived automatically from SVG filenames:
    "arrow down.svg" → ArrowDownIcon
    "checkmark.svg"  → CheckmarkIcon

Existing icons.tsx is overwritten on each run.
"""

import argparse
import json
import os
import re
import sys

# ---------------------------------------------------------------------------
# Attribute camelCase conversion
# ---------------------------------------------------------------------------

ATTR_MAP = {
    "fill-rule": "fillRule",
    "clip-rule": "clipRule",
    "stroke-width": "strokeWidth",
    "stroke-linecap": "strokeLinecap",
    "stroke-linejoin": "strokeLinejoin",
    "stroke-miterlimit": "strokeMiterlimit",
    "clip-path": "clipPath",
}

_SHAPE_TAGS = "path|circle|rect|polygon|line|polyline|ellipse"
_SKIP_VALUES = {"none", "currentcolor", "transparent", "inherit"}


def camel_attr(attr: str) -> str:
    return ATTR_MAP.get(attr, attr)


def to_jsx_attrs(s: str) -> str:
    def rep(m: re.Match) -> str:
        return f'{camel_attr(m.group(1))}="{m.group(2)}"'
    return re.sub(r'([\w-]+)="([^"]*)"', rep, s)


# ---------------------------------------------------------------------------
# Shape extraction
# ---------------------------------------------------------------------------


def extract_inner_shapes(raw: str) -> list[str]:
    """Extract primitive shape elements, unwrapping Figma mask/clipPath groups.

    Always strips <defs> and <mask> blocks first so clip-path rects and mask
    fill rectangles are never included as visible shapes.
    """
    # Strip defs/mask before extracting — these contain clip-path rects and
    # mask fill rects (e.g. Figma's <defs><clipPath><rect fill="white"/></clipPath></defs>)
    # that are not visible shapes and must not appear in the output.
    clean = re.sub(r"<defs[\s\S]*?</defs>", "", raw)
    clean = re.sub(r"<mask[\s\S]*?</mask>", "", clean)

    # Unwrap <g clip-path="..."> or <g mask="..."> containers — extract the
    # shapes inside them rather than the group element itself.
    group_contents = re.findall(r"<g[^>]*(?:clip-path|mask)=[^>]*>([\s\S]*?)</g>", clean)
    if group_contents:
        all_shapes: list[str] = []
        for gc in group_contents:
            all_shapes += re.findall(rf"<(?:{_SHAPE_TAGS})[^/]*/>" , gc)
            all_shapes += re.findall(
                rf"<(?:{_SHAPE_TAGS})[^>]*>[^<]*</(?:{_SHAPE_TAGS})>", gc
            )
        if all_shapes:
            return all_shapes

    shapes = re.findall(rf"<(?:{_SHAPE_TAGS})[^/]*/>", clean)
    shapes += re.findall(
        rf"<(?:{_SHAPE_TAGS})[^>]*>[^<]*</(?:{_SHAPE_TAGS})>", clean
    )
    return shapes


# ---------------------------------------------------------------------------
# Color detection
# ---------------------------------------------------------------------------


def _strip_defs(raw: str) -> str:
    """Strip <mask> and <defs> blocks so their fill colors don't pollute detection.

    Figma exports embed a <mask><rect fill="#D9D9D9"/></mask> clip mask that is
    not part of the visible icon shape.  Without stripping it, _extract_colors()
    sees two colors (#D9D9D9 + the real fill) and incorrectly flags every icon as
    'two-color'.
    """
    raw = re.sub(r"<defs[\s\S]*?</defs>", "", raw)
    raw = re.sub(r"<mask[\s\S]*?</mask>", "", raw)
    return raw


def _extract_colors(raw: str) -> list[tuple[str, int]]:
    """Return distinct hardcoded fill/stroke colors sorted by frequency (desc).

    Pass the result of _strip_defs(raw) to exclude mask/defs noise.
    """
    counts: dict[str, int] = {}
    for m in re.finditer(
        r'(?:fill|stroke)="(#[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*)"', raw
    ):
        val = m.group(1).lower()
        if val not in _SKIP_VALUES:
            counts[val] = counts.get(val, 0) + 1
    return sorted(counts.items(), key=lambda x: -x[1])


def detect_type(raw: str) -> str:
    """Return 'stroke', 'filled', 'two-color', or 'neutral'."""
    stripped = _strip_defs(raw)
    has_stroke = bool(re.search(r'stroke="#[0-9a-fA-F]+"', stripped)) or (
        'stroke="currentColor"' in stripped
    )
    colors = _extract_colors(stripped)

    if len(colors) >= 2:
        return "two-color"
    if has_stroke:
        return "stroke"
    if colors:
        return "filled"
    return "neutral"


# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------


def normalize_stroke_shape(s: str) -> str:
    """Remove hardcoded fills/strokes — iconAttrs() provides them at SVG level."""
    s = re.sub(r'\s*fill="none"', "", s)
    s = re.sub(r'\s*stroke="#[0-9a-fA-F]+"', "", s)
    s = re.sub(r'\s*stroke="(?!none|currentColor)[^"]+"', "", s)
    return to_jsx_attrs(s).strip()


def normalize_filled_shape(s: str) -> str:
    """Replace hardcoded fill colour with currentColor, add stroke="none"."""
    s = re.sub(r'fill="#[0-9a-fA-F]+"', 'fill="currentColor"', s)
    s = re.sub(
        r'fill="(?!none|currentColor)[a-zA-Z][^"]*"', 'fill="currentColor"', s
    )
    if "fill=" not in s:
        s = s.rstrip("/>") + ' fill="currentColor"/>'
    s = re.sub(r'\s*stroke="#[0-9a-fA-F]+"', "", s)
    s = re.sub(r'\s*stroke="(?!none|currentColor)[^"]+"', "", s)
    if "stroke=" not in s:
        s = s.rstrip("/>") + ' stroke="none"/>'
    return to_jsx_attrs(s).strip()


def normalize_two_color_shape(
    s: str, primary: str, secondary: str
) -> str:
    """
    Map primary color → fill="currentColor",
        secondary color → fill="var(--icon-color-2, currentColor)".

    Falls back to currentColor when the color2 prop is omitted at runtime,
    so the icon degrades gracefully to a single-color appearance.
    """
    # Primary: fill
    s = re.sub(
        rf'fill="{re.escape(primary)}"',
        'fill="currentColor"',
        s,
        flags=re.IGNORECASE,
    )
    # Primary: stroke (if used as accent stroke)
    s = re.sub(
        rf'stroke="{re.escape(primary)}"',
        "",
        s,
        flags=re.IGNORECASE,
    )
    # Secondary: fill
    s = re.sub(
        rf'fill="{re.escape(secondary)}"',
        'fill="var(--icon-color-2, currentColor)"',
        s,
        flags=re.IGNORECASE,
    )
    # Secondary: stroke
    s = re.sub(
        rf'stroke="{re.escape(secondary)}"',
        'stroke="var(--icon-color-2, currentColor)"',
        s,
        flags=re.IGNORECASE,
    )
    # Any remaining hardcoded fills/strokes (3rd color etc.) → currentColor
    s = re.sub(r'fill="#[0-9a-fA-F]+"', 'fill="currentColor"', s)
    s = re.sub(
        r'fill="(?!none|currentColor|var)[a-zA-Z][^"]*"', 'fill="currentColor"', s
    )
    s = re.sub(r'\s*fill="none"', "", s)
    return to_jsx_attrs(s).strip()


def auto_name(basename: str) -> str:
    """Fallback: 'my icon' -> 'MyIconIcon'."""
    return "".join(w.capitalize() for w in basename.split()) + "Icon"


# ---------------------------------------------------------------------------
# Code generation
# ---------------------------------------------------------------------------


def build_icons(svg_dir: str) -> str:
    blocks: list[str] = []
    two_color_icons: list[str] = []

    for fname in sorted(os.listdir(svg_dir)):
        if not fname.endswith(".svg"):
            continue
        base = fname[:-4]
        comp = auto_name(base)

        with open(os.path.join(svg_dir, fname)) as f:
            raw = f.read()

        icon_type = detect_type(raw)
        shapes = extract_inner_shapes(raw)

        if not shapes:
            print(f"  WARNING: no shapes found in {fname}", file=sys.stderr)

        if icon_type == "two-color":
            colors = _extract_colors(raw)
            primary = colors[0][0]
            secondary = colors[1][0]
            norm = [normalize_two_color_shape(s, primary, secondary) for s in shapes]
            two_color_icons.append(comp)
        elif icon_type == "stroke":
            norm = [normalize_stroke_shape(s) for s in shapes]
        else:
            norm = [normalize_filled_shape(s) for s in shapes]

        shape_lines = "\n    ".join(norm)
        blocks.append(
            f"export const {comp} = ({{ size = 24, color, className }}: IIcon) => (\n"
            f"  <svg\n"
            f"    width={{size}}\n"
            f"    height={{size}}\n"
            f"    viewBox=\"0 0 24 24\"\n"
            f"    fill=\"none\"\n"
            f"    stroke={{color || 'currentColor'}}\n"
            f"    strokeWidth=\"2\"\n"
            f"    strokeLinecap=\"round\"\n"
            f"    strokeLinejoin=\"round\"\n"
            f"    xmlns=\"http://www.w3.org/2000/svg\"\n"
            f"    className={{className}}\n"
            f"  >\n"
            f"    {shape_lines}\n"
            f"  </svg>\n"
            f");\n"
        )

    if two_color_icons:
        print(
            f"  Two-color icons ({len(two_color_icons)}): {', '.join(two_color_icons)}",
            file=sys.stderr,
        )
        print(
            "  → Use the color2 prop to drive secondary shapes: <Icon color2=\"#7f56d9\" />",
            file=sys.stderr,
        )

    header = "import { type IIcon } from './icon.types';\n\n"
    return header + "\n".join(blocks)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    this_dir = os.path.dirname(os.path.abspath(__file__))

    parser = argparse.ArgumentParser(
        description="Convert SVG files to @old-st/ui icon components",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--svg-dir",
        default=os.path.join(this_dir, "svg"),
        help="Folder containing .svg source files (default: ./svg/)",
    )
    parser.add_argument(
        "--out",
        default=os.path.join(this_dir, "icons.tsx"),
        help="Output .tsx file (default: ./icons.tsx)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print generated code to stdout without writing",
    )
    args = parser.parse_args()

    if not os.path.isdir(args.svg_dir):
        print(f"ERROR: svg-dir not found: {args.svg_dir}", file=sys.stderr)
        sys.exit(1)

    code = build_icons(args.svg_dir)
    icon_count = len(re.findall(r"^export const \w+Icon", code, re.MULTILINE))

    if args.dry_run:
        print(code)
        print(f"\n# Dry run — {icon_count} icons generated, not written.", file=sys.stderr)
        return

    with open(args.out, "w") as f:
        f.write(code)

    print(f"Written {icon_count} icons to {args.out}")
    print("Next steps:")
    print("  1. Update packages/ui/src/icons/index.ts barrel")
    print("  2. Update icons.spec.tsx (imports + FILLED_ICONS list)")
    print("  3. Update icons.stories.tsx if icon groups changed")


if __name__ == "__main__":
    main()
