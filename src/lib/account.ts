/**
 * The guest/member boundary, now backed by Supabase Auth.
 *
 * Any place where guest and member behaviour diverge (storage scope,
 * badges, sync notes, leaderboard submission) must branch on
 * `Account.kind` through this module, never on an ad-hoc flag.
 *
 * The app root calls `watchAccount` once; it keeps the module-level
 * account and the storage prefix in sync with the auth session, then
 * notifies the callback so React can remount on identity change.
 */

import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Account =
  | { kind: "guest" }
  | { kind: "member"; id: string; name: string; email: string };

export const GUEST_ACCOUNT: Account = { kind: "guest" };

let active: Account = GUEST_ACCOUNT;

export function currentAccount(): Account {
  return active;
}

export const isMember = (a: Account): boolean => a.kind === "member";

/** Every persisted profile value lives under this prefix — one bucket per account. */
export function storagePrefix(a: Account): string {
  return a.kind === "guest" ? "lg:guest:" : `lg:u:${a.id}:`;
}

/** OAuth metadata first, then whatever the player typed, then the email stem. */
function displayName(session: Session): string {
  const meta = session.user.user_metadata ?? {};
  const fromMeta =
    (typeof meta.display_name === "string" && meta.display_name.trim()) ||
    (typeof meta.full_name === "string" && meta.full_name.trim());
  return fromMeta || session.user.email?.split("@")[0] || "";
}

function toAccount(session: Session | null): Account {
  if (!session) return GUEST_ACCOUNT;
  return {
    kind: "member",
    id: session.user.id,
    name: displayName(session),
    email: session.user.email ?? "",
  };
}

/**
 * Subscribe to auth changes. The root listener must call storage's
 * `setActiveAccount` before triggering a React remount, so the app reads
 * the right bucket during its initial render. Returns an unsubscribe fn.
 */
export function watchAccount(onChange: (a: Account) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    active = toAccount(session);
    onChange(active);
  });
  return () => data.subscription.unsubscribe();
}

// ---------------- sign-in flows ----------------

export type OAuthProvider = "google" | "github" | "apple";

const OAUTH_PROVIDERS: OAuthProvider[] = ["google", "github", "apple"];

/**
 * Which OAuth providers actually have credentials configured, straight
 * from the auth server — so the sheet only offers buttons that work,
 * and new providers light up with zero frontend changes.
 */
export async function fetchEnabledProviders(): Promise<OAuthProvider[]> {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`,
      { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
    );
    if (!res.ok) return [];
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return OAUTH_PROVIDERS.filter((p) => settings.external?.[p]);
  } catch {
    return [];
  }
}

/** Email a one-time code + magic link; the account is created on first use. */
export async function requestEmailCode(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
  });
  return { error: error ? error.message : null };
}

/** Verify the 6-digit code typed from the email. */
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code.trim(),
    type: "email",
  });
  return { error: error ? error.message : null };
}

/** Redirect out to an OAuth provider; the session lands on return. */
export async function signInWithProvider(
  provider: OAuthProvider
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  return { error: error ? error.message : null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Rename in auth metadata (drives the badge) and the profiles row (relational). */
export async function updateDisplayName(name: string): Promise<{ error: string | null }> {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return { error: null };
  const { data, error } = await supabase.auth.updateUser({ data: { display_name: trimmed } });
  if (error) return { error: error.message };
  if (data.user) {
    await supabase.from("profiles").update({ display_name: trimmed }).eq("id", data.user.id);
  }
  return { error: null };
}
