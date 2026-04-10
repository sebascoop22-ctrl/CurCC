import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function readEnv(name: string): string {
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function resolveSupabaseEnv(): { url: string; anonKey: string } {
  const url = readEnv("VITE_SUPABASE_URL");
  const anonKey =
    readEnv("VITE_SUPABASE_ANON_KEY") || readEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  return { url, anonKey };
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const { url, anonKey } = resolveSupabaseEnv();
  if (!url || !anonKey) {
    console.warn(
      "[Cooper Concierge] Supabase env missing. Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.",
    );
    return null;
  }
  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  });
  return cachedClient;
}
