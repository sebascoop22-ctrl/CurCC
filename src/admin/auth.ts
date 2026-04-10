import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AdminGateResult =
  | { ok: true; user: User; role: "admin" }
  | { ok: false; reason: string };

export async function gateAdminUser(
  supabase: SupabaseClient,
): Promise<AdminGateResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    return { ok: false, reason: "not_signed_in" };
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();
  if (profileError) {
    return { ok: false, reason: "profile_error" };
  }
  if (profile?.role !== "admin") {
    return { ok: false, reason: "not_admin" };
  }
  return { ok: true, user: session.user, role: "admin" };
}

export async function signInAdmin(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  const gate = await gateAdminUser(supabase);
  if (!gate.ok) {
    await supabase.auth.signOut();
    if (gate.reason === "not_admin") {
      return {
        ok: false,
        message:
          "This account is not an admin. Ask the owner to set your role in Supabase (profiles.role = admin).",
      };
    }
    return { ok: false, message: "Could not verify admin access." };
  }
  return { ok: true };
}

export async function signOutAdmin(supabase: SupabaseClient): Promise<void> {
  await supabase.auth.signOut();
}
