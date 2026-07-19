/** Arrow keys the controller understands. */
export type ArrowDir = "left" | "right" | "up" | "down";

/** Zoom keys the controller understands. */
export type ZoomDir = "in" | "out";

export interface NavMotion {
  /** Screen-space travel this frame in the nudge convention: +x = right, +y = down. */
  dx: number;
  dy: number;
  /** Multiplicative zoom for this frame (1 = unchanged). */
  zoom: number;
}

/**
 * Continuous keyboard navigation: tracks held arrows / zoom keys, accelerates
 * toward a target velocity, and coasts with friction on release so path and
 * zoom changes feel fluid instead of discrete key-repeat jumps.
 */
export class InteractionController {
  private held: Record<ArrowDir, boolean> = {
    left: false,
    right: false,
    up: false,
    down: false,
  };
  private zoomHeld: Record<ZoomDir, boolean> = {
    in: false,
    out: false,
  };
  /** Velocity in screen px/s (nudge convention). */
  private vx = 0;
  private vy = 0;
  /** Zoom velocity in natural-log(k) units per second. */
  private zoomVel = 0;
  /**
   * Soft zoom target in ln(k). Used for one-shot +/- taps and HUD buttons so
   * they ease instead of jumping; held zoom keys clear this.
   */
  private zoomTargetLn: number | null = null;

  setKey(dir: ArrowDir, pressed: boolean): void {
    this.held[dir] = pressed;
  }

  setZoomKey(dir: ZoomDir, pressed: boolean): void {
    this.zoomHeld[dir] = pressed;
    if (pressed) this.zoomTargetLn = null;
  }

  /**
   * Queue a multiplicative zoom that eases toward `currentK * factor`
   * (clamped). Stacks with an in-flight soft target.
   */
  requestZoom(factor: number, currentK: number, minK: number, maxK: number): void {
    if (!(factor > 0) || !isFinite(factor)) return;
    this.zoomHeld.in = false;
    this.zoomHeld.out = false;
    const base = this.zoomTargetLn ?? Math.log(currentK);
    this.zoomTargetLn = clamp(base + Math.log(factor), Math.log(minK), Math.log(maxK));
  }

  clear(): void {
    this.held.left = false;
    this.held.right = false;
    this.held.up = false;
    this.held.down = false;
    this.clearZoom();
    this.vx = 0;
    this.vy = 0;
  }

  /** Drop held / soft / coasting zoom without touching pan. */
  clearZoom(): void {
    this.zoomHeld.in = false;
    this.zoomHeld.out = false;
    this.zoomVel = 0;
    this.zoomTargetLn = null;
  }

  get active(): boolean {
    return (
      this.anyPanHeld ||
      this.anyZoomHeld ||
      this.zoomTargetLn !== null ||
      Math.abs(this.vx) > 0.01 ||
      Math.abs(this.vy) > 0.01 ||
      Math.abs(this.zoomVel) > 0.0001
    );
  }

  private get anyPanHeld(): boolean {
    return this.held.left || this.held.right || this.held.up || this.held.down;
  }

  private get anyZoomHeld(): boolean {
    return this.zoomHeld.in || this.zoomHeld.out;
  }

  /**
   * Advance the controller by `dtMs`. Pass the live `currentK` so soft zoom
   * targets can converge. Returns null when fully idle.
   */
  tick(dtMs: number, reduceMotion: boolean, currentK: number): NavMotion | null {
    const dt = Math.max(0, Math.min(0.064, dtMs / 1000));

    let tx = 0;
    let ty = 0;
    if (this.held.left) tx -= 1;
    if (this.held.right) tx += 1;
    if (this.held.up) ty -= 1;
    if (this.held.down) ty += 1;

    const panLen = Math.hypot(tx, ty);
    if (panLen > 0) {
      tx /= panLen;
      ty /= panLen;
    }

    // Feel tuned for mobile-first map play: brisk glide, soft land.
    const maxSpeed = reduceMotion ? 720 : 460; // px/s
    const panAccel = reduceMotion ? 9000 : 2400; // px/s²
    const panFriction = reduceMotion ? 28 : 7; // 1/s

    const targetX = tx * maxSpeed;
    const targetY = ty * maxSpeed;

    if (panLen > 0) {
      this.vx = approach(this.vx, targetX, panAccel * dt);
      this.vy = approach(this.vy, targetY, panAccel * dt);
    } else {
      const decay = Math.exp(-panFriction * dt);
      this.vx *= decay;
      this.vy *= decay;
      if (Math.abs(this.vx) < 0.8) this.vx = 0;
      if (Math.abs(this.vy) < 0.8) this.vy = 0;
    }

    // ---- zoom ----
    let tz = 0;
    if (this.zoomHeld.in) tz += 1;
    if (this.zoomHeld.out) tz -= 1;

    const maxZoomRate = reduceMotion ? 2.4 : 1.25; // ln(k)/s
    const zoomAccel = reduceMotion ? 18 : 7;
    const zoomFriction = reduceMotion ? 22 : 8;
    const softRate = reduceMotion ? 18 : 11; // 1/s toward soft target

    let zoomFactor = 1;

    if (tz !== 0) {
      this.zoomTargetLn = null;
      this.zoomVel = approach(this.zoomVel, tz * maxZoomRate, zoomAccel * dt);
      zoomFactor = Math.exp(this.zoomVel * dt);
    } else if (this.zoomTargetLn !== null) {
      // Ease ln(k) toward the soft target; cancel held-key coast.
      this.zoomVel = 0;
      const curLn = Math.log(Math.max(1e-6, currentK));
      const nextLn = curLn + (this.zoomTargetLn - curLn) * (1 - Math.exp(-softRate * dt));
      zoomFactor = Math.exp(nextLn - curLn);
      if (Math.abs(this.zoomTargetLn - nextLn) < 0.002) {
        zoomFactor = Math.exp(this.zoomTargetLn - curLn);
        this.zoomTargetLn = null;
      }
    } else {
      const decay = Math.exp(-zoomFriction * dt);
      this.zoomVel *= decay;
      if (Math.abs(this.zoomVel) < 0.01) this.zoomVel = 0;
      if (this.zoomVel !== 0) zoomFactor = Math.exp(this.zoomVel * dt);
    }

    const dx = this.vx * dt;
    const dy = this.vy * dt;
    if (dx === 0 && dy === 0 && zoomFactor === 1) return null;
    return { dx, dy, zoom: zoomFactor };
  }
}

function approach(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
