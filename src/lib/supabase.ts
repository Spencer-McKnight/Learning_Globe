import { createClient } from "@supabase/supabase-js";

/**
 * The one Supabase client. Auth state is persisted in localStorage and
 * refreshed automatically; account.ts translates its sessions into the
 * app's Account type so nothing else imports this directly for auth.
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);
