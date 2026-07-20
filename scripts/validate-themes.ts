/**
 * Contrast-gate validation for every world (built-in + a sweep of custom
 * seeds). Run with: npm run validate:themes
 *
 * The gates are the source of truth for the Worlds 2.0 contrast ladder —
 * see the header of src/styles/themes.ts. Any palette change must keep this
 * script green.
 */
import {
  THEMES,
  deriveCaptionInk,
  deriveCustomTheme,
  buildMapPalette,
  type ThemeColors,
} from "../src/styles/themes";
import { contrast, tint } from "../src/styles/palette";

type Gate = [label: string, pick: (t: ThemeColors) => [string, string] | null, min: number];

const GATES: Gate[] = [
  ["text/surface", (t) => [t.text, t.surface], 7],
  ["text/bg", (t) => [t.text, t.bg], 7],
  ["muted/surface", (t) => [t.textMuted, t.surface], 4.5],
  // The well is surfaceSunken on dark worlds, a lightened surface on light
  // worlds (applyThemeToDom) — gate whichever the world actually uses.
  ["muted/well", (t) => [t.textMuted, t.light ? tint(t.surface, 0.6) : t.surfaceSunken], 4.5],
  ["accent/surface", (t) => [t.accent, t.surface], 4.5],
  ["success/surface", (t) => [t.success, t.surface], 4.5],
  ["danger/surface", (t) => [t.danger, t.surface], 4.5],
  ["reward/surface", (t) => [t.reward, t.surface], 4.5],
  ["inverse/accent", (t) => [t.surfaceSunken, t.accent], 4.5],
  ["inverse/success", (t) => [t.surfaceSunken, t.success], 4.5],
  ["inverse/reward", (t) => [t.surfaceSunken, t.reward], 4.5],
  ["inactive/surface", (t) => [t.inactive, t.surface], 3],
  ["land/ocean", (t) => [t.land, t.ocean], 3],
  ["landHover/land", (t) => [t.landHover, t.land], 1.6],
  ["landSelected/land", (t) => [t.landSelected, t.land], 1.8],
  ["accent/land", (t) => [t.accent, t.land], 3],
  ["success/land", (t) => [t.success, t.land], 3],
  // A dark red can never clear 3:1 on a mid-tone ocean, so light worlds
  // guarantee miss visibility with the marker's casing stroke instead.
  ["danger/ocean", (t) => (t.light ? null : [t.danger, t.ocean]), 3],
];

function check(id: string, t: ThemeColors): string[] {
  const fails: string[] = [];
  for (const [label, pick, min] of GATES) {
    const pair = pick(t);
    if (!pair) continue;
    const c = contrast(pair[0], pair[1]);
    if (c < min) fails.push(`${label} ${c.toFixed(2)} < ${min}`);
  }
  // Captions are two-layer cartographic labels: on every map ground at least
  // one layer (ink or halo) must clear 4.5, and the halo must outline the
  // ink at 7 so the glyph edge reads wherever the weaker layer sits.
  const cap = deriveCaptionInk(t);
  const hc = buildMapPalette(t, true);
  const grounds: [string, string][] = [
    ["land", t.land],
    ["landHover", t.landHover],
    ["landSelected", t.landSelected],
    ["ocean", t.ocean],
    ["hc-land", hc.land],
    ["hc-ocean", hc.ocean],
  ];
  for (const [g, col] of grounds) {
    const c = Math.max(contrast(cap.ink, col), contrast(cap.halo, col));
    if (c < 4.5) fails.push(`caption layers/${g} ${c.toFixed(2)} < 4.5`);
  }
  const haloC = contrast(cap.halo, cap.ink);
  if (haloC < 7) fails.push(`caption halo/ink ${haloC.toFixed(2)} < 7`);
  return fails;
}

let failed = false;
const report = (id: string, fails: string[]): void => {
  if (fails.length) {
    failed = true;
    console.error(`✗ ${id}\n   ${fails.join("\n   ")}`);
  } else {
    console.log(`✓ ${id}`);
  }
};

for (const [id, t] of Object.entries(THEMES)) report(id, check(id, t));

// Custom worlds: sweep hue × saturation × lightness of the seed. The derived
// scaffold must hold the ladder for any colour the picker can produce.
for (let h = 0; h < 360; h += 15) {
  for (const [s, l] of [
    [100, 50],
    [70, 40],
    [40, 60],
    [15, 50],
    [90, 85],
    [90, 15],
  ]) {
    const seed = `hsl(${h},${s},${l})`;
    const hex = ((): string => {
      // hslToHex lives in palette.ts but seeds arrive as hex from the picker.
      const f = (n: number): number => {
        const k = (n + h / 30) % 12;
        const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
        return l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      };
      const to = (v: number): string =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, "0");
      return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
    })();
    const fails = check(`custom ${seed}`, deriveCustomTheme(hex));
    if (fails.length) report(`custom ${seed} (${hex})`, fails);
  }
}
if (!failed) console.log("custom seed sweep (24 hues × 6 shapes): all pass");

process.exit(failed ? 1 : 0);
