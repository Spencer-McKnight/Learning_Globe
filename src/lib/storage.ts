import type { Region } from "./geo";
import { DEFAULT_PIN_ID, type PinId } from "../map/pins";
import {
  DEFAULT_CUSTOM_SEED,
  DEFAULT_THEME_ID,
  migrateThemeId,
  type ThemeId,
} from "../styles/themes";
import { currentAccount, storagePrefix, type Account } from "./account";

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
  /** Selected world (colour theme); "custom" derives from customColor. */
  theme: ThemeId;
  /** Seed colour the custom world grows from. */
  customColor: string;
  /** Selected pin design (see map/pins.ts). */
  pin: PinId;
  /** Paint the pin with the world's palette instead of its own colours. */
  pinThemed: boolean;
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
  theme: DEFAULT_THEME_ID,
  customColor: DEFAULT_CUSTOM_SEED,
  pin: DEFAULT_PIN_ID,
  pinThemed: true,
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

/**
 * Profile data is namespaced per account (see account.ts) so a guest's
 * progress survives in its own bucket when login arrives, and a member's
 * bucket never collides with it. Device-level concerns (tutorial seen,
 * the pre-paint theme snapshot in themes.ts) stay unprefixed.
 */
type ProfileKey =
  | "settings"
  | "settingsAt"
  | "passport"
  | "leaderboard"
  | "stats"
  | "history";

let prefix = storagePrefix(currentAccount());

/** Future login flow calls this on auth change; callers must then re-load state. */
export function setActiveAccount(a: Account): void {
  prefix = storagePrefix(a);
}

const key = (k: ProfileKey): string => prefix + k;

const DEVICE_KEYS = {
  tutorialSeen: "lg:tutorial-seen",
} as const;

// One-time move of pre-account data (bare `lg:settings` etc.) into the guest bucket.
(() => {
  try {
    for (const k of ["settings", "passport", "leaderboard", "stats"] as const) {
      const legacy = localStorage.getItem(`lg:${k}`);
      if (legacy !== null) {
        if (localStorage.getItem(`lg:guest:${k}`) === null) {
          localStorage.setItem(`lg:guest:${k}`, legacy);
        }
        localStorage.removeItem(`lg:${k}`);
      }
    }
  } catch {
    // Storage unavailable — nothing to migrate.
  }
})();

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

export function loadSettings(): Settings {
  const s = read(key("settings"), DEFAULT_SETTINGS);
  // Saved (or cloud-synced) worlds from the 1.0 catalogue land on their heir.
  return { ...s, theme: migrateThemeId(s.theme) };
}
export function saveSettings(s: Settings): void {
  write(key("settings"), s);
  write(key("settingsAt"), Date.now());
}

/** Epoch ms of the last local settings save — the LWW clock for cloud sync. */
export const settingsSavedAt = (): number => readRaw(key("settingsAt"), 0);

/** Apply cloud settings without advancing the local LWW clock past theirs. */
export function adoptCloudSettings(s: Settings, cloudUpdatedAt: number): void {
  write(key("settings"), s);
  write(key("settingsAt"), cloudUpdatedAt);
}

/** iso code -> ISO date of first discovery */
export type Passport = Record<string, string>;
export const loadPassport = (): Passport => readRaw<Passport>(key("passport"), {});
export function stampPassport(iso: string): Passport {
  const p = loadPassport();
  if (!p[iso]) {
    p[iso] = new Date().toISOString();
    write(key("passport"), p);
  }
  return p;
}

export const loadLeaderboard = (): LeaderboardEntry[] =>
  readRaw<LeaderboardEntry[]>(key("leaderboard"), []);

export function saveLeaderboardEntry(entry: LeaderboardEntry): LeaderboardEntry[] {
  const all = [...loadLeaderboard(), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
  write(key("leaderboard"), all);
  return all;
}

/** Fold cloud passport rows into the local book, keeping earliest dates. */
export function mergePassport(cloud: Passport): Passport {
  const local = loadPassport();
  let changed = false;
  for (const [iso, date] of Object.entries(cloud)) {
    if (!local[iso] || date < local[iso]) {
      local[iso] = date;
      changed = true;
    }
  }
  if (changed) write(key("passport"), local);
  return local;
}

/**
 * Cloud counters normally lead this device (every run is submitted), but a
 * device with runs still queued offline can be ahead — take the max of each
 * side rather than trusting either outright.
 */
export function mergeCloudStats(cloud: LifetimeStats): LifetimeStats {
  const s = loadStats();
  const merged: LifetimeStats = {
    runs: Math.max(s.runs, cloud.runs),
    correct: Math.max(s.correct, cloud.correct),
    guesses: Math.max(s.guesses, cloud.guesses),
    bestScore: Math.max(s.bestScore, cloud.bestScore),
    bestStreak: Math.max(s.bestStreak, cloud.bestStreak),
  };
  write(key("stats"), merged);
  return merged;
}

export const loadStats = (): LifetimeStats =>
  read(key("stats"), { runs: 0, correct: 0, guesses: 0, bestScore: 0, bestStreak: 0 });

export function recordRun(score: number, correct: number, guesses: number, bestStreak: number): LifetimeStats {
  const s = loadStats();
  const next: LifetimeStats = {
    runs: s.runs + 1,
    correct: s.correct + correct,
    guesses: s.guesses + guesses,
    bestScore: Math.max(s.bestScore, score),
    bestStreak: Math.max(s.bestStreak, bestStreak),
  };
  write(key("stats"), next);
  return next;
}

export const tutorialSeen = (): boolean => readRaw(DEVICE_KEYS.tutorialSeen, false);
export const markTutorialSeen = (): void => write(DEVICE_KEYS.tutorialSeen, true);

// ---------------- guess history ----------------

/** One finished prompt (not each pin) — the profile of past guesses. */
export interface GuessRecord {
  iso: string;
  /** hit = found it; reveal = ran out of tries; skip = gave up untried. */
  res: "hit" | "reveal" | "skip";
  /** Pins dropped for this prompt (for a hit, the attempt it landed on). */
  tries: number;
  hints: number;
  /** Epoch ms. */
  t: number;
  /** Time from prompt to resolution, ms — hesitation is a fluency signal. */
  ms?: number;
  /** Countries wrongly pinned for this prompt; the confusion signal. */
  miss?: string[];
}

/**
 * Rolling window: roughly twenty rounds of signal for the adaptive picker
 * (~10 KB of JSON) without unbounded growth. Same cap for guest and
 * member, so a future sync never balloons a backend either.
 */
export const HISTORY_LIMIT = 200;

export const loadHistory = (): GuessRecord[] =>
  readRaw<GuessRecord[]>(key("history"), []);

export function recordGuess(rec: GuessRecord): GuessRecord[] {
  const all = [...loadHistory(), rec].slice(-HISTORY_LIMIT);
  write(key("history"), all);
  return all;
}
