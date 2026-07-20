/**
 * The sync layer between the offline-first client and Supabase.
 *
 * Guests never touch the network. For members, a finished run is one
 * `submit_run` RPC (the server re-validates the score and maintains all
 * aggregates in the same transaction); runs that fail to send are queued in
 * localStorage and retried, so offline play is never lost. Everything here
 * is fire-and-forget from the game's point of view — a sync failure must
 * never interrupt play.
 */

import { currentAccount, storagePrefix } from "./account";
import type { Region } from "./geo";
import {
  loadSettings,
  type LifetimeStats,
  type Passport,
  type Settings,
} from "./storage";
import { supabase } from "./supabase";

export interface RunGuess {
  iso: string;
  res: "hit" | "reveal" | "skip";
  tries: number;
  hints: number;
  points: number;
}

export interface RunPayload {
  run_id: string;
  region: Region;
  score: number;
  correct: number;
  best_streak: number;
  guesses: RunGuess[];
}

export interface BoardRanks {
  alltime: number | null;
  weekly: number | null;
}

interface CloudStats {
  runs: number;
  correct: number;
  guesses: number;
  best_score: number;
  best_streak: number;
  countries_discovered: number;
}

export interface CloudSnapshot {
  settings: Settings | null;
  settingsUpdatedAt: number;
  stats: LifetimeStats | null;
  passport: Passport;
}

export interface BoardEntry {
  rank: number;
  name: string;
  score: number;
  correct: number;
  rounds: number;
  when: string;
}

export interface Board {
  entries: BoardEntry[];
  me: { rank: number; score: number } | null;
}

/** 'alltime' | 'thisweek' — the server resolves the current ISO week. */
export type BoardPeriod = "alltime" | "thisweek";

export const boardKey = (period: BoardPeriod, region: Region): string =>
  `${period}:${region}`;

const memberId = (): string | null => {
  const a = currentAccount();
  return a.kind === "member" ? a.id : null;
};

// ---------------- run submission ----------------

/** Runs that failed to reach the server, kept per member bucket. */
const QUEUE_LIMIT = 20;

const queueKey = (): string => storagePrefix(currentAccount()) + "pendingRuns";

function readQueue(): RunPayload[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey()) ?? "[]") as RunPayload[];
  } catch {
    return [];
  }
}

function writeQueue(q: RunPayload[]): void {
  try {
    localStorage.setItem(queueKey(), JSON.stringify(q.slice(-QUEUE_LIMIT)));
  } catch {
    // Storage unavailable — the run stays cloud-only-lost, play continues.
  }
}

/**
 * A raised exception in the RPC (validation rejected the run) arrives as a
 * PostgREST P0001 — retrying those would loop forever, so they are dropped;
 * anything else looks like a network problem and requeues.
 */
const isRejection = (error: { code?: string } | null): boolean =>
  error?.code === "P0001";

async function callSubmit(payload: RunPayload): Promise<{
  ranks: BoardRanks | null;
  retry: boolean;
}> {
  const { data, error } = await supabase.rpc("submit_run", { p: payload });
  if (error) return { ranks: null, retry: !isRejection(error) };
  const ranks = (data as { ranks?: BoardRanks | null })?.ranks ?? null;
  return { ranks, retry: false };
}

/** Submit a finished run; on network failure, queue it for a later flush. */
export async function submitRun(payload: RunPayload): Promise<BoardRanks | null> {
  if (!memberId()) return null;
  const { ranks, retry } = await callSubmit(payload);
  if (retry) writeQueue([...readQueue(), payload]);
  return ranks;
}

/** Retry queued offline runs; each success leaves the queue for good. */
export async function flushPendingRuns(): Promise<void> {
  if (!memberId()) return;
  const q = readQueue();
  if (q.length === 0) return;
  const remaining: RunPayload[] = [];
  for (const payload of q) {
    const { retry } = await callSubmit(payload);
    if (retry) remaining.push(payload);
  }
  writeQueue(remaining);
}

// ---------------- profile state sync ----------------

/** Pull the member's cloud state in one parallel round of reads. */
export async function fetchCloudSnapshot(): Promise<CloudSnapshot | null> {
  if (!memberId()) return null;
  const [settingsRes, statsRes, passportRes] = await Promise.all([
    supabase.from("player_settings").select("settings, updated_at").maybeSingle(),
    supabase.from("player_stats").select("*").maybeSingle(),
    supabase.from("passport_stamps").select("country_iso, first_discovered_at"),
  ]);
  if (settingsRes.error || statsRes.error || passportRes.error) return null;

  const passport: Passport = {};
  for (const row of passportRes.data ?? []) {
    passport[row.country_iso as string] = row.first_discovered_at as string;
  }

  const raw = statsRes.data as CloudStats | null;
  return {
    settings: (settingsRes.data?.settings as Settings | undefined) ?? null,
    settingsUpdatedAt: settingsRes.data
      ? new Date(settingsRes.data.updated_at as string).getTime()
      : 0,
    stats: raw
      ? {
          runs: raw.runs,
          correct: raw.correct,
          guesses: raw.guesses,
          bestScore: raw.best_score,
          bestStreak: raw.best_streak,
        }
      : null,
    passport,
  };
}

/** Upsert the member's settings; updated_at becomes the cloud LWW clock. */
export async function pushSettings(settings: Settings): Promise<void> {
  const id = memberId();
  if (!id) return;
  await supabase
    .from("player_settings")
    .upsert({ player_id: id, settings, updated_at: new Date().toISOString() });
}

// ---------------- guest import ----------------

/** Device-local guard so the (server-guarded) import RPC is called once. */
const importedKey = (id: string): string => `lg:u:${id}:guestImported`;

/**
 * Replay this device's guest bucket into the member account. The server
 * flag is the real guard; the local key just skips the RPC on later boots.
 */
export async function importGuestStateOnce(): Promise<void> {
  const id = memberId();
  if (!id) return;
  try {
    if (localStorage.getItem(importedKey(id))) return;
  } catch {
    return;
  }

  const readGuest = (k: string): unknown => {
    try {
      const raw = localStorage.getItem(`lg:guest:${k}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const payload = {
    settings: readGuest("settings"),
    stats: readGuest("stats"),
    passport: readGuest("passport"),
  };
  const { error } = await supabase.rpc("import_guest_state", { p: payload });
  // A validation rejection will never succeed on retry; only network
  // failures leave the local flag unset so the next boot tries again.
  if (!error || isRejection(error)) {
    try {
      localStorage.setItem(importedKey(id), "1");
    } catch {
      // Fine — the server flag still prevents a double import.
    }
  }
}

// ---------------- leaderboards ----------------

/** Public read — works for guests too. */
export async function fetchLeaderboard(
  period: BoardPeriod,
  region: Region,
  limit = 10
): Promise<Board | null> {
  const { data, error } = await supabase.rpc("get_leaderboard", {
    p_board: boardKey(period, region),
    p_limit: limit,
  });
  if (error || !data) return null;
  return data as Board;
}

// ---------------- boot ----------------

/**
 * Everything a member's session needs at mount, ordered so queued runs and
 * the guest import land before the snapshot read that reflects them.
 */
export async function bootMemberSync(): Promise<CloudSnapshot | null> {
  if (!memberId()) return null;
  await importGuestStateOnce();
  await flushPendingRuns();
  const snap = await fetchCloudSnapshot();
  // First device of a fresh account: seed the cloud with local settings.
  if (snap && !snap.settings) void pushSettings(loadSettings());
  return snap;
}
