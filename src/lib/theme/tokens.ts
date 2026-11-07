// Builds the Material 3 design tokens (as CSS custom properties) from one brand seed color.
// The output is committed as src/app/tokens.css by `npm run tokens`, so the color library
// never ships to the browser. Keep this file free of path aliases: the generator script
// imports it directly with Node.
import {
  type DynamicColor,
  Hct,
  MaterialDynamicColors as C,
  SchemeFidelity,
  argbFromHex,
  hexFromArgb,
} from "@material/material-color-utilities";

const ROLES: Record<string, DynamicColor> = {
  background: C.background,
  "on-background": C.onBackground,
  surface: C.surface,
  "surface-dim": C.surfaceDim,
  "surface-bright": C.surfaceBright,
  "surface-container-lowest": C.surfaceContainerLowest,
  "surface-container-low": C.surfaceContainerLow,
  "surface-container": C.surfaceContainer,
  "surface-container-high": C.surfaceContainerHigh,
  "surface-container-highest": C.surfaceContainerHighest,
  "on-surface": C.onSurface,
  "surface-variant": C.surfaceVariant,
  "on-surface-variant": C.onSurfaceVariant,
  "inverse-surface": C.inverseSurface,
  "inverse-on-surface": C.inverseOnSurface,
  "inverse-primary": C.inversePrimary,
  outline: C.outline,
  "outline-variant": C.outlineVariant,
  shadow: C.shadow,
  scrim: C.scrim,
  "surface-tint": C.surfaceTint,
  primary: C.primary,
  "on-primary": C.onPrimary,
  "primary-container": C.primaryContainer,
  "on-primary-container": C.onPrimaryContainer,
  secondary: C.secondary,
  "on-secondary": C.onSecondary,
  "secondary-container": C.secondaryContainer,
  "on-secondary-container": C.onSecondaryContainer,
  tertiary: C.tertiary,
  "on-tertiary": C.onTertiary,
  "tertiary-container": C.tertiaryContainer,
  "on-tertiary-container": C.onTertiaryContainer,
  error: C.error,
  "on-error": C.onError,
  "error-container": C.errorContainer,
  "on-error-container": C.onErrorContainer,
};

export const COLOR_ROLE_NAMES: readonly string[] = Object.keys(ROLES);

// Material 3 shape scale (corner radii).
const SHAPE: Record<string, string> = {
  none: "0px",
  "extra-small": "4px",
  small: "8px",
  medium: "12px",
  large: "16px",
  "extra-large": "28px",
  full: "9999px",
};

// 8dp grid with a 4dp half step for tight spots.
const SPACING: Record<string, string> = {
  "1": "4px",
  "2": "8px",
  "3": "12px",
  "4": "16px",
  "6": "24px",
  "8": "32px",
  "12": "48px",
  "16": "64px",
};

type TypeRole = { size: number; line: number; weight: number; font: "display" | "body" };

// Material 3 type scale. Display and headline roles use the brand display typeface.
const TYPE_SCALE: Record<string, TypeRole> = {
  "display-large": { size: 57, line: 64, weight: 400, font: "display" },
  "display-medium": { size: 45, line: 52, weight: 400, font: "display" },
  "display-small": { size: 36, line: 44, weight: 400, font: "display" },
  "headline-large": { size: 32, line: 40, weight: 400, font: "display" },
  "headline-medium": { size: 28, line: 36, weight: 400, font: "display" },
  "headline-small": { size: 24, line: 32, weight: 400, font: "display" },
  "title-large": { size: 22, line: 28, weight: 400, font: "body" },
  "title-medium": { size: 16, line: 24, weight: 500, font: "body" },
  "title-small": { size: 14, line: 20, weight: 500, font: "body" },
  "body-large": { size: 16, line: 24, weight: 400, font: "body" },
  "body-medium": { size: 14, line: 20, weight: 400, font: "body" },
  "body-small": { size: 12, line: 16, weight: 400, font: "body" },
  "label-large": { size: 14, line: 20, weight: 500, font: "body" },
  "label-medium": { size: 12, line: 16, weight: 500, font: "body" },
  "label-small": { size: 11, line: 16, weight: 500, font: "body" },
};

const MOTION: Record<string, string> = {
  "easing-standard": "cubic-bezier(0.2, 0, 0, 1)",
  "easing-emphasized-decelerate": "cubic-bezier(0.05, 0.7, 0.1, 1)",
  "easing-emphasized-accelerate": "cubic-bezier(0.3, 0, 0.8, 0.15)",
  "duration-short": "150ms",
  "duration-medium": "300ms",
  "duration-long": "500ms",
};

export function colorRoles(seedHex: string, isDark: boolean): Record<string, string> {
  if (!/^#[0-9a-fA-F]{6}$/.test(seedHex)) {
    throw new Error(`Invalid brand seed color "${seedHex}": expected #rrggbb`);
  }
  const scheme = new SchemeFidelity(Hct.fromInt(argbFromHex(seedHex)), isDark, 0);
  return Object.fromEntries(
    Object.entries(ROLES).map(([name, color]) => [name, hexFromArgb(color.getArgb(scheme))]),
  );
}

function declarations(prefix: string, values: Record<string, string>, indent: string): string[] {
  return Object.entries(values).map(([name, value]) => `${indent}--${prefix}${name}: ${value};`);
}

function typeScaleDeclarations(): string[] {
  return Object.entries(TYPE_SCALE).flatMap(([name, role]) => {
    const font = role.font === "display" ? "var(--md-ref-typeface-brand)" : "var(--md-ref-typeface-plain)";
    return declarations(
      `md-sys-typescale-${name}-`,
      { font, size: `${role.size}px`, "line-height": `${role.line}px`, weight: String(role.weight) },
      "  ",
    );
  });
}

export function buildTokenCss(seedHex: string): string {
  const lines = [
    "/* Generated by `npm run tokens` from BRAND_SEED_HEX in src/config/theme.ts. Do not edit by hand. */",
    ":root {",
    "  color-scheme: light dark;",
    ...declarations("md-sys-color-", colorRoles(seedHex, false), "  "),
    ...declarations("md-sys-shape-corner-", SHAPE, "  "),
    ...declarations("space-", SPACING, "  "),
    ...typeScaleDeclarations(),
    ...declarations("md-sys-motion-", MOTION, "  "),
    "}",
    "",
    "@media (prefers-color-scheme: dark) {",
    "  :root {",
    ...declarations("md-sys-color-", colorRoles(seedHex, true), "    "),
    "  }",
    "}",
    "",
  ];
  return lines.join("\n");
}
