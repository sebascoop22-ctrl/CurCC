import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServerSupabase(): SupabaseClient | null {
  const url =
    (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const key = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
