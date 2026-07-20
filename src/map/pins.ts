/**
 * Pin designs — the eight selectable markers the player drops on the world.
 * Every draw routine paints with the pin tip at (0, 0) inside an envelope of
 * roughly 24px tall × 18px wide, so each style lands, pops, and reads at the
 * same footprint the engine positions. The PinSheet previews call these same
 * routines, so the picker always shows exactly what will hit the map.
 *
 * Colour rule: every ink a design paints with comes from buildPinInk(). With
 * "match world colours" on, the whole pin is grown from the active world —
 * body from success/danger, metal from the world's ink, soil from its land,
 * ember from its reward. Off, the body falls back to the design's own
 * `correct`/`miss` pair and the accents to the fixed constants below (miss
 * stays in the warm coral family in every design so a wrong guess never
 * changes meaning). `core` is always the world's text colour, matching
 * MapPalette.pinCore. The constants here are, alongside themes.ts and the
 * theme.css palette blocks, a sanctioned home for raw colour values.
 */
import { mix, shade, tint, withAlpha } from "../styles/palette";
import type { ThemeColors } from "../styles/themes";

export type PinId =
  | "classic"
  | "pushpin"
  | "star"
  | "pennant"
  | "balloon"
  | "dart"
  | "rocket"
  | "sprout";

/** Every colour a pin paints with, resolved for the current world. */
export interface PinInk {
  /** Carries the correct/miss feedback. */
  body: string;
  /** High-contrast eye/tip ink — the world's text colour. */
  core: string;
  /** Bright side of a needle, pole or nose cone. */
  metal: string;
  /** Shadow side of the same. */
  metalDark: string;
  /** Bed the sprout grows out of. */
  soil: string;
  /** Rocket exhaust glow. */
  ember: string;
}

export interface PinDesign {
  /** Unthemed body colour for a correct guess — the design's signature. */
  correct: string;
  /** Unthemed body colour for a miss — always warm, so "not it" reads the same. */
  miss: string;
  draw: (ctx: CanvasRenderingContext2D, ink: PinInk) => void;
}

export type PinKind = "correct" | "miss";

/* Fixed accents, used only when "match world colours" is off. */
const METAL = "#c7d0dc";
const METAL_DARK = "#7d8799";
const SOIL = "#8a6a44";
const EMBER = "#ffc94d";

/**
 * Resolve a pin's full ink set against the active world. Themed pins pull
 * their metal from the world's text/muted pair, so a pole reads dark on light
 * worlds and light on dark ones, and their soil from the world's own land.
 */
export function buildPinInk(
  id: PinId,
  kind: PinKind,
  themed: boolean,
  c: ThemeColors
): PinInk {
  const design = PIN_DESIGNS[id] ?? PIN_DESIGNS[DEFAULT_PIN_ID];
  const body = themed
    ? kind === "correct"
      ? c.success
      : c.danger
    : kind === "correct"
      ? design.correct
      : design.miss;
  if (!themed) {
    return {
      body,
      core: c.text,
      metal: METAL,
      metalDark: METAL_DARK,
      soil: SOIL,
      ember: EMBER,
    };
  }
  const metal = mix(c.text, c.textMuted, 0.45);
  return {
    body,
    core: c.text,
    metal,
    // Always the shadow side, so the light-world pole doesn't invert its
    // shading the way a mix toward `inactive` would.
    metalDark: shade(metal, 0.4),
    soil: shade(c.land, 0.3),
    ember: c.reward,
  };
}

function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function tri(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  fill: string
): void {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function line(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stroke: string,
  width: number
): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function fivePointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  fill: string,
  rim: string
): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.stroke();
}

export const PIN_DESIGNS: Record<PinId, PinDesign> = {
  /** The original teardrop marker with its sonar-eye core. */
  classic: {
    correct: "#35d6c0",
    miss: "#ff7a6b",
    draw(ctx, { body, core }) {
      // Head arc sweeps clockwise (the long way, over the top) so the round
      // head actually closes — anticlockwise leaves only a chevron sliver.
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-6.5, -8);
      ctx.arc(0, -11, 7, Math.PI * 0.82, Math.PI * 0.18, false);
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();
      dot(ctx, 0, -11, 2.8, core);
    },
  },

  /** Corkboard classic: glossy coloured ball on a slim tapered steel needle. */
  pushpin: {
    correct: "#37c65b",
    miss: "#e8493c",
    draw(ctx, { body, metal, metalDark }) {
      tri(ctx, 0, 0, -1.2, -9.5, 1.2, -9.5, metalDark);
      tri(ctx, 0, -0.6, -0.5, -9.5, 0.3, -9.5, metal);
      ctx.beginPath();
      ctx.arc(0, -15, 6.2, 0, Math.PI * 2);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = shade(body, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
      dot(ctx, -2.1, -17.2, 1.9, tint(body, 0.55));
    },
  },

  /** Gold star on a post — teacher's mark for map star students. */
  star: {
    correct: "#ffc93d",
    miss: "#ff7a6b",
    draw(ctx, { body, core, metalDark }) {
      line(ctx, 0, 0, 0, -9, metalDark, 1.8);
      fivePointStar(ctx, 0, -15, 7.2, 3, body, shade(body, 0.3));
      dot(ctx, 0, -14.6, 1.6, core);
    },
  },

  /** Explorer's pennant curling in the wind atop a tall pole. */
  pennant: {
    correct: "#3fd68f",
    miss: "#ff7a6b",
    draw(ctx, { body, core, metalDark }) {
      line(ctx, 0, 0, 0, -21, metalDark, 1.7);
      ctx.beginPath();
      ctx.moveTo(0.6, -20.5);
      ctx.quadraticCurveTo(6, -20.2, 10.5, -17.2);
      ctx.quadraticCurveTo(6, -15.8, 0.6, -13.6);
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();
      dot(ctx, 0, -21, 1.6, core);
    },
  },

  /** A little balloon bobbing on a curled string. */
  balloon: {
    correct: "#5bb7ff",
    miss: "#ff7a6b",
    draw(ctx, { body, core }) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(2.2, -3.6, 0, -7);
      ctx.strokeStyle = withAlpha(core, 0.75);
      ctx.lineWidth = 1;
      ctx.stroke();
      tri(ctx, 0, -8.4, -1.8, -6.4, 1.8, -6.4, body);
      ctx.beginPath();
      ctx.ellipse(0, -15.2, 6, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = shade(body, 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
      dot(ctx, -2.2, -17.6, 1.9, tint(body, 0.55));
    },
  },

  /** Thrown from across the room, landed point-first at a jaunty lean. */
  dart: {
    correct: "#59d472",
    miss: "#ff7a6b",
    draw(ctx, { body, core, metal, metalDark }) {
      ctx.rotate(-0.5);
      tri(ctx, 0, 0, -1.4, -5.5, 1.4, -5.5, metalDark);
      ctx.beginPath();
      ctx.rect(-1.7, -12, 3.4, 6.5);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = shade(body, 0.3);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      line(ctx, 0, -12, 0, -16.5, metal, 1.2);
      tri(ctx, 0, -15.5, -5.2, -22, 0, -20.2, body);
      tri(ctx, 0, -15.5, 5.2, -22, 0, -20.2, body);
      dot(ctx, 0, -8.8, 1.3, core);
    },
  },

  /** Touchdown confirmed — fins down, ember still glowing under the nozzle. */
  rocket: {
    correct: "#49e0b1",
    miss: "#ff7a6b",
    draw(ctx, { body, core, ember }) {
      tri(ctx, -1.9, -4.4, 1.9, -4.4, 0, -0.2, ember);
      tri(ctx, -3.4, -10, -7.2, -3.4, -3.2, -5.6, shade(body, 0.3));
      tri(ctx, 3.4, -10, 7.2, -3.4, 3.2, -5.6, shade(body, 0.3));
      ctx.beginPath();
      ctx.moveTo(-3.9, -4.6);
      ctx.quadraticCurveTo(-4.9, -13.5, 0, -21.2);
      ctx.quadraticCurveTo(4.9, -13.5, 3.9, -4.6);
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = shade(body, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
      dot(ctx, 0, -13.6, 2.1, core);
    },
  },

  /** A seedling in fresh soil — right answers grow, wrong ones wilt. */
  sprout: {
    correct: "#58cf63",
    miss: "#ffa259",
    draw(ctx, { body, core, soil }) {
      ctx.beginPath();
      ctx.ellipse(0, -0.6, 3.4, 1.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = soil;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.quadraticCurveTo(0.9, -6, 0, -10.5);
      ctx.strokeStyle = shade(body, 0.3);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -9.6);
      ctx.quadraticCurveTo(-7.6, -10, -6.6, -15.8);
      ctx.quadraticCurveTo(-1.4, -15.4, 0, -9.6);
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -10.8);
      ctx.quadraticCurveTo(7.8, -11.4, 6.8, -17.4);
      ctx.quadraticCurveTo(1.2, -17, 0, -10.8);
      ctx.closePath();
      ctx.fillStyle = tint(body, 0.18);
      ctx.fill();
      dot(ctx, 0, -11, 1.5, core);
    },
  },
};

/** Display order in the pin picker. */
export const PIN_ORDER: PinId[] = [
  "classic",
  "pushpin",
  "star",
  "pennant",
  "balloon",
  "dart",
  "rocket",
  "sprout",
];

export const DEFAULT_PIN_ID: PinId = "classic";
