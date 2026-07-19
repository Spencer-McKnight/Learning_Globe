/**
 * Worlds — the selectable colour themes. Each ThemeColors is a complete,
 * self-contained palette:
 *   · UI tier — mirrors the :root --color-* base tokens in theme.css
 *     (Deep Blue Sea is the default hardcoded there so first paint is right);
 *   · map tier — feeds the canvas globe via buildMapPalette().
 *
 * Every world passes the contrast gates checked by the validation script
 * (see memory.md "Colour themes"): text/surface ≥ 7, muted/surface ≥ 4.5,
 * danger & reward on panels ≥ 4.5, accent & success ≥ 4.0, button text on
 * accent/success fills ≥ 4.5, land/ocean ≥ 2.0. Rerun the script whenever
 * a value changes. Names/descriptions live in strings.ts (STR.themes).
 *
 * This file, the theme.css palette blocks, and the index.html theme-color
 * meta are the only sanctioned homes for raw colour values.
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
  | "deepSea"
  | "paperAtlas"
  | "terraFirma"
  | "springMeadow"
  | "beacon"
  | "chalkboard"
  | "emberDusk"
  | "auroraNight"
  | "candyPop";

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
  /** The original midnight ocean — sonar pings in the dark. */
  deepSea: {
    bg: "#060a18",
    surfaceSunken: "#0b132b",
    surface: "#1c2541",
    inactive: "#3a506b",
    accent: "#5bc0be",
    success: "#6fffe9",
    danger: "#ff7a6b",
    reward: "#ffd97a",
    text: "#eef6f6",
    textMuted: "#9fb3c8",
    ocean: "#102043",
    oceanCenter: "#16294f",
    land: "#41608a",
    landHover: "#567aa8",
    landSelected: "#418f88",
    landBorder: "rgba(180, 205, 230, 0.5)",
    graticule: "rgba(140, 170, 200, 0.22)",
  },
  /** Light + calm: a vintage schoolroom wall map. The "simple" world. */
  paperAtlas: {
    light: true,
    bg: "#f2ead9",
    surfaceSunken: "#e3d7bf",
    surface: "#fbf6ea",
    inactive: "#a09274",
    accent: "#1f5f8b",
    success: "#15693a",
    danger: "#bf3f2c",
    reward: "#8a5e07",
    text: "#2c2417",
    textMuted: "#6b5f4b",
    ocean: "#5b97b5",
    oceanCenter: "#6ba4c0",
    land: "#ecdcb4",
    landHover: "#ddc48c",
    landSelected: "#86aea0",
    landBorder: "rgba(90, 74, 44, 0.55)",
    graticule: "rgba(90, 74, 44, 0.28)",
  },
  /** Earthy: loam, moss, and copper under a pine-dark sea. */
  terraFirma: {
    bg: "#120d07",
    surfaceSunken: "#211710",
    surface: "#32261a",
    inactive: "#75604a",
    accent: "#c98f4c",
    success: "#a4d465",
    danger: "#ff6a45",
    reward: "#ffe08a",
    text: "#f5efe4",
    textMuted: "#bfae94",
    ocean: "#24413b",
    oceanCenter: "#2b4a42",
    land: "#83694a",
    landHover: "#9c7f5c",
    landSelected: "#92995a",
    landBorder: "rgba(230, 210, 175, 0.5)",
    graticule: "rgba(200, 180, 150, 0.22)",
  },
  /** Light + fresh: new grass and clear spring sky. */
  springMeadow: {
    light: true,
    bg: "#eaf6ec",
    surfaceSunken: "#d8ecdc",
    surface: "#ffffff",
    inactive: "#93ac97",
    accent: "#1e6b41",
    success: "#1259b0",
    danger: "#c23d1f",
    reward: "#8a5c05",
    text: "#16301f",
    textMuted: "#4f6a58",
    ocean: "#3f92c4",
    oceanCenter: "#55a3d1",
    land: "#cdeaa2",
    landHover: "#a8cf6e",
    landSelected: "#76ab72",
    landBorder: "rgba(45, 90, 60, 0.5)",
    graticule: "rgba(45, 90, 60, 0.22)",
  },
  /** Colour-blind friendly: Okabe-Ito blue/orange axis, luminance-coded. */
  beacon: {
    bg: "#0a0d13",
    surfaceSunken: "#131a26",
    surface: "#1e2734",
    inactive: "#4d5a6e",
    accent: "#56b4e9",
    success: "#7ecbff",
    danger: "#e69f00",
    reward: "#f0e442",
    text: "#f2f7fb",
    textMuted: "#a9b7c6",
    ocean: "#142132",
    oceanCenter: "#1a2a3e",
    land: "#4c688f",
    landHover: "#6485ad",
    landSelected: "#5191c1",
    landBorder: "rgba(190, 210, 235, 0.5)",
    graticule: "rgba(150, 175, 205, 0.22)",
  },
  /** Pure luminance: readable with any colour vision, including none. */
  chalkboard: {
    bg: "#050505",
    surfaceSunken: "#121212",
    surface: "#1e1e21",
    inactive: "#5c5c64",
    accent: "#c2c2cc",
    success: "#ffffff",
    danger: "#a2a2ab",
    reward: "#d8d8b8",
    text: "#f5f5f7",
    textMuted: "#ababb3",
    ocean: "#101013",
    oceanCenter: "#17171a",
    land: "#52525a",
    landHover: "#6b6b74",
    landSelected: "#8f8f99",
    landBorder: "rgba(230, 230, 235, 0.5)",
    graticule: "rgba(200, 200, 210, 0.2)",
  },
  /** Eye-catching: the last minute of a warm sunset. */
  emberDusk: {
    bg: "#170b14",
    surfaceSunken: "#251222",
    surface: "#351b30",
    inactive: "#7a5872",
    accent: "#ff8e5e",
    success: "#63e6c2",
    danger: "#ff4f75",
    reward: "#ffc94d",
    text: "#fff1e8",
    textMuted: "#cfa8b8",
    ocean: "#2a1236",
    oceanCenter: "#33173f",
    land: "#96536a",
    landHover: "#b06a84",
    landSelected: "#cb7160",
    landBorder: "rgba(255, 205, 180, 0.45)",
    graticule: "rgba(220, 170, 160, 0.2)",
  },
  /** Arctic night: aurora green and ice over a black polar sea. */
  auroraNight: {
    bg: "#030710",
    surfaceSunken: "#081120",
    surface: "#101f33",
    inactive: "#3d5673",
    accent: "#58dd9b",
    success: "#8ff0ff",
    danger: "#ff6f9a",
    reward: "#c9a6ff",
    text: "#ecf8ff",
    textMuted: "#9db8d2",
    ocean: "#0a1728",
    oceanCenter: "#0e1e33",
    land: "#3a5f78",
    landHover: "#4f7994",
    landSelected: "#499e8a",
    landBorder: "rgba(170, 220, 235, 0.5)",
    graticule: "rgba(140, 190, 215, 0.2)",
  },
  /** Playful: grape soda seas and bubblegum pins. */
  candyPop: {
    bg: "#150e20",
    surfaceSunken: "#221632",
    surface: "#31204a",
    inactive: "#6b5694",
    accent: "#ff7ac2",
    success: "#71f5c8",
    danger: "#ff6242",
    reward: "#ffd93d",
    text: "#fdf3ff",
    textMuted: "#c3aede",
    ocean: "#251a42",
    oceanCenter: "#2c2050",
    land: "#6d55a8",
    landHover: "#8a70c7",
    landSelected: "#b667b5",
    landBorder: "rgba(225, 195, 255, 0.5)",
    graticule: "rgba(190, 160, 230, 0.22)",
  },
};

/** Display order in the theme picker; "custom" renders after these. */
export const THEME_ORDER: BuiltinThemeId[] = [
  "deepSea",
  "paperAtlas",
  "terraFirma",
  "springMeadow",
  "beacon",
  "chalkboard",
  "emberDusk",
  "auroraNight",
  "candyPop",
];

export const DEFAULT_THEME_ID: ThemeId = "deepSea";
export const DEFAULT_CUSTOM_SEED = "#5bc0be";

/* ---------------- custom world derivation ---------------- */

const hueDist = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Raise lightness until `fg` clears `min` contrast on `bgHex`. */
function liftToContrast(
  h: number,
  s: number,
  startL: number,
  bgHex: string,
  min: number
): string {
  let l = startL;
  let c = hslToHex(h, s, l);
  while (contrast(c, bgHex) < min && l < 92) {
    l += 2;
    c = hslToHex(h, s, l);
  }
  return c;
}

const CUSTOM_DANGER = "#ff7a6b";
const CUSTOM_REWARD = "#ffd97a";
const DANGER_HUE = 8;

/**
 * Grow a whole dark world from one seed colour. Fixed lightness scaffolding
 * plus contrast-lifting keeps every derived world inside the same gates as
 * the built-ins, whatever hue the player picks. Danger/reward stay the
 * universal coral/gold so miss and discovery feedback never change meaning.
 */
export function deriveCustomTheme(seed: string): ThemeColors {
  const [h, s0] = hexToHsl(seed);
  const s = Math.max(45, Math.min(88, s0 || 60));

  const surface = hslToHex(h, 28, 17);
  const accent = liftToContrast(h, s, 58, surface, 4.5);

  let successHue = (h + 45) % 360;
  if (hueDist(successHue, DANGER_HUE) < 35) successHue = (h + 315) % 360;
  if (hueDist(successHue, DANGER_HUE) < 35) successHue = 150;
  const success = liftToContrast(successHue, 85, 72, surface, 4.5);

  const land = hslToHex(h, 24, 42);
  return {
    bg: hslToHex(h, 35, 5),
    surfaceSunken: hslToHex(h, 33, 11),
    surface,
    inactive: hslToHex(h, 16, 44),
    accent,
    success,
    danger: CUSTOM_DANGER,
    reward: CUSTOM_REWARD,
    text: hslToHex(h, 40, 96),
    textMuted: liftToContrast(h, 20, 71, surface, 4.5),
    ocean: hslToHex(h, 42, 15),
    oceanCenter: hslToHex(h, 42, 19),
    land,
    landHover: hslToHex(h, 26, 50),
    landSelected: mix(land, accent, 0.5),
    landBorder: withAlpha(hslToHex(h, 40, 82), 0.5),
    graticule: withAlpha(hslToHex(h, 30, 70), 0.22),
  };
}

export function resolveThemeColors(id: ThemeId, customSeed: string): ThemeColors {
  if (id === "custom") return deriveCustomTheme(customSeed);
  return THEMES[id] ?? THEMES.deepSea;
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
    graticule: withAlpha(landLighter ? inkDark : inkLight, 0.25),
    starAlpha: 0,
  };
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
    const value = c[key as keyof ThemeColors] as string;
    vars[cssVar] = value;
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
