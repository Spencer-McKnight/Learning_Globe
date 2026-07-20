/**
 * Worlds — the selectable colour themes. Each ThemeColors is a complete,
 * self-contained palette:
 *   · UI tier — mirrors the :root --color-* base tokens in theme.css
 *     (Midnight Sonar is the default hardcoded there so first paint is right);
 *   · map tier — feeds the canvas globe via buildMapPalette().
 *
 * Every world passes the contrast gates checked by scripts/validate-themes.ts
 * (npm run validate:themes). The ladder (WCAG minimums): text/surface ≥ 7,
 * muted on surface + wells ≥ 4.5, accent/success/danger/reward on panels
 * ≥ 4.5, button text on fills ≥ 4.5, inactive/surface ≥ 3, land/ocean ≥ 3,
 * landHover/land ≥ 1.6, landSelected/land ≥ 1.8 (plus a hue shift),
 * accent & success on land ≥ 3, danger/ocean ≥ 3 on dark worlds (light
 * worlds rely on the marker casing instead), pin-caption halo/ink ≥ 7
 * (deriveCaptionInk). Structurally each world is three separated lightness
 * bands — ocean near the dark pole, land mid, signal colours bright (or the
 * mirror of that on light worlds) — so contrast comes from tone distance
 * and hue stays free for character. Rerun the script whenever a value
 * changes.
 * Names/descriptions live in strings.ts (STR.themes).
 *
 * This file, the theme.css palette blocks, the pin signature/accent colours
 * in map/pins.ts, and the index.html theme-color meta are the only sanctioned
 * homes for raw colour values.
 */
import {
  contrast,
  hexToHsl,
  hslToHex,
  luminance,
  mix,
  shade,
  tint,
  withAlpha,
  type ConfettiSet,
  type MapPalette,
} from "./palette";

export type BuiltinThemeId =
  | "midnightSonar"
  | "porcelain"
  | "springMeadow"
  | "cinderforge"
  | "observatory"
  | "signalTide"
  | "inkstone";

export type ThemeId = BuiltinThemeId | "custom";

export interface ThemeColors {
  /* UI tier — one-to-one with the --color-* base tokens. */
  bg: string;
  surfaceSunken: string;
  surface: string;
  inactive: string;
  accent: string;
  success: string;
  danger: string;
  reward: string;
  text: string;
  textMuted: string;
  /* Map tier — the canvas globe. */
  ocean: string;
  oceanCenter: string;
  land: string;
  landHover: string;
  landSelected: string;
  landBorder: string;
  graticule: string;
  /** Light themes flip form controls/scrollbars and disable the star layer. */
  light?: boolean;
}

export const THEMES: Record<BuiltinThemeId, ThemeColors> = {
  /** Night-flight radar: near-black indigo sea, moonlit slate land. */
  midnightSonar: {
    bg: "#05070f",
    surfaceSunken: "#0c1120",
    surface: "#161d33",
    inactive: "#7787a8",
    accent: "#6fd6ff",
    success: "#7dffb0",
    danger: "#ff9587",
    reward: "#ffd76a",
    text: "#f2f6ff",
    textMuted: "#aab7d7",
    ocean: "#071226",
    oceanCenter: "#0b1830",
    land: "#50658b",
    landHover: "#8fa6c9",
    landSelected: "#63b7ab",
    landBorder: "rgba(200, 220, 245, 0.7)",
    graticule: "rgba(150, 180, 215, 0.12)",
  },
  /** Light + calm: white glaze, deep ink, a dark tea-glaze sea. */
  porcelain: {
    light: true,
    bg: "#eef1f4",
    surfaceSunken: "#dde3e9",
    surface: "#ffffff",
    inactive: "#66788a",
    accent: "#0f5e9c",
    success: "#0e6b46",
    danger: "#b02c20",
    reward: "#7d5302",
    text: "#16202c",
    textMuted: "#44546b",
    ocean: "#27506b",
    oceanCenter: "#2e5b78",
    land: "#eae3d2",
    landHover: "#b3ab92",
    landSelected: "#7fa08b",
    landBorder: "rgba(45, 60, 70, 0.7)",
    graticule: "rgba(45, 60, 70, 0.13)",
  },
  /** Light + fresh: new grass and spring sky, re-keeled with a deeper sea. */
  springMeadow: {
    light: true,
    bg: "#e9f4e6",
    surfaceSunken: "#d3e6d1",
    surface: "#ffffff",
    inactive: "#5f7a68",
    accent: "#175f3a",
    success: "#124f9e",
    danger: "#ab3115",
    reward: "#775002",
    text: "#122619",
    textMuted: "#3f5a49",
    ocean: "#2a6f8f",
    oceanCenter: "#337a9b",
    land: "#d7ecad",
    landHover: "#94ba62",
    landSelected: "#4f8a68",
    landBorder: "rgba(35, 75, 48, 0.7)",
    graticule: "rgba(35, 75, 48, 0.12)",
  },
  /** Basalt-black sea, ember land, molten signal colours. */
  cinderforge: {
    bg: "#0d0705",
    surfaceSunken: "#1a100a",
    surface: "#2a1a10",
    inactive: "#957d64",
    accent: "#ffb35c",
    success: "#b5e878",
    danger: "#ff8266",
    reward: "#ffe08a",
    text: "#f8efe6",
    textMuted: "#cbb29a",
    ocean: "#160e13",
    oceanCenter: "#1c1219",
    land: "#8a5f42",
    landHover: "#c08c62",
    landSelected: "#cf9a5e",
    landBorder: "rgba(240, 215, 185, 0.68)",
    graticule: "rgba(210, 180, 150, 0.11)",
  },
  /** Violet void, moon-slate land, starlight accents. */
  observatory: {
    bg: "#070312",
    surfaceSunken: "#100a22",
    surface: "#1b1233",
    inactive: "#8a80b3",
    accent: "#c3b2ff",
    success: "#7dffd4",
    danger: "#ff8ba6",
    reward: "#ffd36e",
    text: "#f1edff",
    textMuted: "#b5addb",
    ocean: "#0a0618",
    oceanCenter: "#0f0a20",
    land: "#5e5b84",
    landHover: "#928eb8",
    landSelected: "#6fb9a4",
    landBorder: "rgba(215, 205, 250, 0.68)",
    graticule: "rgba(175, 165, 220, 0.11)",
  },
  /** Colour-blind safe: blue/orange axis only, every state luminance-coded. */
  signalTide: {
    bg: "#05090e",
    surfaceSunken: "#0d151d",
    surface: "#182430",
    inactive: "#7d8fa1",
    accent: "#7ac8ff",
    success: "#c9e8ff",
    danger: "#ffab40",
    reward: "#f4e35c",
    text: "#f3f8fc",
    textMuted: "#a8bfd1",
    ocean: "#060e17",
    oceanCenter: "#0a1520",
    land: "#4c6785",
    landHover: "#84a2c2",
    landSelected: "#9fc6e8",
    landBorder: "rgba(200, 222, 240, 0.7)",
    graticule: "rgba(150, 180, 210, 0.12)",
  },
  /** Pure luminance ladder: readable with no colour vision at all. */
  inkstone: {
    bg: "#070707",
    surfaceSunken: "#131313",
    surface: "#1f1f22",
    inactive: "#8c8c94",
    accent: "#d9d9e1",
    success: "#ffffff",
    danger: "#a8a8b0",
    reward: "#e3e3c2",
    text: "#f6f6f8",
    textMuted: "#b3b3bb",
    ocean: "#0b0b0e",
    oceanCenter: "#101013",
    land: "#5e5e68",
    landHover: "#90909b",
    landSelected: "#c0c0cc",
    landBorder: "rgba(238, 238, 243, 0.7)",
    graticule: "rgba(205, 205, 215, 0.1)",
  },
};

/** Display order in the theme picker; "custom" renders after these. */
export const THEME_ORDER: BuiltinThemeId[] = [
  "midnightSonar",
  "porcelain",
  "springMeadow",
  "cinderforge",
  "observatory",
  "signalTide",
  "inkstone",
];

/** Saved theme ids from the Worlds 1.0 catalogue map to their closest heir. */
export const LEGACY_THEME_IDS: Record<string, BuiltinThemeId> = {
  deepSea: "midnightSonar",
  paperAtlas: "porcelain",
  terraFirma: "cinderforge",
  beacon: "signalTide",
  chalkboard: "inkstone",
  emberDusk: "cinderforge",
  auroraNight: "observatory",
  candyPop: "observatory",
};

export const DEFAULT_THEME_ID: ThemeId = "midnightSonar";
export const DEFAULT_CUSTOM_SEED = "#6fd6ff";

/* ---------------- custom world derivation ---------------- */

const hueDist = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Raise lightness until `fg` clears every `[bg, min]` contrast pair. */
function liftToContrast(
  h: number,
  s: number,
  startL: number,
  gates: [string, number][]
): string {
  let l = startL;
  let c = hslToHex(h, s, l);
  while (gates.some(([bg, min]) => contrast(c, bg) < min) && l < 96) {
    l += 2;
    c = hslToHex(h, s, l);
  }
  return c;
}

/** Tint `col` toward white until it clears `min` contrast on `bgHex`. */
function tintToContrast(col: string, bgHex: string, min: number): string {
  let c = col;
  for (let i = 0; i < 24 && contrast(c, bgHex) < min; i++) {
    const next = tint(c, 0.08);
    if (next === c) break;
    c = next;
  }
  return c;
}

const CUSTOM_DANGER = "#ff9587";
const CUSTOM_REWARD = "#ffd76a";
const DANGER_HUE = 8;

/**
 * Grow a whole dark world from one seed colour. The same three-band ladder
 * as the built-ins — ocean near the dark pole, land mid, signals bright —
 * with contrast-lifting so every derived world clears every gate whatever
 * hue the player picks. Danger/reward stay the universal coral/gold so miss
 * and discovery feedback never change meaning.
 */
export function deriveCustomTheme(seed: string): ThemeColors {
  const [h, s0] = hexToHsl(seed);
  const s = Math.max(45, Math.min(88, s0 || 60));

  const surface = hslToHex(h, 28, 15);
  const ocean = hslToHex(h, 45, 7);
  let land = liftToContrast(h, 26, 38, [[ocean, 3]]);
  // High-luma hues (yellows) start above the land band: settle back down
  // until white caption ink clears the land, keeping headroom over the ocean.
  {
    let [, , l] = hexToHsl(land);
    while (
      contrast("#ffffff", land) < 4.6 &&
      contrast(hslToHex(h, 26, l - 2), ocean) >= 3 &&
      l > 20
    ) {
      l -= 2;
      land = hslToHex(h, 26, l);
    }
  }
  const accent = liftToContrast(h, s, 58, [
    [surface, 4.5],
    [land, 3],
  ]);

  let successHue = (h + 45) % 360;
  if (hueDist(successHue, DANGER_HUE) < 35) successHue = (h + 315) % 360;
  if (hueDist(successHue, DANGER_HUE) < 35) successHue = 150;
  const success = liftToContrast(successHue, 85, 72, [
    [surface, 4.5],
    [land, 3],
  ]);

  const [, landS, landL] = hexToHsl(land);
  const landHover = liftToContrast(h, Math.min(landS + 4, 100), landL + 8, [[land, 1.6]]);
  const landSelected = tintToContrast(mix(land, accent, 0.55), land, 1.8);

  return {
    bg: hslToHex(h, 35, 4),
    surfaceSunken: hslToHex(h, 33, 9),
    surface,
    inactive: liftToContrast(h, 16, 42, [[surface, 3]]),
    accent,
    success,
    danger: CUSTOM_DANGER,
    reward: CUSTOM_REWARD,
    text: hslToHex(h, 40, 96),
    textMuted: liftToContrast(h, 20, 71, [[surface, 4.5]]),
    ocean,
    oceanCenter: hslToHex(h, 45, 10),
    land,
    landHover,
    landSelected,
    landBorder: withAlpha(hslToHex(h, 40, 86), 0.7),
    graticule: withAlpha(hslToHex(h, 30, 70), 0.11),
  };
}

/** Normalise any stored id (including Worlds 1.0 ids) to a live ThemeId. */
export function migrateThemeId(id: string): ThemeId {
  if (id === "custom" || id in THEMES) return id as ThemeId;
  return LEGACY_THEME_IDS[id] ?? DEFAULT_THEME_ID;
}

export function resolveThemeColors(id: ThemeId, customSeed: string): ThemeColors {
  if (id === "custom") return deriveCustomTheme(customSeed);
  return THEMES[id] ?? THEMES[migrateThemeId(id) as BuiltinThemeId] ?? THEMES.midnightSonar;
}

/* ---------------- canvas twins ---------------- */

export function buildMapPalette(c: ThemeColors, highContrast: boolean): MapPalette {
  const base: MapPalette = {
    ocean: c.ocean,
    oceanCenter: c.oceanCenter,
    atmosphere: withAlpha(c.success, 0.16),
    land: c.land,
    landBorder: c.landBorder,
    landHover: c.landHover,
    landSelected: c.landSelected,
    discoveredFill: withAlpha(c.accent, 0.28),
    graticule: c.graticule,
    star: c.text,
    correct: c.success,
    miss: c.danger,
    reveal: c.accent,
    discovery: c.reward,
    crosshair: c.success,
    pinCore: c.text,
    hintArc: c.success,
    hintRing: c.accent,
    starAlpha: c.light ? 0 : 1,
  };
  if (!highContrast) return base;
  // Theme-agnostic clarity boost: whichever of land/ocean is darker sinks
  // toward black, the lighter one rises toward white — separation grows for
  // light and dark worlds alike, and decorative texture switches off.
  const inkDark = luminance(c.bg) < luminance(c.text) ? c.bg : c.text;
  const inkLight = inkDark === c.bg ? c.text : c.bg;
  const landLighter = luminance(c.land) > luminance(c.ocean);
  const ocean = landLighter ? shade(c.ocean, 0.45) : mix(c.ocean, inkDark, 0.75);
  return {
    ...base,
    ocean,
    oceanCenter: ocean,
    land: landLighter ? tint(c.land, 0.3) : mix(c.land, inkLight, 0.26),
    landHover: landLighter ? shade(c.land, 0.18) : mix(c.land, inkLight, 0.45),
    landBorder: withAlpha(inkDark, 0.9),
    graticule: withAlpha(landLighter ? inkDark : inkLight, 0.12),
    starAlpha: 0,
  };
}

/* ---------------- pin caption ink ---------------- */

/** Contrast the caption ink aims for on every map ground it can sit over. */
const CAPTION_INK_MIN = 4.5;
/** The halo must always read as an edge against the ink itself. */
const CAPTION_HALO_MIN = 7;

/**
 * Ink + halo for the captions nestled under guess pins. No single colour can
 * clear WCAG on both mid-tone land and dark ocean, so the caption is
 * two-layer, like cartographic map labels: ink seeded from whichever of
 * text/bg survives the worst ground better, pushed toward its pole until
 * every ground clears CAPTION_INK_MIN (or the pole is reached), plus an
 * opposite-pole halo that outlines the glyphs wherever the ink alone falls
 * short. Grounds include the high-contrast palette's land/ocean so the
 * toggle needs no separate caption override. The ink also feeds
 * --color-text-onmap (aliased in theme.css) for any UI text that floats
 * directly over the globe (masthead tagline, explore link).
 */
export function deriveCaptionInk(c: ThemeColors): { ink: string; halo: string } {
  const hc = buildMapPalette(c, true);
  const grounds = [
    c.land,
    c.landHover,
    c.landSelected,
    c.ocean,
    c.oceanCenter,
    hc.land,
    hc.landHover,
    hc.ocean,
  ];
  const worst = (fg: string): number => Math.min(...grounds.map((g) => contrast(fg, g)));

  const fromText = worst(c.text) >= worst(c.bg);
  let ink = fromText ? c.text : c.bg;
  let halo = fromText ? c.bg : c.text;
  const inkIsLight = luminance(ink) >= luminance(halo);
  const push = (col: string, towardWhite: boolean): string =>
    towardWhite ? tint(col, 0.4) : shade(col, 0.4);

  for (let i = 0; i < 12 && worst(ink) < CAPTION_INK_MIN; i++) {
    const next = push(ink, inkIsLight);
    if (next === ink) break;
    ink = next;
  }
  for (let i = 0; i < 12 && contrast(halo, ink) < CAPTION_HALO_MIN; i++) {
    const next = push(halo, !inkIsLight);
    if (next === halo) break;
    halo = next;
  }
  return { ink, halo };
}

export function buildConfetti(c: ThemeColors): ConfettiSet {
  return {
    milestone: [c.success, c.accent, c.reward, c.text],
    discovery: [c.reward, tint(c.reward, 0.4), mix(c.reward, c.danger, 0.25), c.text, c.success],
    correct: [
      c.success,
      c.accent,
      tint(c.success, 0.4),
      mix(c.success, c.accent, 0.5),
      tint(c.accent, 0.35),
      c.text,
    ],
  };
}

/* ---------------- DOM apply + instant reload ---------------- */

/**
 * Snapshot of the resolved CSS vars, read by the inline script in index.html
 * before first paint so a saved theme loads with zero flash of the default.
 */
export const THEME_CSS_KEY = "lg:theme-css";

const CSS_VAR_OF: Partial<Record<keyof ThemeColors, string>> = {
  bg: "--color-bg",
  surfaceSunken: "--color-surface-sunken",
  surface: "--color-surface",
  inactive: "--color-inactive",
  accent: "--color-accent",
  success: "--color-success",
  danger: "--color-danger",
  reward: "--color-reward",
  text: "--color-text",
  textMuted: "--color-text-muted",
};

export function applyThemeToDom(c: ThemeColors): void {
  const root = document.documentElement;
  const vars: Record<string, string> = {};
  for (const [key, cssVar] of Object.entries(CSS_VAR_OF)) {
    vars[cssVar] = c[key as keyof ThemeColors] as string;
  }
  const caption = deriveCaptionInk(c);
  vars["--color-pin-caption"] = caption.ink;
  vars["--color-pin-caption-halo"] = caption.halo;
  // Wells (inputs, tracks, tiles): dark worlds sink below the panel; light
  // worlds instead rise above it toward white — a darker fill on a light
  // panel reads as a disabled control.
  vars["--color-well"] = c.light ? tint(c.surface, 0.6) : c.surfaceSunken;
  for (const [cssVar, value] of Object.entries(vars)) {
    root.style.setProperty(cssVar, value);
  }
  root.style.colorScheme = c.light ? "light" : "dark";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", c.surfaceSunken);
  try {
    localStorage.setItem(
      THEME_CSS_KEY,
      JSON.stringify({ vars, themeColor: c.surfaceSunken, light: Boolean(c.light) })
    );
  } catch {
    // Storage unavailable — theme still applies, it just won't pre-paint next visit.
  }
}
