/**
 * Cookie-clicker curve, per the brief: scores start small and snowball into
 * the millions inside one run. Streak doubles the multiplier each answer.
 * Landing inside the country at all is a win; proximity to its heart only
 * controls the final 10%.
 */

export const BASE_POINTS = 1000;
export const DISCOVERY_BONUS = 50_000;
export const MAX_STREAK_EXP = 11; // caps the multiplier at ×2048

export const comboMultiplier = (streak: number): number =>
  2 ** Math.min(Math.max(streak, 0), MAX_STREAK_EXP);

/** proximity 0..1 scales only the final 10% of the score. */
export const accuracyFactor = (proximity: number): number => 0.9 + 0.1 * proximity;

export function speedFactor(ms: number, enabled: boolean): number {
  if (!enabled) return 1;
  if (ms < 4000) return 1.5;
  if (ms < 9000) return 1.25;
  return 1;
}

/** attempt is 1-based: full points first try, half second, quarter third. */
export const attemptFactor = (attempt: number): number => 0.5 ** (attempt - 1);

export const hintFactor = (hintsUsed: number): number => 0.7 ** hintsUsed;

export interface GuessScore {
  points: number;
  combo: number;
  fast: "fast" | "quick" | null;
  bullseye: boolean;
}

export function scoreGuess(opts: {
  streakBefore: number;
  proximity: number;
  elapsedMs: number;
  attempt: number;
  hintsUsed: number;
  speedBonusEnabled: boolean;
}): GuessScore {
  const combo = comboMultiplier(opts.streakBefore);
  const points = Math.round(
    BASE_POINTS *
      combo *
      accuracyFactor(opts.proximity) *
      speedFactor(opts.elapsedMs, opts.speedBonusEnabled) *
      attemptFactor(opts.attempt) *
      hintFactor(opts.hintsUsed)
  );
  return {
    points,
    combo,
    fast:
      opts.speedBonusEnabled && opts.elapsedMs < 4000
        ? "fast"
        : opts.speedBonusEnabled && opts.elapsedMs < 9000
          ? "quick"
          : null,
    bullseye: opts.proximity > 0.85,
  };
}

export const formatPoints = (n: number): string => n.toLocaleString();
