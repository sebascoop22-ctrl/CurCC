import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AppRole = "admin" | "host" | "promoter";

export type AdminGateResult =
  | { ok: true; user: User; role: "admin" }
  | { ok: false; reason: string };

export type PromoterGateResult =
  | { ok: true; user: User; role: "promoter"; promoterId: string | null }
  | { ok: false; reason: string };

type ProfileRow = {
  role: AppRole;
};

async function fetchSessionAndRole(
  supabase: SupabaseClient,
): Promise<
  | { ok: true; user: User; role: AppRole }
  | { ok: false; reason: string }
> {
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
  if (profileError || !profile) {
    return { ok: false, reason: "profile_error" };
  }
  return {
    ok: true,
    user: session.user,
    role: (profile as ProfileRow).role,
  };
}

export async function gateAdminUser(
  supabase: SupabaseClient,
): Promise<AdminGateResult> {
  const gate = await fetchSessionAndRole(supabase);
  if (!gate.ok) return gate;
  if (gate.role !== "admin") {
    return { ok: false, reason: "not_admin" };
  }
  return { ok: true, user: gate.user, role: "admin" };
}

export async function gatePromoterUser(
  supabase: SupabaseClient,
): Promise<PromoterGateResult> {
  const gate = await fetchSessionAndRole(supabase);
  if (!gate.ok) return gate;
  if (gate.role !== "promoter") {
    return { ok: false, reason: "not_promoter" };
  }
  const { data: promoter, error } = await supabase
    .from("promoters")
    .select("id")
    .eq("user_id", gate.user.id)
    .maybeSingle();
  if (error) return { ok: false, reason: "promoter_profile_error" };
  return {
    ok: true,
    user: gate.user,
    role: "promoter",
    promoterId: promoter?.id ? String(promoter.id) : null,
  };
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

export async function signInPromoter(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return { ok: false, message: error.message };
  const gate = await gatePromoterUser(supabase);
  if (!gate.ok) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message:
        gate.reason === "not_promoter"
          ? "This account is not a promoter account."
          : "Could not verify promoter access.",
    };
  }
  return { ok: true };
}

export async function signUpPromoter(
  supabase: SupabaseClient,
  input: {
    email: string;
    password: string;
    displayName: string;
    bio: string;
    profileImageUrl: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const bio = input.bio.trim();
  const profileImageUrl = input.profileImageUrl.trim();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
  });
  if (error) return { ok: false, message: error.message };
  const userId = data.user?.id;
  if (!userId) {
    return {
      ok: false,
      message: "Signup started, but no user session returned.",
    };
  }
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      role: "promoter",
      display_name: displayName || email,
    },
    { onConflict: "id" },
  );
  if (profileError) return { ok: false, message: profileError.message };
  const { error: promoterError } = await supabase.from("promoters").upsert(
    {
      user_id: userId,
      display_name: displayName || email,
      bio,
      profile_image_url: profileImageUrl,
      approval_status: "pending",
      is_approved: false,
    },
    { onConflict: "user_id" },
  );
  if (promoterError) return { ok: false, message: promoterError.message };
  return { ok: true };
}
