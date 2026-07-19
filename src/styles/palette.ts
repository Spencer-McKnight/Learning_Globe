/**
 * Canvas palette — the "Deep Blue Sea" scheme from design.md.
 * Keep in sync with the CSS custom properties in theme.css: the CSS vars
 * style the DOM UI, these constants style the canvas map (which cannot
 * read CSS vars per-frame cheaply).
 */
export const COLORS = {
  ink: "#0b132b", // Prussian Blue — app background, ocean
  deep: "#1c2541", // Space Indigo — panels
  dusk: "#3a506b", // Dusk Blue — land, muted UI
  surf: "#5bc0be", // Tropical Teal — primary accent
  glow: "#6fffe9", // Aquamarine — success, highlights
  foam: "#eef6f6", // silver-white — text
  coral: "#ff7a6b", // misses (the one warm counterpoint)
  gold: "#ffd97a", // discoveries only
} as const;

export interface MapPalette {
  ocean: string;
  oceanCenter: string;
  atmosphere: string;
  land: string;
  landBorder: string;
  landHover: string;
  landSelected: string;
  graticule: string;
  correct: string;
  miss: string;
  reveal: string;
  discovery: string;
  crosshair: string;
}

export const MAP_PALETTE: MapPalette = {
  ocean: COLORS.ink,
  oceanCenter: "#111c3d",
  atmosphere: "rgba(111, 255, 233, 0.14)",
  land: "#2d4160",
  landBorder: "#0b132b",
  landHover: "#46608a",
  landSelected: "#3f7f7d",
  graticule: "rgba(58, 80, 107, 0.45)",
  correct: COLORS.glow,
  miss: COLORS.coral,
  reveal: COLORS.surf,
  discovery: COLORS.gold,
  crosshair: COLORS.glow,
};

export const MAP_PALETTE_HIGH_CONTRAST: MapPalette = {
  ...MAP_PALETTE,
  ocean: "#050a1c",
  oceanCenter: "#050a1c",
  land: "#5d7a9e",
  landBorder: "#0b132b",
  landHover: "#7c99bd",
  graticule: "rgba(238, 246, 246, 0.25)",
};

/** Milestone / generic celebration — mixed ocean + sand. */
export const CONFETTI_COLORS = [COLORS.glow, COLORS.surf, COLORS.gold, COLORS.foam];

/** First-ever stamp — sand-gold fanfare with a hint of seafoam. */
export const DISCOVERY_CONFETTI = [
  COLORS.gold,
  "#ffe8a8",
  "#ffc857",
  COLORS.foam,
  COLORS.glow,
];

/** Ordinary correct pin — ocean greens/blues/seafoam, no gold. */
export const CORRECT_CONFETTI = [
  COLORS.glow,
  COLORS.surf,
  "#a8fff5",
  "#3dd6c3",
  "#7ee0a8", // soft lagoon green
  "#4fc3a0", // deeper sea-green
  "#7ec8ff", // clear-water blue
  "#4a9fd8", // mid ocean blue
  COLORS.foam,
];
