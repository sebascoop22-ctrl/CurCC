import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";

export type AppRole = "admin" | "promoter" | "club" | "host" | null;

export async function resolveSignedInRole(
  client?: SupabaseClient | null,
): Promise<{ signedIn: boolean; role: AppRole }> {
  const supabase = client ?? getSupabaseClient();
  if (!supabase) return { signedIn: false, role: null };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return { signedIn: false, role: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();
  const roleRaw = String(profile?.role ?? "").trim().toLowerCase();
  const role: AppRole =
    roleRaw === "admin" ||
    roleRaw === "promoter" ||
    roleRaw === "club" ||
    roleRaw === "host"
      ? roleRaw
      : null;
  return { signedIn: true, role };
}
