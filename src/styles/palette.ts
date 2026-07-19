/**
 * Colour utilities + canvas palette types.
 * The colour values themselves live in themes.ts (one ThemeColors set per
 * selectable world) and in the theme.css :root base tier (the Deep Blue Sea
 * defaults that paint before JS runs). Keep those two in sync.
 *
 * These helpers are the canvas-side twins of CSS features the map can't use:
 * withAlpha() ↔ color-mix(in srgb, c N%, transparent), mix() ↔ color-mix.
 */

export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number): string =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Derive a translucent shade of a palette colour (hex or rgba in). */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const m = color.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return `rgba(${m[1]},${m[2]},${m[3]},${a.toFixed(3)})`;
  const [r, g, b] = hexToRgb(color);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

/** Blend two hex colours; t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export const tint = (c: string, t: number): string => mix(c, "#ffffff", t);
export const shade = (c: string, t: number): string => mix(c, "#000000", t);

export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    const a = sn * Math.min(ln, 1 - ln);
    return ln - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** Returns [hue 0-360, saturation 0-100, lightness 0-100]. */
export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [((h * 60) % 360 + 360) % 360, s * 100, l * 100];
}

/** WCAG relative luminance of a hex colour. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export interface MapPalette {
  ocean: string;
  oceanCenter: string;
  atmosphere: string;
  land: string;
  landBorder: string;
  landHover: string;
  landSelected: string;
  /** Explore-mode wash over already-discovered countries. */
  discoveredFill: string;
  graticule: string;
  /** Starfield dots in the space behind the globe. */
  star: string;
  correct: string;
  miss: string;
  reveal: string;
  discovery: string;
  crosshair: string;
  /** Contrast core of the pin's sonar eye. */
  pinCore: string;
  /** Direction-hint quarter arc, and its quiet full ring. */
  hintArc: string;
  hintRing: string;
  /** 0..1 multiplier for the starfield; 0 disables it (high contrast, light themes). */
  starAlpha: number;
}

/** Confetti colour sets, derived per theme so celebrations match the world. */
export interface ConfettiSet {
  milestone: string[];
  discovery: string[];
  correct: string[];
}
