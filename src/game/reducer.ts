export type Phase = "prompt" | "feedback" | "over";

export interface GuessOutcome {
  kind: "correct" | "reveal" | "skip";
  countryId: number;
  points: number;
  discovery: boolean;
  proximity: number;
  fast: "fast" | "quick" | null;
  bullseye: boolean;
  streakAfter: number;
}

export interface MissInfo {
  distanceKm: number;
  direction: string; // compass key into STR.compass
  attemptsLeft: number;
}

export interface GameState {
  phase: Phase;
  pool: number[]; // shuffled country ids for this run
  index: number;
  maxAttempts: number;
  attempt: number; // 1-based
  hintsUsed: number; // for the current prompt
  score: number;
  streak: number;
  bestStreak: number;
  correctCount: number;
  guessCount: number;
  discoveries: string[]; // iso codes stamped this run
  promptStart: number;
  fastestMs: number | null;
  outcome: GuessOutcome | null; // set during "feedback"
  missInfo: MissInfo | null; // set during "prompt" after a wrong try
}

export const IDLE_GAME: GameState = {
  phase: "over",
  pool: [],
  index: 0,
  maxAttempts: 3,
  attempt: 1,
  hintsUsed: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  correctCount: 0,
  guessCount: 0,
  discoveries: [],
  promptStart: 0,
  fastestMs: null,
  outcome: null,
  missInfo: null,
};

export type GameAction =
  | { type: "start"; pool: number[]; maxAttempts: number; now: number }
  | {
      type: "correct";
      points: number;
      discovery: boolean;
      iso: string | null;
      proximity: number;
      fast: "fast" | "quick" | null;
      bullseye: boolean;
      elapsedMs: number;
    }
  | { type: "miss"; distanceKm: number; direction: string }
  | { type: "hint" }
  | { type: "skip" }
  | { type: "next"; now: number };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "start":
      return {
        ...IDLE_GAME,
        phase: "prompt",
        pool: action.pool,
        maxAttempts: action.maxAttempts,
        promptStart: action.now,
      };

    case "correct": {
      const streakAfter = state.streak + 1;
      return {
        ...state,
        phase: "feedback",
        score: state.score + action.points,
        streak: streakAfter,
        bestStreak: Math.max(state.bestStreak, streakAfter),
        correctCount: state.correctCount + 1,
        guessCount: state.guessCount + 1,
        discoveries: action.discovery && action.iso
          ? [...state.discoveries, action.iso]
          : state.discoveries,
        fastestMs:
          state.fastestMs === null
            ? action.elapsedMs
            : Math.min(state.fastestMs, action.elapsedMs),
        missInfo: null,
        outcome: {
          kind: "correct",
          countryId: state.pool[state.index],
          points: action.points,
          discovery: action.discovery,
          proximity: action.proximity,
          fast: action.fast,
          bullseye: action.bullseye,
          streakAfter,
        },
      };
    }

    case "miss": {
      const guessCount = state.guessCount + 1;
      if (state.attempt >= state.maxAttempts) {
        return {
          ...state,
          phase: "feedback",
          guessCount,
          streak: 0,
          missInfo: null,
          outcome: {
            kind: "reveal",
            countryId: state.pool[state.index],
            points: 0,
            discovery: false,
            proximity: 0,
            fast: null,
            bullseye: false,
            streakAfter: 0,
          },
        };
      }
      return {
        ...state,
        guessCount,
        attempt: state.attempt + 1,
        missInfo: {
          distanceKm: action.distanceKm,
          direction: action.direction,
          attemptsLeft: state.maxAttempts - state.attempt,
        },
      };
    }

    case "hint":
      return state.hintsUsed >= 3 ? state : { ...state, hintsUsed: state.hintsUsed + 1 };

    case "skip":
      return {
        ...state,
        phase: "feedback",
        streak: 0,
        missInfo: null,
        outcome: {
          kind: "skip",
          countryId: state.pool[state.index],
          points: 0,
          discovery: false,
          proximity: 0,
          fast: null,
          bullseye: false,
          streakAfter: 0,
        },
      };

    case "next": {
      const index = state.index + 1;
      if (index >= state.pool.length) return { ...state, phase: "over", outcome: null };
      return {
        ...state,
        phase: "prompt",
        index,
        attempt: 1,
        hintsUsed: 0,
        promptStart: action.now,
        outcome: null,
        missInfo: null,
      };
    }
  }
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
