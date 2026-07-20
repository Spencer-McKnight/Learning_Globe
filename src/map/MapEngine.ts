import {
  geoEqualEarth,
  geoGraticule10,
  geoInterpolate,
  geoMercator,
  geoNaturalEarth1,
  geoOrthographic,
  geoPath,
  type GeoPath,
  type GeoProjection,
} from "d3-geo";
import { geoDistance } from "d3-geo";
import type { CompassKey, Country, LonLat, Region, World } from "../lib/geo";
import { COMPASS_BEARING, continentRegion, destinationPoint, hitTest } from "../lib/geo";
import type { ProjectionId } from "../lib/storage";
import { withAlpha, type ConfettiSet, type MapPalette } from "../styles/palette";
import {
  buildConfetti,
  buildMapPalette,
  THEMES,
  type ThemeColors,
} from "../styles/themes";
import { InteractionController, type ArrowDir, type ZoomDir } from "./InteractionController";
import { buildPinInk, DEFAULT_PIN_ID, PIN_DESIGNS, type PinDesign, type PinId } from "./pins";

export type ConfettiKind = "discovery" | "correct" | "milestone";

export interface MapEngineCallbacks {
  onTap: (lonlat: LonLat, screen: [number, number]) => void;
  /** A tap that landed off the map entirely (outside the globe's disc). */
  onVoidTap?: () => void;
  onHover?: (country: Country | null) => void;
  /** Region-pick mode: the playable region under the cursor, as it changes. */
  onRegionHover?: (region: Region | null) => void;
  /** Fired when the user pans, zooms, or keyboard-glides the map. */
  onInteract?: () => void;
}

interface Pin {
  lonlat: LonLat;
  kind: "correct" | "miss";
  born: number;
  /** Stylized caption drawn under the pin (miss distance, tries left, etc.). */
  lines?: string[];
}

interface Ripple {
  lonlat: LonLat;
  color: string;
  born: number;
  dur: number;
}

interface Flash {
  color: string;
  born: number;
  dur: number;
  fill: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  born: number;
  dur: number;
  size: number;
  shape: "rect" | "spark" | "dot";
  drag: number;
  gravity: number;
}

/** Soft compass glow around a miss pin — snaps to an 8-wind, not an exact bearing. */
interface DirectionHint {
  lonlat: LonLat;
  bearingDeg: number;
  born: number;
}

interface FlyAnim {
  born: number;
  dur: number;
  interp: (t: number) => [number, number];
  k0: number;
  k1: number;
}

/**
 * Chrome the map must stay clear of, in px per edge. The map is fitted and
 * centered inside what's left, so the menu can frame the globe in the gap
 * between the title and the Play button instead of running underneath them.
 */
export interface ViewInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const NO_INSETS: ViewInsets = { top: 0, right: 0, bottom: 0, left: 0 };

interface InsetAnim {
  from: ViewInsets;
  to: ViewInsets;
  born: number;
  dur: number;
}

function insetsEqual(a: ViewInsets, b: ViewInsets): boolean {
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.right - b.right) < 0.5 &&
    Math.abs(a.bottom - b.bottom) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5
  );
}

function lerpInsets(a: ViewInsets, b: ViewInsets, t: number): ViewInsets {
  return {
    top: a.top + (b.top - a.top) * t,
    right: a.right + (b.right - a.right) * t,
    bottom: a.bottom + (b.bottom - a.bottom) * t,
    left: a.left + (b.left - a.left) * t,
  };
}

/** Approximate horizontal px-per-radian factor relative to projection.scale(). */
const X_FACTOR: Record<ProjectionId, number> = {
  globe: 1,
  mercator: 1,
  naturalEarth: 0.87,
  equalEarth: 0.85,
};

const MAX_LAT_MERCATOR = 84;
/** Mercator y at that latitude, in projection units — the half-height at scale 1. */
const MERCATOR_Y_MAX = Math.log(Math.tan(Math.PI / 4 + (MAX_LAT_MERCATOR * Math.PI) / 360));
/* Tap vs drag. Generous on both axes: a deliberate thumb press on a small
   country rests longer and wobbles more than a mouse click, and a rejected
   tap reads as the app ignoring you. */
const TAP_SLOP_PX = 10;
const TAP_MAX_MS = 900;
/** Idle drift: cruising speed, and how long the world takes to reach it. */
const AMBIENT_DEG_PER_S = 3.2;
const AMBIENT_SPINUP_MS = 2600;
/** Ceiling on the small-frame drift compensation (see `ambientRateScale`). */
const AMBIENT_FRAMED_MAX = 1.6;
/**
 * Drag feel. The globe turns a little faster than the finger (1:1 makes
 * crossing an ocean a chore on a phone), and a released drag keeps gliding
 * for a beat instead of stopping dead. Deliberately understated: the coast
 * is short enough that you still feel you put the world where it is.
 */
const DRAG_GAIN = 1.45;
/** Exponential decay of the coast, 1/s — ~a third of a second of travel. */
const FLING_FRICTION = 7.5;
/** Ceiling on the released velocity, px/s, so a flick can't launch the world. */
const FLING_MAX_PX_S = 1500;
/** Below this the coast is over; anything less reads as drift, not motion. */
const FLING_MIN_PX_S = 14;
/** Release must follow the last movement this closely to count as a throw. */
const FLING_GRACE_MS = 90;
/** Outer zoom-out bound only — view always initialises / resets at k=1 (fitted). */
const MIN_K = 0.675;
/** Breathing room between the fitted map and the edges of its frame, px. */
const FIT_PAD = 8;
/** Chrome may never squeeze the map below this, whatever insets it asks for. */
const MIN_FRAME_PX = 140;
/** Shared radius for miss direction ring + pin-drop sonar expand. */
export const INDICATOR_RING_R = 50;

export class MapEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world: World;
  private cb: MapEngineCallbacks;

  private projType: ProjectionId = "globe";
  private projection: GeoProjection;
  private path: GeoPath;
  private graticule = geoGraticule10();

  private width = 0;
  private height = 0;
  private dpr = 1;
  private baseScale = 100;
  private worldHeightK1 = 0; // projected map height in px at k=1 (flat modes)
  /** Chrome the map keeps clear of, and the ease between two framings. */
  private insets: ViewInsets = { ...NO_INSETS };
  private insetAnim: InsetAnim | null = null;
  /** Sphere bounds at scale 1 for the current projection — keeps refit analytic. */
  private fitUnit: { w: number; h: number } | null = null;

  /** Geographic point at the view center. */
  private center: LonLat = [12, 18];
  private panY = 0; // flat-mode vertical pan, px
  private k = 1; // zoom multiple of the fitted scale

  private interactive = false;
  private ambient = false;
  /** When false (menu), plain wheel scroll belongs to the page, not the zoom. */
  private wheelZoomOn = true;
  /** When the current ambient spell began, for the spin-up ramp. */
  private ambientSince = 0;
  /** The player took the wheel: no more idle drift until ambient restarts. */
  private ambientStopped = false;
  private graticuleOn = true;
  private reduceMotion = false;
  private themeColors: ThemeColors = THEMES.midnightSonar;
  private highContrastOn = false;
  private palette: MapPalette = buildMapPalette(THEMES.midnightSonar, false);
  private confetti: ConfettiSet = buildConfetti(THEMES.midnightSonar);
  private crosshairOn = false;
  private discoveredTint: Set<string> | null = null;
  private pinId: PinId = DEFAULT_PIN_ID;
  private pinDesign: PinDesign = PIN_DESIGNS[DEFAULT_PIN_ID];
  private pinThemed = true;

  private hoverId: number | null = null;
  private selectedId: number | null = null;
  /** Menu mode: hover lights whole continents instead of single countries. */
  private regionPickOn = false;
  private hoverContinent: Region | null = null;
  private pickedContinent: string | null = null;
  private continentIds: Map<string, number[]> | null = null;
  /** Last mouse position, kept so the ambient spin re-hovers under a still cursor. */
  private lastPointerPx: [number, number] | null = null;
  private pins: Pin[] = [];
  private ripples: Ripple[] = [];
  private flashes = new Map<number, Flash>();
  private particles: Particle[] = [];
  private directionHint: DirectionHint | null = null;
  private fly: FlyAnim | null = null;
  private nav = new InteractionController();
  /** Pivot for soft / held keyboard zoom (defaults to view center). */
  private zoomPivot: [number, number] | null = null;

  private pointers = new Map<number, [number, number]>();
  private gestureMoved = 0;
  private gestureStart = 0;
  private pinchPrevDist = 0;
  private wasPinch = false;
  /** A pointer is down and steering the map — hover must not chase the land. */
  private dragging = false;
  /** Smoothed drag velocity in px/s, and the coast it hands over on release. */
  private dragVelX = 0;
  private dragVelY = 0;
  private lastMoveAt = 0;
  private flingX = 0;
  private flingY = 0;
  /** UI scale mirrored from the CSS root font size (see theme.css). */
  private uiScale = 1;

  private raf = 0;
  private lastTime = 0;
  private dirty = true;
  private resizeObs: ResizeObserver;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, world: World, cb: MapEngineCallbacks) {
    this.canvas = canvas;
    this.world = world;
    this.cb = cb;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.projection = this.makeProjection();
    this.path = geoPath(this.projection, this.ctx);

    this.resize();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });

    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    this.destroyed = true;
    this.nav.clear();
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    const c = this.canvas;
    c.removeEventListener("pointerdown", this.onPointerDown);
    c.removeEventListener("pointermove", this.onPointerMove);
    c.removeEventListener("pointerup", this.onPointerUp);
    c.removeEventListener("pointercancel", this.onPointerCancel);
    c.removeEventListener("pointerleave", this.onPointerLeave);
    c.removeEventListener("wheel", this.onWheel);
  }

  // ------------------------------------------------------------------
  // projection + view
  // ------------------------------------------------------------------

  private makeProjection(): GeoProjection {
    const p =
      this.projType === "globe"
        ? geoOrthographic()
        : this.projType === "naturalEarth"
          ? geoNaturalEarth1()
          : this.projType === "equalEarth"
            ? geoEqualEarth()
            : geoMercator();
    p.precision(0.5);
    return p;
  }

  /**
   * Sphere bounds at scale 1, measured once per projection. Fitting is then
   * pure arithmetic, which matters because an inset ease re-fits every frame
   * (a `fitExtent` per frame would re-walk the sphere outline each time).
   */
  private measureFitUnit(): { w: number; h: number } {
    const p = this.makeProjection();
    const s = 1000; // measure big: adaptive resampling is sloppy at scale 1
    p.scale(s).translate([0, 0]).rotate([0, 0, 0]);
    const b = geoPath(p).bounds({ type: "Sphere" });
    return { w: (b[1][0] - b[0][0]) / s, h: (b[1][1] - b[0][1]) / s };
  }

  /**
   * The rect the map lives in: the canvas minus its insets, as
   * `[x0, y0, width, height]`. Insets are clamped so no amount of chrome can
   * squeeze the map away entirely.
   */
  private frameRect(): [number, number, number, number] {
    const { width: w, height: h } = this;
    const i = this.insets;
    const minW = Math.min(MIN_FRAME_PX, w);
    const minH = Math.min(MIN_FRAME_PX, h);
    const sx = i.left + i.right > w - minW ? Math.max(0, w - minW) / (i.left + i.right) : 1;
    const sy = i.top + i.bottom > h - minH ? Math.max(0, h - minH) / (i.top + i.bottom) : 1;
    const left = i.left * sx;
    const top = i.top * sy;
    return [left, top, w - left - i.right * sx, h - top - i.bottom * sy];
  }

  /** Where the map is centered on screen — the middle of the frame, not the canvas. */
  private viewCenter(): [number, number] {
    const [x, y, w, h] = this.frameRect();
    return [x + w / 2, y + h / 2];
  }

  /** The k=1 scale that fits the world into a viewport of this size. */
  private fitScale(w: number, h: number): number {
    const iw = Math.max(1, w - FIT_PAD * 2);
    const ih = Math.max(1, h - FIT_PAD * 2);
    // Mercator's sphere is unbounded, so its ±84° band is fitted by hand.
    if (this.projType === "mercator") {
      return Math.min(iw / (2 * Math.PI), ih / (2 * MERCATOR_Y_MAX));
    }
    if (!this.fitUnit) this.fitUnit = this.measureFitUnit();
    return Math.max(1, Math.min(iw / this.fitUnit.w, ih / this.fitUnit.h));
  }

  private refit(): void {
    if (this.width === 0 || this.height === 0) return;
    const [, , fw, fh] = this.frameRect();
    this.baseScale = this.fitScale(fw, fh);
    if (this.projType === "mercator") {
      this.worldHeightK1 = 2 * MERCATOR_Y_MAX * this.baseScale;
    } else if (this.projType !== "globe") {
      this.worldHeightK1 = (this.fitUnit?.h ?? 0) * this.baseScale;
    }
    this.apply();
  }

  private apply(): void {
    const p = this.projection;
    const [fx, fy, fw, fh] = this.frameRect();
    const [cx, cy] = [fx + fw / 2, fy + fh / 2];
    p.scale(this.baseScale * this.k);
    if (this.projType === "globe") {
      p.rotate([-this.center[0], -this.center[1], 0]);
      p.translate([cx, cy]);
    } else {
      this.clampPanY();
      p.rotate([-this.center[0], 0, 0]);
      p.translate([cx, cy + this.panY]);
      // Flat maps are clipped to their frame, so a framed map stays inside it
      // rather than bleeding under the chrome it was asked to avoid.
      p.clipExtent([
        [fx, fy],
        [fx + fw, fy + fh],
      ]);
    }
    this.path = geoPath(p, this.ctx);
    this.dirty = true;
    // Keep the crosshair country lit the same way mouse hover does.
    if (this.crosshairOn && this.interactive) this.hoverAt([cx, cy]);
    // Ambient spin drifts land under a resting cursor; keep the lit continent
    // honest. Not while the player is steering, though: re-testing a stale
    // cursor point against fast-moving land lights continents nowhere near
    // the pointer and flickers between them. A drag moves the world, it
    // doesn't pick one.
    else if (
      this.regionPickOn &&
      this.interactive &&
      this.lastPointerPx &&
      !this.dragging &&
      !this.coasting
    )
      this.hoverAt(this.lastPointerPx);
  }

  private clampPanY(): void {
    const fh = this.frameRect()[3];
    const allowed = Math.max(0, (this.worldHeightK1 * this.k) / 2 - fh / 2 + 32);
    this.panY = Math.max(-allowed, Math.min(allowed, this.panY));
  }

  /**
   * The chrome's scale, read straight off the CSS root font size (theme.css
   * grows it with the viewport). Pins, rings and the crosshair are the map's
   * share of that system — on a desktop they'd otherwise stay phone-sized
   * next to buttons and type that grew.
   */
  private readUiScale(): void {
    const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
    this.uiScale = Number.isFinite(px) ? Math.max(1, Math.min(1.35, px / 16)) : 1;
  }

  /** Radius of the pin indicator ring in px, at the current UI scale. */
  ringRadius(): number {
    return INDICATOR_RING_R * this.uiScale;
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.readUiScale();
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.projection = this.makeProjection();
    this.refit();
  }

  setProjection(type: ProjectionId): void {
    if (type === this.projType) return;
    this.projType = type;
    this.panY = 0;
    this.fitUnit = null;
    this.projection = this.makeProjection();
    this.refit();
  }

  /**
   * Frame the map inside a sub-rect of the canvas, easing there over `dur` ms.
   * Omitted edges mean zero, so `setViewInsets({})` hands the map the whole
   * screen back. The ease re-fits every frame, so the map grows and re-centers
   * together — the "pan in" when a round starts is this plus a zoom.
   */
  setViewInsets(next: Partial<ViewInsets>, dur = 0): void {
    const to: ViewInsets = { ...NO_INSETS, ...next };
    if (insetsEqual(to, this.insetAnim?.to ?? this.insets)) return;
    if (dur <= 0 || this.reduceMotion) {
      this.insetAnim = null;
      this.insets = to;
      this.refit();
      return;
    }
    this.insetAnim = { from: { ...this.insets }, to, born: performance.now(), dur };
  }

  setInteractive(on: boolean): void {
    this.interactive = on;
    if (!on) this.setHover(null);
    else if (this.crosshairOn) this.hoverAt(this.viewCenter());
    this.canvas.style.cursor = on ? "grab" : "default";
  }

  /**
   * Whether a plain wheel scroll zooms the world. The menu hands the wheel
   * back to the page — scrolling there travels down to the site footer — while
   * a ctrl-wheel (trackpad pinch) always reads as deliberate zoom intent.
   */
  setWheelZoom(on: boolean): void {
    this.wheelZoomOn = on;
  }

  /**
   * Drift is felt as pixels travelling at the limb, not degrees per second: the
   * same spin on a globe the menu has framed small reads as slower, and on a
   * desktop the framing takes nearly 40% of it. Hand that back, capped, so the
   * idle rotation stays as legible as it was when the globe was full-bleed.
   */
  private ambientRateScale(): number {
    const unframed = this.fitScale(this.width, this.height);
    if (this.baseScale <= 0) return 1;
    return Math.max(1, Math.min(AMBIENT_FRAMED_MAX, unframed / this.baseScale));
  }

  /**
   * Idle drift. Each spell starts from a standstill and winds up to speed,
   * and the first touch of the controls ends it for good — a globe that
   * kept creeping back into motion under your hands would feel possessed.
   */
  setAmbient(on: boolean): void {
    if (on === this.ambient) return;
    this.ambient = on;
    this.ambientSince = performance.now();
    this.ambientStopped = false;
    this.dirty = true;
  }

  setGraticule(on: boolean): void {
    this.graticuleOn = on;
    this.dirty = true;
  }

  setHighContrast(on: boolean): void {
    this.highContrastOn = on;
    this.refreshPalette();
  }

  /** Swap the world's colours; the canvas recolours on the next frame. */
  setTheme(colors: ThemeColors): void {
    this.themeColors = colors;
    this.refreshPalette();
  }

  private refreshPalette(): void {
    this.palette = buildMapPalette(this.themeColors, this.highContrastOn);
    this.confetti = buildConfetti(this.themeColors);
    this.dirty = true;
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on;
    this.dirty = true;
  }

  setCrosshair(on: boolean): void {
    this.crosshairOn = on;
    this.dirty = true;
    if (on && this.interactive) this.hoverAt(this.viewCenter());
    else if (!on) this.setHover(null);
  }

  setSelected(id: number | null): void {
    this.selectedId = id;
    this.dirty = true;
  }

  /** Menu mode: hovering lights a whole continent; taps pick play regions. */
  setRegionPick(on: boolean): void {
    if (on === this.regionPickOn) return;
    this.regionPickOn = on;
    if (this.hoverContinent !== null) {
      this.hoverContinent = null;
      this.cb.onRegionHover?.(null);
    }
    if (!on) this.lastPointerPx = null;
    this.dirty = true;
  }

  /** Persistent tint for the continent the player has picked (null = World). */
  setPickedContinent(continent: string | null): void {
    if (continent === this.pickedContinent) return;
    this.pickedContinent = continent;
    this.dirty = true;
  }

  private idsForContinent(continent: string): number[] {
    if (!this.continentIds) {
      this.continentIds = new Map();
      for (const c of this.world.countries) {
        const list = this.continentIds.get(c.props.continent);
        if (list) list.push(c.id);
        else this.continentIds.set(c.props.continent, [c.id]);
      }
    }
    return this.continentIds.get(continent) ?? [];
  }

  /** In explore mode, tint the player's discovered countries. */
  setDiscoveredTint(isoSet: Set<string> | null): void {
    this.discoveredTint = isoSet;
    this.dirty = true;
  }

  resetView(center: LonLat = [12, 18]): void {
    this.center = [...center];
    this.k = 1;
    this.panY = 0;
    this.fly = null;
    this.stopFling();
    this.apply();
  }

  zoomBy(factor: number, about?: [number, number]): void {
    const maxK = this.projType === "globe" ? 14 : 18;
    const pivot = about ?? this.viewCenter();
    if (this.reduceMotion) {
      this.zoomAbout(factor, pivot);
      this.stopAmbient();
      return;
    }
    // Soft target so keyboard / HUD +/- ease instead of jumping.
    this.zoomPivot = pivot;
    this.nav.requestZoom(factor, this.k, MIN_K, maxK);
    this.fly = null;
    this.stopAmbient();
  }

  /**
   * Continuous keyboard navigation via the interaction controller.
   * Hold arrows to glide; release to coast. Discrete `nudge` is kept for
   * one-shot callers / tests.
   */
  setNavKey(dir: ArrowDir, pressed: boolean): void {
    this.nav.setKey(dir, pressed);
    if (pressed) {
      this.fly = null;
      this.stopAmbient();
    }
  }

  setZoomKey(dir: ZoomDir, pressed: boolean): void {
    this.nav.setZoomKey(dir, pressed);
    if (pressed) {
      this.zoomPivot = this.viewCenter();
      this.fly = null;
      this.stopAmbient();
    }
  }

  clearNavKeys(): void {
    this.nav.clear();
  }

  /** Keyboard navigation: move the view by a fraction of the viewport. */
  nudge(dxSign: number, dySign: number): void {
    this.applyNavDelta(
      dxSign * Math.min(this.width, this.height) * 0.12,
      dySign * Math.min(this.width, this.height) * 0.12
    );
  }

  /** Apply a screen-space pan in the nudge convention (+x right, +y down). */
  private applyNavDelta(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.stopFling();
    this.notifyInteract();
    const degPerPx = 180 / Math.PI / (this.baseScale * this.k * X_FACTOR[this.projType]);
    this.center[0] += dx * degPerPx;
    if (this.projType === "globe") {
      this.center[1] = clampLat(this.center[1] - dy * degPerPx);
    } else {
      this.panY -= dy;
    }
    this.fly = null;
    this.stopAmbient();
    this.apply();
  }

  /** Current zoom, as a multiple of the fitted scale (1 = whole world). */
  zoomLevel(): number {
    return this.k;
  }

  centerLonLat(): LonLat | null {
    return this.invert(this.viewCenter());
  }

  screenOf(lonlat: LonLat): [number, number] | null {
    if (!this.isVisible(lonlat)) return null;
    const p = this.projection(lonlat);
    return p ? [p[0], p[1]] : null;
  }

  flyTo(target: LonLat, opts: { zoom?: number; dur?: number } = {}): void {
    this.nav.clear();
    this.stopFling();
    const dur = opts.dur ?? 900;
    const k1 = opts.zoom ?? this.k;
    if (this.reduceMotion || dur <= 0) {
      this.center = [...target];
      this.k = k1;
      if (this.projType !== "globe") this.centerFlatOn(target);
      this.apply();
      return;
    }
    this.fly = {
      born: performance.now(),
      dur,
      interp: geoInterpolate(this.center, target),
      k0: this.k,
      k1,
    };
  }

  /**
   * Ease the zoom to an absolute level, leaving the centre where it is —
   * the "close in a little" half of starting a round.
   */
  zoomTo(k: number, dur = 900): void {
    const maxK = this.projType === "globe" ? 14 : 18;
    const k1 = Math.max(MIN_K, Math.min(maxK, k));
    const here = this.centerLonLat();
    if (!here) {
      this.k = k1;
      this.apply();
      return;
    }
    this.flyTo(here, { zoom: k1, dur });
  }

  /** For flat maps, also move the vertical pan so the target row is centered. */
  private centerFlatOn(target: LonLat): void {
    this.apply();
    const p = this.projection([target[0], target[1]]);
    if (p) {
      this.panY += this.viewCenter()[1] - p[1];
      this.apply();
    }
  }

  private invert(px: [number, number]): LonLat | null {
    const inv = this.projection.invert?.(px);
    if (!inv || !isFinite(inv[0]) || !isFinite(inv[1])) return null;
    // Reject points off the globe's disc / outside the flat map.
    const round = this.projection(inv);
    if (!round) return null;
    const err = Math.hypot(round[0] - px[0], round[1] - px[1]);
    if (err > 0.5) return null;
    return [inv[0], inv[1]];
  }

  private isVisible(lonlat: LonLat): boolean {
    if (this.projType !== "globe") return true;
    return geoDistance(lonlat, this.center) < Math.PI / 2 - 0.01;
  }

  private zoomAbout(factor: number, px: [number, number]): void {
    this.notifyInteract();
    const before = this.invert(px);
    const maxK = this.projType === "globe" ? 14 : 18;
    this.k = Math.max(MIN_K, Math.min(maxK, this.k * factor));
    this.apply();
    if (!before) return;
    const after = this.invert(px);
    if (!after) return;
    this.center[0] += lonDelta(after[0], before[0]);
    if (this.projType === "globe") {
      this.center[1] = clampLat(this.center[1] + (before[1] - after[1]));
    } else {
      this.apply();
      const proj = this.projection(before);
      if (proj) this.panY += px[1] - proj[1];
    }
    this.apply();
  }

  private notifyInteract(): void {
    this.cb.onInteract?.();
  }

  // ------------------------------------------------------------------
  // effects
  // ------------------------------------------------------------------

  addPin(lonlat: LonLat, kind: "correct" | "miss", lines?: string[]): void {
    // Keep historical miss captions as distance-only; tries-left belongs on the latest pin.
    if (lines?.length) {
      for (const pin of this.pins) {
        if (pin.lines && pin.lines.length > 1) pin.lines = [pin.lines[0]];
      }
    }
    this.pins.push({
      lonlat,
      kind,
      born: performance.now(),
      lines: lines?.length ? lines : undefined,
    });
    this.dirty = true;
  }

  /** Swap the pin design; themed pins take the world's success/danger colours. */
  setPinStyle(id: PinId, themed: boolean): void {
    this.pinId = PIN_DESIGNS[id] ? id : DEFAULT_PIN_ID;
    this.pinDesign = PIN_DESIGNS[this.pinId];
    this.pinThemed = themed;
    this.dirty = true;
  }

  clearPins(): void {
    this.pins = [];
    this.directionHint = null;
    this.dirty = true;
  }

  /** Captions for DOM overlays (tide-gradient type, not canvas ink). */
  pinCaptions(): { lonlat: LonLat; lines: string[]; born: number }[] {
    const out: { lonlat: LonLat; lines: string[]; born: number }[] = [];
    for (const pin of this.pins) {
      if (!pin.lines?.length) continue;
      out.push({ lonlat: pin.lonlat, lines: pin.lines, born: pin.born });
    }
    return out;
  }

  /**
   * Thin ring around a miss pin with a glowing arc in one of eight compass
   * directions. Discrete winds only — never aims exactly at the target.
   */
  showDirectionHint(lonlat: LonLat, direction: CompassKey): void {
    this.directionHint = {
      lonlat: [...lonlat],
      bearingDeg: COMPASS_BEARING[direction],
      born: performance.now(),
    };
    this.dirty = true;
  }

  clearDirectionHint(): void {
    if (!this.directionHint) return;
    this.directionHint = null;
    this.dirty = true;
  }

  ripple(lonlat: LonLat, kind: "correct" | "miss" | "gold" | "neutral"): void {
    const color =
      kind === "correct"
        ? this.palette.correct
        : kind === "miss"
          ? this.palette.miss
          : kind === "gold"
            ? this.palette.discovery
            : this.palette.reveal;
    this.ripples.push({
      lonlat,
      color,
      born: performance.now(),
      dur: this.reduceMotion ? 400 : 900,
    });
    this.dirty = true;
  }

  flash(id: number, kind: "correct" | "reveal" | "hint" | "gold", dur = 1800): void {
    const color =
      kind === "correct"
        ? this.palette.correct
        : kind === "gold"
          ? this.palette.discovery
          : this.palette.reveal;
    this.flashes.set(id, { color, born: performance.now(), dur, fill: kind !== "hint" });
    this.dirty = true;
  }

  clearFlashes(): void {
    this.flashes.clear();
    this.dirty = true;
  }

  confettiBurst(at?: [number, number], kind: ConfettiKind = "milestone"): void {
    if (this.reduceMotion) return;
    const [cx, cy] = at ?? this.viewCenter();
    const now = performance.now();

    if (kind === "discovery") {
      // Gold fanfare: dense burst + lingering sparkle halo
      this.spawnParticles(cx, cy, now, {
        count: 58,
        colors: this.confetti.discovery,
        speedMin: 2.4,
        speedMax: 8.2,
        lift: 4.2,
        durMin: 1400,
        durMax: 2400,
        sizeMin: 2.4,
        sizeMax: 6.2,
        shapes: ["rect", "spark", "spark", "dot"],
        gravity: 0.11,
        drag: 0.988,
      });
      this.spawnParticles(cx, cy, now + 40, {
        count: 22,
        colors: this.confetti.discovery,
        speedMin: 0.6,
        speedMax: 3.2,
        lift: 1.4,
        durMin: 1600,
        durMax: 2800,
        sizeMin: 1.6,
        sizeMax: 3.8,
        shapes: ["spark", "dot"],
        gravity: 0.04,
        drag: 0.994,
      });
    } else if (kind === "correct") {
      // Ocean splash — greens/blues/seafoam, still under a discovery
      this.spawnParticles(cx, cy, now, {
        count: 36,
        colors: this.confetti.correct,
        speedMin: 1.6,
        speedMax: 5.6,
        lift: 3.2,
        durMin: 1000,
        durMax: 1700,
        sizeMin: 2,
        sizeMax: 4.8,
        shapes: ["dot", "spark", "rect", "dot", "spark"],
        gravity: 0.085,
        drag: 0.989,
      });
    } else {
      this.spawnParticles(cx, cy, now, {
        count: 42,
        colors: this.confetti.milestone,
        speedMin: 2,
        speedMax: 5.5,
        lift: 3,
        durMin: 1200,
        durMax: 1900,
        sizeMin: 2.2,
        sizeMax: 5,
        shapes: ["rect", "spark", "dot"],
        gravity: 0.12,
        drag: 0.988,
      });
    }
    this.dirty = true;
  }

  private spawnParticles(
    cx: number,
    cy: number,
    now: number,
    opts: {
      count: number;
      colors: readonly string[];
      speedMin: number;
      speedMax: number;
      lift: number;
      durMin: number;
      durMax: number;
      sizeMin: number;
      sizeMax: number;
      shapes: Array<Particle["shape"]>;
      gravity: number;
      drag: number;
    }
  ): void {
    for (let i = 0; i < opts.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = opts.speedMin + Math.random() * (opts.speedMax - opts.speedMin);
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 6,
        y: cy + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - opts.lift,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.45,
        color: opts.colors[i % opts.colors.length],
        born: now,
        dur: opts.durMin + Math.random() * (opts.durMax - opts.durMin),
        size: opts.sizeMin + Math.random() * (opts.sizeMax - opts.sizeMin),
        shape: opts.shapes[i % opts.shapes.length],
        gravity: opts.gravity,
        drag: opts.drag,
      });
    }
  }

  // ------------------------------------------------------------------
  // input
  // ------------------------------------------------------------------

  private stopAmbient(): void {
    this.ambientStopped = true;
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    this.dragging = true;
    this.stopFling();
    if (this.pointers.size === 1) {
      this.gestureMoved = 0;
      this.gestureStart = performance.now();
      this.lastMoveAt = this.gestureStart;
      this.dragVelX = 0;
      this.dragVelY = 0;
      this.wasPinch = false;
      this.canvas.style.cursor = "grabbing";
    } else if (this.pointers.size === 2) {
      this.wasPinch = true;
      const [a, b] = [...this.pointers.values()];
      this.pinchPrevDist = Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    this.stopAmbient();
  };

  private onPointerMove = (e: PointerEvent): void => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) {
      // Crosshair owns hover while keyboard aiming; don't fight it with the mouse.
      if (this.interactive && !this.crosshairOn) {
        if (this.regionPickOn) this.lastPointerPx = [e.offsetX, e.offsetY];
        this.hoverAt([e.offsetX, e.offsetY]);
      }
      return;
    }
    const cur: [number, number] = [e.offsetX, e.offsetY];
    this.pointers.set(e.pointerId, cur);

    if (this.pointers.size === 2) {
      this.nav.clearZoom();
      this.zoomPivot = null;
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (this.pinchPrevDist > 0) this.zoomAbout(dist / this.pinchPrevDist, mid);
      this.pinchPrevDist = dist;
      this.gestureMoved = Infinity;
      return;
    }

    const dx = cur[0] - prev[0];
    const dy = cur[1] - prev[1];
    this.gestureMoved += Math.abs(dx) + Math.abs(dy);

    // Smoothed velocity, so one jittery frame can't decide the coast.
    const now = performance.now();
    const dt = Math.max(8, now - this.lastMoveAt);
    this.lastMoveAt = now;
    this.dragVelX = this.dragVelX * 0.6 + ((dx / dt) * 1000) * 0.4;
    this.dragVelY = this.dragVelY * 0.6 + ((dy / dt) * 1000) * 0.4;

    this.drag(dx, dy);
  };

  private drag(dx: number, dy: number): void {
    // Pointer drag wins over keyboard coast so the two don't fight.
    this.nav.clear();
    this.panByPx(dx, dy);
  }

  /**
   * Move the view by a screen-space drag delta (finger convention: the land
   * follows the finger). DRAG_GAIN lets the globe turn faster than the hand;
   * flat maps stay 1:1, where a map that outruns your finger reads as a bug.
   */
  private panByPx(dx: number, dy: number): void {
    this.notifyInteract();
    const scale = this.baseScale * this.k;
    const gain = this.projType === "globe" ? DRAG_GAIN : 1;
    const degPerPx = 180 / Math.PI / (scale * X_FACTOR[this.projType]);
    this.center[0] -= dx * degPerPx * gain;
    if (this.projType === "globe") {
      this.center[1] = clampLat(this.center[1] + dy * (180 / Math.PI / scale) * gain);
    } else {
      this.panY += dy;
    }
    this.fly = null;
    this.stopAmbient();
    this.apply();
  }

  private get coasting(): boolean {
    return this.flingX !== 0 || this.flingY !== 0;
  }

  private stopFling(): void {
    this.flingX = 0;
    this.flingY = 0;
  }

  /** Hand the drag's last velocity to the coast, if the release earned one. */
  private startFling(): void {
    if (this.reduceMotion) return;
    if (performance.now() - this.lastMoveAt > FLING_GRACE_MS) return;
    const speed = Math.hypot(this.dragVelX, this.dragVelY);
    if (speed < FLING_MIN_PX_S * 4) return;
    const cap = Math.min(1, FLING_MAX_PX_S / speed);
    this.flingX = this.dragVelX * cap;
    this.flingY = this.dragVelY * cap;
  }

  private onPointerUp = (e: PointerEvent): void => {
    const had = this.pointers.delete(e.pointerId);
    this.canvas.style.cursor = this.interactive ? "grab" : "default";
    if (!had) return;
    if (this.pointers.size === 0) this.dragging = false;
    const quick = performance.now() - this.gestureStart < TAP_MAX_MS;
    const isTap =
      !this.wasPinch && this.pointers.size === 0 && this.gestureMoved < TAP_SLOP_PX && quick;

    if (this.interactive && isTap) {
      const px: [number, number] = [e.offsetX, e.offsetY];
      const lonlat = this.invert(px);
      if (lonlat) this.cb.onTap(lonlat, px);
      else this.cb.onVoidTap?.();
      return;
    }

    if (this.pointers.size === 0 && !this.wasPinch && this.interactive) {
      this.startFling();
      // The cursor sat still while the world moved under it — re-read what
      // it's actually over now that the gesture is done.
      if (e.pointerType === "mouse" && !this.crosshairOn && !this.coasting) {
        this.lastPointerPx = [e.offsetX, e.offsetY];
        this.hoverAt([e.offsetX, e.offsetY]);
      }
    }
  };

  private onPointerCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) this.dragging = false;
  };

  private onPointerLeave = (): void => {
    this.lastPointerPx = null;
    if (this.crosshairOn) return;
    this.setHover(null);
  };

  private onWheel = (e: WheelEvent): void => {
    // Menu mode: don't touch the event — the browser scrolls the page instead.
    if (!this.wheelZoomOn && !e.ctrlKey) return;
    e.preventDefault();
    // Direct wheel input cancels eased keyboard zoom so they don't fight.
    this.nav.clearZoom();
    this.zoomPivot = null;
    const factor = Math.exp(-e.deltaY * 0.0022);
    this.zoomAbout(factor, [e.offsetX, e.offsetY]);
    this.stopAmbient();
  };

  private hoverAt(px: [number, number]): void {
    const lonlat = this.invert(px);
    const c = lonlat ? hitTest(this.world, lonlat) : null;
    this.setHover(c ? c.id : null, c);
  }

  private setHover(id: number | null, country?: Country | null): void {
    const continent =
      this.regionPickOn && country ? continentRegion(country.props.continent) : null;
    if (id === this.hoverId && continent === this.hoverContinent) return;
    const continentChanged = continent !== this.hoverContinent;
    this.hoverId = id;
    this.hoverContinent = continent;
    this.dirty = true;
    if (this.interactive) {
      const target = this.regionPickOn ? continent !== null : id !== null;
      this.canvas.style.cursor = target ? "pointer" : "grab";
    }
    this.cb.onHover?.(country ?? null);
    if (continentChanged) this.cb.onRegionHover?.(continent);
  }

  // ------------------------------------------------------------------
  // render loop
  // ------------------------------------------------------------------

  private hasActiveEffects(now: number): boolean {
    if (this.fly || this.insetAnim) return true;
    if (this.nav.active) return true;
    if (this.coasting) return true;
    if (this.ripples.length || this.particles.length || this.flashes.size) return true;
    if (this.pins.some((p) => now - p.born < 500)) return true;
    if (this.directionHint && !this.reduceMotion) return true;
    return false;
  }

  private frame = (now: number): void => {
    if (this.destroyed) return;
    const dt = Math.min(64, now - this.lastTime);
    this.lastTime = now;

    // Re-framing runs first: it changes the fitted scale, so anything below
    // that reads the camera this frame reads the new frame's numbers.
    if (this.insetAnim) {
      const a = this.insetAnim;
      const t = Math.min(1, (now - a.born) / a.dur);
      this.insets = lerpInsets(a.from, a.to, easeInOut(t));
      if (t >= 1) {
        this.insets = { ...a.to };
        this.insetAnim = null;
      }
      this.refit();
    }

    if (this.fly) {
      const t = Math.min(1, (now - this.fly.born) / this.fly.dur);
      const e = easeInOut(t);
      this.center = this.fly.interp(e) as LonLat;
      this.k = this.fly.k0 + (this.fly.k1 - this.fly.k0) * e;
      if (t >= 1) this.fly = null;
      // Flat projections ignore center latitude; follow it with vertical pan.
      if (this.projType !== "globe") this.centerFlatOn(this.center);
      else this.apply();
    } else {
      const motion = this.nav.tick(dt, this.reduceMotion, this.k);
      if (motion) {
        if (motion.zoom !== 1) {
          const pivot =
            this.zoomPivot ?? this.viewCenter();
          this.zoomAbout(motion.zoom, pivot);
        }
        if (motion.dx !== 0 || motion.dy !== 0) {
          this.applyNavDelta(motion.dx, motion.dy);
        }
      } else {
        this.zoomPivot = null;
      }
    }

    // Released drag keeps gliding, then settles. Anything that takes the
    // wheel — a new touch, a flight, the keyboard — ends the coast outright.
    if (this.coasting) {
      if (this.dragging || this.fly || this.nav.active) {
        this.stopFling();
      } else {
        const dts = dt / 1000;
        this.panByPx(this.flingX * dts, this.flingY * dts);
        const decay = Math.exp(-FLING_FRICTION * dts);
        this.flingX *= decay;
        this.flingY *= decay;
        if (Math.hypot(this.flingX, this.flingY) < FLING_MIN_PX_S) {
          this.stopFling();
          // Land the hover on whatever finally came to rest under the cursor.
          if (this.regionPickOn && this.interactive && this.lastPointerPx) {
            this.hoverAt(this.lastPointerPx);
          }
        }
      }
    }

    const spinning =
      this.ambient &&
      !this.reduceMotion &&
      !this.ambientStopped &&
      !this.fly &&
      !this.nav.active;
    if (spinning) {
      // Wind up from a standstill on a smoothstep, so the world leans into
      // its turn instead of snapping to full speed the moment you arrive.
      const t = Math.min(1, (now - this.ambientSince) / AMBIENT_SPINUP_MS);
      const speed = AMBIENT_DEG_PER_S * t * t * (3 - 2 * t) * this.ambientRateScale();
      this.center[0] += (dt / 1000) * speed;
      this.apply();
    }

    if (this.dirty || this.hasActiveEffects(now)) {
      this.draw(now);
      this.dirty = false;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(now: number): void {
    const { ctx, palette: pal, width: w, height: h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // ocean
    if (this.projType === "globe") {
      const [cx, cy] = this.viewCenter();
      const r = this.baseScale * this.k;
      // atmosphere glow — faint and wide so it reads as air, not a rim light
      const glow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.22);
      glow.addColorStop(0, withAlpha(pal.atmosphere, 0));
      glow.addColorStop(0.3, withAlpha(pal.atmosphere, 0.085));
      glow.addColorStop(0.55, withAlpha(pal.atmosphere, 0.05));
      glow.addColorStop(1, withAlpha(pal.atmosphere, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.24, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
      grad.addColorStop(0, pal.oceanCenter);
      grad.addColorStop(1, pal.ocean);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.projType === "mercator") {
      // Mercator's sphere is unbounded, so its ocean is the frame itself.
      const [fx, fy, fw, fh] = this.frameRect();
      ctx.fillStyle = pal.ocean;
      ctx.fillRect(fx, fy, fw, fh);
    } else {
      ctx.fillStyle = pal.ocean;
      ctx.beginPath();
      this.path({ type: "Sphere" });
      ctx.fill();
      ctx.strokeStyle = this.palette.atmosphere;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // graticule
    if (this.graticuleOn) {
      ctx.beginPath();
      this.path(this.graticule);
      ctx.strokeStyle = pal.graticule;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // land (single batched fill + stroke)
    ctx.beginPath();
    for (const c of this.world.countries) this.path(c.feature as GeoJSON.Feature);
    ctx.fillStyle = pal.land;
    ctx.fill();
    // Two-pass border: a wide faint halo under a firmer line keeps the
    // hand-drawn softness while making every border legible at a glance.
    const borderW = Math.min(1.9, 1.05 + this.k * 0.06);
    ctx.strokeStyle = withAlpha(pal.landBorder, 0.22);
    ctx.lineWidth = borderW + 1.3;
    ctx.stroke();
    ctx.strokeStyle = pal.landBorder;
    ctx.lineWidth = borderW;
    ctx.stroke();

    // discovered tint (explore mode)
    if (this.discoveredTint) {
      ctx.beginPath();
      for (const c of this.world.countries) {
        if (c.props.iso && this.discoveredTint.has(c.props.iso)) {
          this.path(c.feature as GeoJSON.Feature);
        }
      }
      ctx.fillStyle = pal.discoveredFill;
      ctx.fill();
    }

    // Menu region pick. Considering a continent and having chosen one look the
    // same — one light, so the map doesn't change under you when the cursor
    // leaves. The commitment reads through a rim drawn round the chosen one.
    if (this.regionPickOn) {
      const lit = new Set<string>();
      if (this.pickedContinent) lit.add(this.pickedContinent);
      if (this.hoverContinent) lit.add(this.hoverContinent);
      if (lit.size) {
        ctx.beginPath();
        for (const cont of lit)
          for (const id of this.idsForContinent(cont))
            this.path(this.world.countries[id].feature as GeoJSON.Feature);
        ctx.fillStyle = pal.landHover;
        ctx.fill();
      }
      if (this.pickedContinent) {
        ctx.beginPath();
        for (const id of this.idsForContinent(this.pickedContinent))
          this.path(this.world.countries[id].feature as GeoJSON.Feature);
        ctx.strokeStyle = withAlpha(pal.correct, 0.8);
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    // hover + selected
    if (this.hoverId !== null && !this.regionPickOn) {
      const c = this.world.countries[this.hoverId];
      ctx.beginPath();
      this.path(c.feature as GeoJSON.Feature);
      ctx.fillStyle = pal.landHover;
      ctx.fill();
    }
    if (this.selectedId !== null) {
      const c = this.world.countries[this.selectedId];
      ctx.beginPath();
      this.path(c.feature as GeoJSON.Feature);
      ctx.fillStyle = pal.landSelected;
      ctx.fill();
      ctx.strokeStyle = pal.correct;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // country flashes (correct / reveal pulses)
    for (const [id, f] of this.flashes) {
      const age = (now - f.born) / f.dur;
      if (age >= 1) {
        this.flashes.delete(id);
        continue;
      }
      const c = this.world.countries[id];
      // Persistent reveals (infinite dur) pulse on wall-clock time so the glow stays alive.
      const pulsePhase = Number.isFinite(f.dur) ? age * Math.PI * 6 : ((now - f.born) / 1000) * Math.PI * 2;
      const pulse = this.reduceMotion ? 0.55 : 0.45 + 0.3 * Math.sin(pulsePhase);
      const fade = Number.isFinite(f.dur) ? 1 - age * 0.5 : 1;
      ctx.beginPath();
      this.path(c.feature as GeoJSON.Feature);
      if (f.fill) {
        ctx.fillStyle = withAlpha(f.color, pulse * fade);
        ctx.fill();
      }
      ctx.strokeStyle = withAlpha(f.color, Math.min(1, pulse + 0.35));
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // sonar ripples — expand only as far as the indicator ring
    this.ripples = this.ripples.filter((r) => now - r.born < r.dur);
    for (const r of this.ripples) {
      if (!this.isVisible(r.lonlat)) continue;
      const p = this.projection(r.lonlat);
      if (!p) continue;
      const age = (now - r.born) / r.dur;
      const ringR = this.ringRadius();
      const breath = this.reduceMotion ? 1 : 0.92 + 0.08 * Math.sin(age * Math.PI * 3.2);

      // soft wash that blooms then clears inside the ring
      if (!this.reduceMotion && age < 0.72) {
        const washT = easeOut(age / 0.72);
        const washR = Math.max(0.5, washT * ringR * breath);
        const wash = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], washR);
        wash.addColorStop(0, withAlpha(r.color, (1 - washT) * 0.22));
        wash.addColorStop(0.55, withAlpha(r.color, (1 - washT) * 0.1));
        wash.addColorStop(1, withAlpha(r.color, 0));
        ctx.beginPath();
        ctx.arc(p[0], p[1], washR, 0, Math.PI * 2);
        ctx.fillStyle = wash;
        ctx.fill();
      }

      for (let ring = 0; ring < 3; ring++) {
        const ringAge = age - ring * 0.16;
        if (ringAge < 0 || ringAge > 1) continue;
        // Ease out fast, then settle at the indicator ring edge
        const expand = 1 - (1 - ringAge) ** 2.6;
        const radius = Math.max(0.5, expand * ringR);
        const fade = (1 - ringAge) ** 1.15;
        const alpha = fade * (0.42 - ring * 0.08) * breath;
        ctx.beginPath();
        ctx.arc(p[0], p[1], radius, 0, Math.PI * 2);
        ctx.strokeStyle = withAlpha(r.color, alpha);
        ctx.lineWidth = (2.4 - ring * 0.55) * (0.85 + 0.15 * (1 - expand));
        ctx.stroke();
      }
    }

    // direction hint ring (under pins so the pin sits in the ring's center)
    if (this.directionHint) {
      this.drawDirectionHint(this.directionHint, now);
    }

    // pins
    for (const pin of this.pins) {
      if (!this.isVisible(pin.lonlat)) continue;
      const p = this.projection(pin.lonlat);
      if (!p) continue;
      const age = Math.min(1, (now - pin.born) / 350);
      const s = this.reduceMotion ? 1 : easeOutBack(age);
      this.drawPin(p[0], p[1], s, pin.kind);
    }

    // confetti
    if (this.particles.length) {
      const alive: Particle[] = [];
      for (const pt of this.particles) {
        const age = (now - pt.born) / pt.dur;
        if (age < 0) {
          alive.push(pt);
          continue;
        }
        if (age >= 1) continue;
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vx *= pt.drag;
        pt.vy = pt.vy * pt.drag + pt.gravity;
        pt.rot += pt.vr;
        const fade = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3;
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        ctx.globalAlpha = fade;
        ctx.fillStyle = pt.color;
        this.drawParticleShape(ctx, pt.shape, pt.size);
        ctx.restore();
        alive.push(pt);
      }
      ctx.globalAlpha = 1;
      this.particles = alive;
    }

    // keyboard crosshair
    if (this.crosshairOn) {
      const [cx, cy] = this.viewCenter();
      const u = this.uiScale;
      ctx.strokeStyle = pal.crosshair;
      ctx.lineWidth = 1.8 * u;
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * u, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        ctx.moveTo(cx + dx * 18 * u, cy + dy * 18 * u);
        ctx.lineTo(cx + dx * 28 * u, cy + dy * 28 * u);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2 * u, 0, Math.PI * 2);
      ctx.fillStyle = pal.crosshair;
      ctx.fill();
    }
  }

  private drawParticleShape(
    ctx: CanvasRenderingContext2D,
    shape: Particle["shape"],
    size: number
  ): void {
    if (shape === "dot") {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (shape === "spark") {
      // 4-point sparkle — reads as a soft star without heavy geometry
      const arm = size;
      const core = size * 0.28;
      ctx.beginPath();
      ctx.moveTo(0, -arm);
      ctx.quadraticCurveTo(core, -core, arm, 0);
      ctx.quadraticCurveTo(core, core, 0, arm);
      ctx.quadraticCurveTo(-core, core, -arm, 0);
      ctx.quadraticCurveTo(-core, -core, 0, -arm);
      ctx.closePath();
      ctx.fill();
      return;
    }
    ctx.fillRect(-size * 0.7, -size * 0.4, size * 1.4, size * 0.8);
  }

  private drawPin(x: number, y: number, scale: number, kind: Pin["kind"]): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * this.uiScale, scale * this.uiScale);
    this.pinDesign.draw(
      ctx,
      buildPinInk(this.pinId, kind, this.pinThemed, this.themeColors)
    );
    ctx.restore();
  }

  private drawDirectionHint(hint: DirectionHint, now: number): void {
    if (!this.isVisible(hint.lonlat)) return;
    const origin = this.projection(hint.lonlat);
    if (!origin) return;

    // Project a nearby point along the discrete wind so the quarter follows the
    // map (not screen-up) while staying snapped to N/NE/E/… rather than true bearing.
    let aheadPx: [number, number] | null = null;
    for (const step of [2.5, 1.2, 0.5]) {
      const ahead = destinationPoint(hint.lonlat, hint.bearingDeg, step);
      if (!this.isVisible(ahead)) continue;
      const p = this.projection(ahead);
      if (p) {
        aheadPx = p;
        break;
      }
    }
    if (!aheadPx) return;

    const peak = Math.atan2(aheadPx[1] - origin[1], aheadPx[0] - origin[0]);
    const radius = this.ringRadius();
    const halfArc = Math.PI / 4; // exact quarter (±45°)
    const a0 = peak - halfArc;
    const a1 = peak + halfArc;
    const appear = Math.min(1, (now - hint.born) / (this.reduceMotion ? 1 : 420));
    const pulse = this.reduceMotion
      ? 1
      : 0.88 + 0.12 * Math.sin((now - hint.born) * 0.0042);
    const color = withAlpha(this.palette.hintArc, 0.85 * pulse);
    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = easeOut(appear);
    ctx.lineCap = "butt";

    // quiet full ring
    ctx.beginPath();
    ctx.arc(origin[0], origin[1], radius, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(this.palette.hintRing, 0.2 * pulse);
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // uniform quarter — arc runs fully to the edges; tips sit just inside & outside
    const strokeW = 2 * this.uiScale;
    const tipLen = 6 * this.uiScale;
    const tipHalf = strokeW * 0.85;
    const tipInset = tipHalf / radius; // ½ tip-width back along the arc from each edge
    const tipForward = strokeW / 2; // ½ stroke-width out from the ring
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = strokeW;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.arc(origin[0], origin[1], radius, a0, a1);
    ctx.stroke();

    for (const a of [a0 + tipInset, a1 - tipInset]) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      const tx = -s;
      const ty = c;
      const baseR = radius + tipForward;
      const tipR = baseR + tipLen;
      const bx = origin[0] + c * baseR;
      const by = origin[1] + s * baseR;
      ctx.beginPath();
      ctx.moveTo(bx + tx * tipHalf, by + ty * tipHalf);
      ctx.lineTo(bx - tx * tipHalf, by - ty * tipHalf);
      ctx.lineTo(origin[0] + c * tipR, origin[1] + s * tipR);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

// ------------------------------------------------------------------

function clampLat(lat: number): number {
  return Math.max(-89.9, Math.min(89.9, lat));
}

/** Shortest signed longitude difference a→b in degrees. */
function lonDelta(a: number, b: number): number {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}
