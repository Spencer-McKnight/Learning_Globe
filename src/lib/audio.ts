/**
 * All sound effects are synthesized with WebAudio — no audio assets.
 * The context is created lazily on the first user gesture (autoplay policy).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let soundOn = true;
let hapticsOn = true;

export function setSound(on: boolean): void {
  soundOn = on;
}

export function setHaptics(on: boolean): void {
  hapticsOn = on;
}

export function unlockAudio(): void {
  if (!soundOn) return;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
    } catch {
      return;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function note(
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType = "sine",
  peak = 1
): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function slide(
  from: number,
  to: number,
  at: number,
  dur: number,
  type: OscillatorType = "sine",
  peak = 0.8
): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function ready(): boolean {
  if (!soundOn) return false;
  unlockAudio();
  return Boolean(ctx);
}

function vibrate(pattern: number | number[]): void {
  if (hapticsOn && "vibrate" in navigator) navigator.vibrate(pattern);
}

/** Sonar ping when a pin drops. */
export function sfxPin(): void {
  if (!ready()) return;
  slide(1400, 900, 0, 0.12, "sine", 0.5);
  vibrate(10);
}

/** Correct answer — pitch climbs with the streak. */
export function sfxCorrect(streak: number): void {
  if (!ready()) return;
  const semis = Math.min(streak, 12);
  const base = 523.25 * Math.pow(2, semis / 12); // C5 climbing
  note(base, 0, 0.16, "triangle", 0.9);
  note(base * 1.5, 0.09, 0.24, "triangle", 0.9);
  vibrate([12, 40, 18]);
}

/** Near-miss thud. Softer than "wrong" — the game stays kind. */
export function sfxMiss(): void {
  if (!ready()) return;
  slide(220, 165, 0, 0.22, "sine", 0.6);
  vibrate(30);
}

/** Out of tries — gentle reveal tone, not a fail buzzer. */
export function sfxReveal(): void {
  if (!ready()) return;
  note(330, 0, 0.2, "sine", 0.5);
  note(262, 0.12, 0.3, "sine", 0.5);
}

/** First-ever find: a little fanfare. */
export function sfxDiscovery(): void {
  if (!ready()) return;
  const seq = [523.25, 659.25, 783.99, 1046.5];
  seq.forEach((f, i) => note(f, i * 0.09, 0.22, "triangle", 0.85));
  note(1568, 0.36, 0.4, "sine", 0.5);
  vibrate([15, 30, 15, 30, 40]);
}

/** Streak milestone sparkle (5, 10, 15 in a row). */
export function sfxMilestone(): void {
  if (!ready()) return;
  slide(880, 2200, 0, 0.3, "sine", 0.45);
  slide(1100, 2600, 0.08, 0.3, "sine", 0.35);
}

/** End of round. */
export function sfxGameOver(good: boolean): void {
  if (!ready()) return;
  if (good) {
    [392, 523.25, 659.25, 783.99].forEach((f, i) => note(f, i * 0.12, 0.3, "triangle", 0.8));
  } else {
    note(392, 0, 0.25, "sine", 0.6);
    note(330, 0.15, 0.35, "sine", 0.6);
  }
}

/** Small UI tap. */
export function sfxTap(): void {
  if (!ready()) return;
  note(1200, 0, 0.05, "sine", 0.25);
}
