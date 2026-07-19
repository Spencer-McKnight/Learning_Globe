import type { Region } from "./geo";

export type ProjectionId = "globe" | "naturalEarth" | "equalEarth" | "mercator";
export type MotionPref = "auto" | "on" | "off";

export interface Settings {
  projection: ProjectionId;
  graticule: boolean;
  highContrast: boolean;
  reduceMotion: MotionPref;
  sound: boolean;
  haptics: boolean;
  region: Region;
  roundLength: 5 | 10 | 20;
  attempts: 1 | 2 | 3;
  hintsEnabled: boolean;
  speedBonus: boolean;
  playerName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  projection: "globe",
  graticule: true,
  highContrast: false,
  reduceMotion: "auto",
  sound: true,
  haptics: true,
  region: "World",
  roundLength: 10,
  attempts: 3,
  hintsEnabled: true,
  speedBonus: true,
  playerName: "",
};

export interface LeaderboardEntry {
  name: string;
  score: number;
  region: Region;
  correct: number;
  total: number;
  bestStreak: number;
  date: string; // ISO
}

export interface LifetimeStats {
  runs: number;
  correct: number;
  guesses: number;
  bestScore: number;
  bestStreak: number;
}

const KEYS = {
  settings: "lg:settings",
  passport: "lg:passport",
  leaderboard: "lg:leaderboard",
  stats: "lg:stats",
  tutorialSeen: "lg:tutorial-seen",
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function readRaw<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — the game still works, it just won't persist.
  }
}

export const loadSettings = (): Settings => read(KEYS.settings, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings): void => write(KEYS.settings, s);

/** iso code -> ISO date of first discovery */
export type Passport = Record<string, string>;
export const loadPassport = (): Passport => readRaw<Passport>(KEYS.passport, {});
export function stampPassport(iso: string): Passport {
  const p = loadPassport();
  if (!p[iso]) {
    p[iso] = new Date().toISOString();
    write(KEYS.passport, p);
  }
  return p;
}

export const loadLeaderboard = (): LeaderboardEntry[] =>
  readRaw<LeaderboardEntry[]>(KEYS.leaderboard, []);

export function saveLeaderboardEntry(entry: LeaderboardEntry): LeaderboardEntry[] {
  const all = [...loadLeaderboard(), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
  write(KEYS.leaderboard, all);
  return all;
}

export const loadStats = (): LifetimeStats =>
  read(KEYS.stats, { runs: 0, correct: 0, guesses: 0, bestScore: 0, bestStreak: 0 });

export function recordRun(score: number, correct: number, guesses: number, bestStreak: number): LifetimeStats {
  const s = loadStats();
  const next: LifetimeStats = {
    runs: s.runs + 1,
    correct: s.correct + correct,
    guesses: s.guesses + guesses,
    bestScore: Math.max(s.bestScore, score),
    bestStreak: Math.max(s.bestStreak, bestStreak),
  };
  write(KEYS.stats, next);
  return next;
}

export const tutorialSeen = (): boolean => readRaw(KEYS.tutorialSeen, false);
export const markTutorialSeen = (): void => write(KEYS.tutorialSeen, true);
