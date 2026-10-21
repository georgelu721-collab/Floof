import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The URL and publishable key are public by design (they ship to every browser).
// Data is protected by the row level security rules in supabase/migrations.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ttnqpjmjlbyxzfqgwhgi.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_5zBS8Ku5ebCZT8iwK71JAg_5zlbxx0U";

/** Set NEXT_PUBLIC_FLOOF_LOCAL=1 to run the old browser-only demo without a backend. */
export const CLOUD = process.env.NEXT_PUBLIC_FLOOF_LOCAL !== "1" && !!URL && !!KEY;

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}
