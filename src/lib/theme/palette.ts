/**
 * The Fresh Sport palette (docs/UI_GUIDELINES.md v2). `src/app/tokens.css` declares each of
 * these as `--fs-color-<kebab-name>`; a test keeps the two identical and checks text contrast.
 */
export const PALETTE = {
  groundTop: "#063C3F",
  groundBottom: "#022426",
  groundDeep: "#02191B",
  surface: "rgba(255,255,255,0.06)",
  surfaceStrong: "rgba(255,255,255,0.1)",
  surfaceBorder: "rgba(255,255,255,0.14)",
  mint: "#34F5B5",
  mintLight: "#5BFFC8",
  mintDark: "#1FCB91",
  onMint: "#022426",
  tangerine: "#FF7A1A",
  tangerineLight: "#FFB050",
  onTangerine: "#1A0E02",
  text: "#F2FBF8",
  textMuted: "#A3C4BD",
  error: "#FFB3A8",
  errorSurface: "rgba(255,120,100,0.14)",
} as const;

type Rgba = { r: number; g: number; b: number; a: number };

function parse(color: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(color);
  if (rgba) return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a: Number(rgba[4]) };
  throw new Error(`Unsupported colour: ${color}`);
}

const toHex = ({ r, g, b }: Rgba) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** The opaque colour seen when `top` (possibly translucent) is laid over the opaque `bottom`. */
export function composite(top: string, bottom: string): string {
  const t = parse(top);
  const b = parse(bottom);
  const mix = (front: number, back: number) => Math.round(front * t.a + back * (1 - t.a));
  return toHex({ r: mix(t.r, b.r), g: mix(t.g, b.g), b: mix(t.b, b.b), a: 1 });
}

function luminance(color: string): number {
  const { r, g, b } = parse(color);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The WCAG 2 contrast ratio between two opaque colours. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const P = PALETTE;
// Text sits on the ground (lightest at the top of its gradient) or on a translucent surface over it.
const surfaceOnTop = composite(P.surfaceStrong, P.groundTop);

/** Every text-on-background pair the UI uses, with the WCAG minimum it must meet. */
export const TEXT_PAIRS = [
  { name: "body text on the ground", text: P.text, background: P.groundTop, min: 4.5 },
  { name: "muted text on the ground", text: P.textMuted, background: P.groundTop, min: 4.5 },
  { name: "body text on a surface", text: P.text, background: surfaceOnTop, min: 4.5 },
  { name: "muted text on a surface", text: P.textMuted, background: surfaceOnTop, min: 4.5 },
  { name: "mint text on the ground", text: P.mint, background: P.groundTop, min: 4.5 },
  { name: "mint text on a surface", text: P.mint, background: surfaceOnTop, min: 4.5 },
  { name: "error text on a surface", text: P.error, background: surfaceOnTop, min: 4.5 },
  { name: "button text on tangerine", text: P.onTangerine, background: P.tangerine, min: 4.5 },
  { name: "button text on light tangerine", text: P.onTangerine, background: P.tangerineLight, min: 4.5 },
  { name: "text on mint", text: P.onMint, background: P.mintDark, min: 4.5 },
] as const;
