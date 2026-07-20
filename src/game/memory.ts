import type { GuessRecord } from "../lib/storage";

/**
 * What the player remembers, and for how long.
 *
 * A compact implementation of the FSRS (Free Spaced Repetition Scheduler)
 * memory model — the same family of algorithm Anki ships — reduced to what a
 * map game needs and run entirely client-side over the rolling guess
 * history. Every country the player has met carries three numbers:
 *
 *   stability      how many days until recall decays to 90%
 *   difficulty     1..10, how stubbornly that stability refuses to grow
 *   retrievability the chance of finding it *right now*, which decays with
 *                  time since it was last asked
 *
 * The forgetting curve is FSRS's power form, which fits human data far
 * better than the classical exponential — memory decays fast at first and
 * then hangs on for a very long tail:
 *
 *     R(t) = (1 + F·t/S) ^ -0.5,   F = 19/81
 *
 * so that R = 0.9 exactly when t = S, whatever S happens to be.
 *
 * The weights below are the published FSRS-4.5 defaults, fitted across
 * millions of real reviews. They are a much better starting point than
 * anything hand-tuned here, and nothing in the game needs them to be exact —
 * they only have to rank countries sensibly against each other.
 */

/** FSRS-4.5 default weights (w0..w16). */
const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81;

const DAY_MS = 86_400_000;
const MIN_STABILITY = 0.02; // ~30 minutes
const MAX_STABILITY = 3650; // ten years is "known"

/** A hit slower than this reads as effortful rather than fluent. */
const SLOW_MS = 12_000;

/** How much a country's geography-based prior anchors its initial difficulty. */
const PRIOR_ANCHOR = 0.4;

/** FSRS grades: 1 again, 2 hard, 3 good, 4 easy. */
export type Grade = 1 | 2 | 3 | 4;

export interface Memory {
  iso: string;
  /** Days until retrievability decays to 0.9. */
  stability: number;
  /** 1..10; higher countries earn less stability per correct find. */
  difficulty: number;
  /** Epoch ms of the last prompt. */
  last: number;
  reps: number;
  lapses: number;
}

/**
 * Read a finished prompt as a grade. Attempts and hints both signal a
 * shakier memory than the clean find they preceded; hesitation does too,
 * which is why the response time is worth recording.
 */
export function gradeOf(rec: GuessRecord): Grade {
  if (rec.res !== "hit") return 1;
  if (rec.tries > 1 || rec.hints > 0) return 2;
  return (rec.ms ?? 0) > SLOW_MS ? 3 : 4;
}

/** A grade as a 0..1 outcome, for the ability estimate and accuracy windows. */
export function outcomeValue(g: Grade): number {
  return [0, 0.3, 0.8, 1][g - 1];
}

/** Chance of finding this country right now. */
export function retrievability(m: Memory, now: number): number {
  const days = Math.max(0, (now - m.last) / DAY_MS);
  return Math.pow(1 + (FACTOR * days) / m.stability, DECAY);
}

/** Days from now until this country decays to the given retention. */
export function daysUntil(m: Memory, retention: number, now: number): number {
  const full = (m.stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return full - (now - m.last) / DAY_MS;
}

/**
 * Replay the guess history into a memory state per country. Cheap enough to
 * run at the start of every round: the history is capped at a couple of
 * hundred records.
 *
 * `priors` optionally supplies a geography-based difficulty per country
 * (small, obscure, crowded places are harder), which anchors the first
 * estimate before the player's own evidence takes over.
 */
export function buildMemories(
  history: GuessRecord[],
  priors?: Map<string, number>
): Map<string, Memory> {
  const out = new Map<string, Memory>();
  for (const rec of history) {
    const g = gradeOf(rec);
    const prev = out.get(rec.iso);
    out.set(rec.iso, prev ? review(prev, g, rec.t) : first(rec.iso, g, rec.t, priors?.get(rec.iso)));
  }
  return out;
}

function first(iso: string, g: Grade, t: number, prior?: number): Memory {
  const base = initialDifficulty(g);
  return {
    iso,
    stability: clampStability(W[g - 1]),
    difficulty: prior === undefined ? base : clampD(base * (1 - PRIOR_ANCHOR) + prior * PRIOR_ANCHOR),
    last: t,
    reps: 1,
    lapses: g === 1 ? 1 : 0,
  };
}

function review(m: Memory, g: Grade, t: number): Memory {
  const r = retrievability(m, t);
  const difficulty = nextDifficulty(m.difficulty, g);
  const stability =
    g === 1
      ? forgottenStability(m.stability, difficulty, r)
      : rememberedStability(m.stability, difficulty, r, g);
  return {
    iso: m.iso,
    stability: clampStability(stability),
    difficulty,
    last: t,
    reps: m.reps + 1,
    lapses: m.lapses + (g === 1 ? 1 : 0),
  };
}

function initialDifficulty(g: Grade): number {
  return clampD(W[4] - (g - 3) * W[5]);
}

/**
 * Difficulty drifts on each review and is pulled back towards the value an
 * "easy" first meeting would have set, so one bad day never permanently
 * condemns a country.
 */
function nextDifficulty(d: number, g: Grade): number {
  const delta = -W[6] * (g - 3);
  const moved = d + delta * ((10 - d) / 9); // damped near the ceiling
  return clampD(W[7] * initialDifficulty(4) + (1 - W[7]) * moved);
}

/** Stability after a successful find — grows most when recall was hard-won. */
function rememberedStability(s: number, d: number, r: number, g: Grade): number {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  const growth =
    Math.exp(W[8]) *
    (11 - d) *
    Math.pow(s, -W[9]) *
    (Math.exp(W[10] * (1 - r)) - 1) *
    hard *
    easy;
  return s * (1 + growth);
}

/** Stability after a lapse — never above where it already was. */
function forgottenStability(s: number, d: number, r: number): number {
  const next =
    W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  return Math.min(next, s);
}

const clampD = (d: number): number => Math.min(10, Math.max(1, d));
const clampStability = (s: number): number =>
  Math.min(MAX_STABILITY, Math.max(MIN_STABILITY, s));

/**
 * 0..1 summary of how well a country is known, for the passport and any
 * future mastery display: retrievability now, tempered by how durable the
 * memory has become.
 */
export function mastery(m: Memory, now: number): number {
  const durable = Math.min(1, Math.log10(1 + m.stability) / Math.log10(1 + 180));
  return retrievability(m, now) * (0.4 + 0.6 * durable);
}
