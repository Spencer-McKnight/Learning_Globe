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
import type { CompassKey, Country, LonLat, World } from "../lib/geo";
import { COMPASS_BEARING, destinationPoint, hitTest } from "../lib/geo";
import type { ProjectionId } from "../lib/storage";
import {
  COLORS,
  CONFETTI_COLORS,
  CORRECT_CONFETTI,
  DISCOVERY_CONFETTI,
  MAP_PALETTE,
  MAP_PALETTE_HIGH_CONTRAST,
  type MapPalette,
} from "../styles/palette";
import { InteractionController, type ArrowDir, type ZoomDir } from "./InteractionController";

export type ConfettiKind = "discovery" | "correct" | "milestone";

export interface MapEngineCallbacks {
  onTap: (lonlat: LonLat, screen: [number, number]) => void;
  onHover?: (country: Country | null) => void;
  /** Fired when the user pans, zooms, or keyboard-glides the map. */
  onInteract?: () => void;
}

interface Pin {
  lonlat: LonLat;
  color: string;
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

/** Approximate horizontal px-per-radian factor relative to projection.scale(). */
const X_FACTOR: Record<ProjectionId, number> = {
  globe: 1,
  mercator: 1,
  naturalEarth: 0.87,
  equalEarth: 0.85,
};

const MAX_LAT_MERCATOR = 84;
const TAP_SLOP_PX = 8;
const TAP_MAX_MS = 600;
/** Outer zoom-out bound only — view always initialises / resets at k=1 (fitted). */
const MIN_K = 0.675;
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

  /** Geographic point at the view center. */
  private center: LonLat = [12, 18];
  private panY = 0; // flat-mode vertical pan, px
  private k = 1; // zoom multiple of the fitted scale

  private interactive = false;
  private ambient = false;
  private ambientPausedUntil = 0;
  private graticuleOn = true;
  private reduceMotion = false;
  private palette: MapPalette = MAP_PALETTE;
  private crosshairOn = false;
  private discoveredTint: Set<string> | null = null;

  private hoverId: number | null = null;
  private selectedId: number | null = null;
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

  private refit(): void {
    const w = this.width;
    const h = this.height;
    if (w === 0 || h === 0) return;
    const pad = 8;

    if (this.projType === "mercator") {
      // Fit the ±84° band by hand — the sphere is unbounded under Mercator.
      const yMax = Math.log(Math.tan(Math.PI / 4 + (MAX_LAT_MERCATOR * Math.PI) / 360));
      this.baseScale = Math.min((w - pad * 2) / (2 * Math.PI), (h - pad * 2) / (2 * yMax));
      this.worldHeightK1 = 2 * yMax * this.baseScale;
    } else {
      this.projection = this.makeProjection();
      this.projection.fitExtent(
        [
          [pad, pad],
          [w - pad, h - pad],
        ],
        { type: "Sphere" }
      );
      this.baseScale = this.projection.scale();
      if (this.projType !== "globe") {
        const b = geoPath(this.projection).bounds({ type: "Sphere" });
        this.worldHeightK1 = b[1][1] - b[0][1];
      }
    }
    this.apply();
  }

  private apply(): void {
    const p = this.projection;
    p.scale(this.baseScale * this.k);
    if (this.projType === "globe") {
      p.rotate([-this.center[0], -this.center[1], 0]);
      p.translate([this.width / 2, this.height / 2]);
    } else {
      this.clampPanY();
      p.rotate([-this.center[0], 0, 0]);
      p.translate([this.width / 2, this.height / 2 + this.panY]);
      p.clipExtent([
        [0, 0],
        [this.width, this.height],
      ]);
    }
    this.path = geoPath(p, this.ctx);
    this.dirty = true;
    // Keep the crosshair country lit the same way mouse hover does.
    if (this.crosshairOn && this.interactive) this.hoverAt([this.width / 2, this.height / 2]);
  }

  private clampPanY(): void {
    const allowed = Math.max(0, (this.worldHeightK1 * this.k) / 2 - this.height / 2 + 32);
    this.panY = Math.max(-allowed, Math.min(allowed, this.panY));
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
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
    this.projection = this.makeProjection();
    this.refit();
  }

  setInteractive(on: boolean): void {
    this.interactive = on;
    if (!on) this.setHover(null);
    else if (this.crosshairOn) this.hoverAt([this.width / 2, this.height / 2]);
    this.canvas.style.cursor = on ? "grab" : "default";
  }

  setAmbient(on: boolean): void {
    this.ambient = on;
    this.dirty = true;
  }

  setGraticule(on: boolean): void {
    this.graticuleOn = on;
    this.dirty = true;
  }

  setHighContrast(on: boolean): void {
    this.palette = on ? MAP_PALETTE_HIGH_CONTRAST : MAP_PALETTE;
    this.dirty = true;
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on;
    this.dirty = true;
  }

  setCrosshair(on: boolean): void {
    this.crosshairOn = on;
    this.dirty = true;
    if (on && this.interactive) this.hoverAt([this.width / 2, this.height / 2]);
    else if (!on) this.setHover(null);
  }

  setSelected(id: number | null): void {
    this.selectedId = id;
    this.dirty = true;
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
    this.apply();
  }

  zoomBy(factor: number, about?: [number, number]): void {
    const maxK = this.projType === "globe" ? 14 : 18;
    const pivot = about ?? ([this.width / 2, this.height / 2] as [number, number]);
    if (this.reduceMotion) {
      this.zoomAbout(factor, pivot);
      this.pauseAmbient();
      return;
    }
    // Soft target so keyboard / HUD +/- ease instead of jumping.
    this.zoomPivot = pivot;
    this.nav.requestZoom(factor, this.k, MIN_K, maxK);
    this.fly = null;
    this.pauseAmbient();
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
      this.pauseAmbient();
    }
  }

  setZoomKey(dir: ZoomDir, pressed: boolean): void {
    this.nav.setZoomKey(dir, pressed);
    if (pressed) {
      this.zoomPivot = [this.width / 2, this.height / 2];
      this.fly = null;
      this.pauseAmbient();
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
    this.notifyInteract();
    const degPerPx = 180 / Math.PI / (this.baseScale * this.k * X_FACTOR[this.projType]);
    this.center[0] += dx * degPerPx;
    if (this.projType === "globe") {
      this.center[1] = clampLat(this.center[1] - dy * degPerPx);
    } else {
      this.panY -= dy;
    }
    this.fly = null;
    this.pauseAmbient();
    this.apply();
  }

  centerLonLat(): LonLat | null {
    return this.invert([this.width / 2, this.height / 2]);
  }

  screenOf(lonlat: LonLat): [number, number] | null {
    if (!this.isVisible(lonlat)) return null;
    const p = this.projection(lonlat);
    return p ? [p[0], p[1]] : null;
  }

  flyTo(target: LonLat, opts: { zoom?: number; dur?: number } = {}): void {
    this.nav.clear();
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

  /** For flat maps, also move the vertical pan so the target row is centered. */
  private centerFlatOn(target: LonLat): void {
    this.apply();
    const p = this.projection([target[0], target[1]]);
    if (p) {
      this.panY += this.height / 2 - p[1];
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
      color: kind === "correct" ? this.palette.correct : this.palette.miss,
      born: performance.now(),
      lines: lines?.length ? lines : undefined,
    });
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
    const [cx, cy] = at ?? [this.width / 2, this.height / 2];
    const now = performance.now();

    if (kind === "discovery") {
      // Gold fanfare: dense burst + lingering sparkle halo
      this.spawnParticles(cx, cy, now, {
        count: 58,
        colors: DISCOVERY_CONFETTI,
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
        colors: DISCOVERY_CONFETTI,
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
        colors: CORRECT_CONFETTI,
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
        colors: CONFETTI_COLORS,
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

  private pauseAmbient(): void {
    this.ambientPausedUntil = performance.now() + 3500;
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (this.pointers.size === 1) {
      this.gestureMoved = 0;
      this.gestureStart = performance.now();
      this.wasPinch = false;
      this.canvas.style.cursor = "grabbing";
    } else if (this.pointers.size === 2) {
      this.wasPinch = true;
      const [a, b] = [...this.pointers.values()];
      this.pinchPrevDist = Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    this.pauseAmbient();
  };

  private onPointerMove = (e: PointerEvent): void => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) {
      // Crosshair owns hover while keyboard aiming; don't fight it with the mouse.
      if (this.interactive && !this.crosshairOn) this.hoverAt([e.offsetX, e.offsetY]);
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
    this.drag(dx, dy);
  };

  private drag(dx: number, dy: number): void {
    // Pointer drag wins over keyboard coast so the two don't fight.
    this.nav.clear();
    this.notifyInteract();
    const scale = this.baseScale * this.k;
    const degPerPx = 180 / Math.PI / (scale * X_FACTOR[this.projType]);
    this.center[0] -= dx * degPerPx;
    if (this.projType === "globe") {
      this.center[1] = clampLat(this.center[1] + dy * (180 / Math.PI / scale));
    } else {
      this.panY += dy;
    }
    this.fly = null;
    this.pauseAmbient();
    this.apply();
  }

  private onPointerUp = (e: PointerEvent): void => {
    const had = this.pointers.delete(e.pointerId);
    this.canvas.style.cursor = this.interactive ? "grab" : "default";
    if (!had) return;
    const quick = performance.now() - this.gestureStart < TAP_MAX_MS;
    if (
      this.interactive &&
      !this.wasPinch &&
      this.pointers.size === 0 &&
      this.gestureMoved < TAP_SLOP_PX &&
      quick
    ) {
      const px: [number, number] = [e.offsetX, e.offsetY];
      const lonlat = this.invert(px);
      if (lonlat) this.cb.onTap(lonlat, px);
    }
  };

  private onPointerCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
  };

  private onPointerLeave = (): void => {
    if (this.crosshairOn) return;
    this.setHover(null);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    // Direct wheel input cancels eased keyboard zoom so they don't fight.
    this.nav.clearZoom();
    this.zoomPivot = null;
    const factor = Math.exp(-e.deltaY * 0.0022);
    this.zoomAbout(factor, [e.offsetX, e.offsetY]);
    this.pauseAmbient();
  };

  private hoverAt(px: [number, number]): void {
    const lonlat = this.invert(px);
    const c = lonlat ? hitTest(this.world, lonlat) : null;
    this.setHover(c ? c.id : null, c);
  }

  private setHover(id: number | null, country?: Country | null): void {
    if (id === this.hoverId) return;
    this.hoverId = id;
    this.dirty = true;
    if (this.interactive) {
      this.canvas.style.cursor = id !== null ? "pointer" : "grab";
    }
    this.cb.onHover?.(country ?? null);
  }

  // ------------------------------------------------------------------
  // render loop
  // ------------------------------------------------------------------

  private hasActiveEffects(now: number): boolean {
    if (this.fly) return true;
    if (this.nav.active) return true;
    if (this.ripples.length || this.particles.length || this.flashes.size) return true;
    if (this.pins.some((p) => now - p.born < 500)) return true;
    if (this.directionHint && !this.reduceMotion) return true;
    return false;
  }

  private frame = (now: number): void => {
    if (this.destroyed) return;
    const dt = Math.min(64, now - this.lastTime);
    this.lastTime = now;

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
            this.zoomPivot ?? ([this.width / 2, this.height / 2] as [number, number]);
          this.zoomAbout(motion.zoom, pivot);
        }
        if (motion.dx !== 0 || motion.dy !== 0) {
          this.applyNavDelta(motion.dx, motion.dy);
        }
      } else {
        this.zoomPivot = null;
      }
    }

    const spinning =
      this.ambient &&
      !this.reduceMotion &&
      now > this.ambientPausedUntil &&
      !this.fly &&
      !this.nav.active;
    if (spinning) {
      this.center[0] += (dt / 1000) * 3.2;
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
      const [cx, cy] = [w / 2, h / 2];
      const r = this.baseScale * this.k;
      // atmosphere glow
      const glow = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.06);
      glow.addColorStop(0, "rgba(111,255,233,0)");
      glow.addColorStop(0.75, this.palette.atmosphere);
      glow.addColorStop(1, "rgba(111,255,233,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
      grad.addColorStop(0, pal.oceanCenter);
      grad.addColorStop(1, pal.ocean);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.projType === "mercator") {
      ctx.fillStyle = pal.ocean;
      ctx.fillRect(0, 0, w, h);
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
    ctx.strokeStyle = pal.landBorder;
    ctx.lineWidth = Math.min(1.4, 0.7 + this.k * 0.05);
    ctx.stroke();

    // discovered tint (explore mode)
    if (this.discoveredTint) {
      ctx.beginPath();
      for (const c of this.world.countries) {
        if (c.props.iso && this.discoveredTint.has(c.props.iso)) {
          this.path(c.feature as GeoJSON.Feature);
        }
      }
      ctx.fillStyle = "rgba(91,192,190,0.28)";
      ctx.fill();
    }

    // hover + selected
    if (this.hoverId !== null) {
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
      const breath = this.reduceMotion ? 1 : 0.92 + 0.08 * Math.sin(age * Math.PI * 3.2);

      // soft wash that blooms then clears inside the ring
      if (!this.reduceMotion && age < 0.72) {
        const washT = easeOut(age / 0.72);
        const washR = Math.max(0.5, washT * INDICATOR_RING_R * breath);
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
        const radius = Math.max(0.5, expand * INDICATOR_RING_R);
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
      this.drawPin(p[0], p[1], s, pin.color);
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
      const [cx, cy] = [w / 2, h / 2];
      ctx.strokeStyle = pal.crosshair;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        ctx.moveTo(cx + dx * 18, cy + dy * 18);
        ctx.lineTo(cx + dx * 28, cy + dy * 28);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
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

  private drawPin(x: number, y: number, scale: number, color: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Simple marker: round head + short tip (tip at 0,0)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-6.5, -8);
    ctx.arc(0, -11, 7, Math.PI * 0.82, Math.PI * 0.18, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Foam hole — high contrast on both coral and aquamarine
    ctx.beginPath();
    ctx.arc(0, -11, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.foam;
    ctx.fill();

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
    const radius = INDICATOR_RING_R;
    const halfArc = Math.PI / 4; // exact quarter (±45°)
    const a0 = peak - halfArc;
    const a1 = peak + halfArc;
    const appear = Math.min(1, (now - hint.born) / (this.reduceMotion ? 1 : 420));
    const pulse = this.reduceMotion
      ? 1
      : 0.88 + 0.12 * Math.sin((now - hint.born) * 0.0042);
    const color = withAlpha(COLORS.glow, 0.85 * pulse);
    const ctx = this.ctx;

    ctx.save();
    ctx.globalAlpha = easeOut(appear);
    ctx.lineCap = "butt";

    // quiet full ring
    ctx.beginPath();
    ctx.arc(origin[0], origin[1], radius, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(COLORS.surf, 0.2 * pulse);
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // uniform quarter — arc runs fully to the edges; tips sit just inside & outside
    const strokeW = 2;
    const tipLen = 6;
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

function withAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (hex.startsWith("rgba")) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}
