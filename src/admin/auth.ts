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

function isEmailRateLimitError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("email rate limit") || m.includes("over_email_send_rate_limit");
}

async function ensurePromoterRows(
  supabase: SupabaseClient,
  input: {
    userId: string;
    email: string;
    displayName?: string;
    bio?: string;
    profileImageUrl?: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const displayName = (input.displayName || input.email).trim() || input.email;
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: input.userId,
      role: "promoter",
      display_name: displayName,
    },
    { onConflict: "id" },
  );
  if (profileError) return { ok: false, message: profileError.message };

  const { data: existing, error: selErr } = await supabase
    .from("promoters")
    .select("bio, profile_image_url, approval_status, is_approved")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (selErr) return { ok: false, message: selErr.message };

  const isNew = !existing;
  const bio = isNew
    ? (input.bio || "").trim()
    : input.bio !== undefined
      ? (input.bio || "").trim()
      : String(existing.bio ?? "");
  const profileImageUrl = isNew
    ? (input.profileImageUrl || "").trim()
    : input.profileImageUrl !== undefined
      ? (input.profileImageUrl || "").trim()
      : String(existing.profile_image_url ?? "");
  const approvalStatus = isNew
    ? "pending"
    : (String(existing.approval_status ?? "pending") as "pending" | "approved" | "rejected");
  const isApproved = isNew ? false : Boolean(existing.is_approved);

  const { error: promoterError } = await supabase.from("promoters").upsert(
    {
      user_id: input.userId,
      display_name: displayName,
      bio,
      profile_image_url: profileImageUrl,
      approval_status: approvalStatus,
      is_approved: isApproved,
    },
    { onConflict: "user_id" },
  );
  if (promoterError) return { ok: false, message: promoterError.message };
  return { ok: true };
}

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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return { ok: false, message: error.message };
  const userId = data.user?.id || data.session?.user?.id;
  if (userId) {
    const seeded = await ensurePromoterRows(supabase, {
      userId,
      email: email.trim().toLowerCase(),
      displayName: String(data.user?.user_metadata?.display_name || ""),
    });
    if (!seeded.ok) return seeded;
  }
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

/**
 * Legacy self-signup with password on the client.
 * The promoter portal now uses `promoter_signup_requests` + admin approval; this remains for scripts or emergencies.
 */
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
    options: {
      data: {
        role: "promoter",
        display_name: displayName || email,
      },
    },
  });
  if (error) {
    if (isEmailRateLimitError(error.message)) {
      // If the account already exists and is confirmed, sign in directly instead of
      // repeatedly triggering confirmation email limits.
      const signIn = await signInPromoter(supabase, email, input.password);
      if (signIn.ok) return { ok: true };
      return {
        ok: false,
        message:
          "Email sending is temporarily rate-limited by Supabase. If you already created this account, sign in instead. Otherwise wait a few minutes and try again.",
      };
    }
    return { ok: false, message: error.message };
  }
  const userId = data.session?.user?.id || data.user?.id;
  if (!userId) return { ok: true };
  if (!data.session) {
    // Email confirmation flows may not include an authenticated session yet.
    // Seed rows after first successful sign-in to avoid RLS failures.
    return { ok: true };
  }
  return ensurePromoterRows(supabase, {
    userId,
    email,
    displayName: displayName || email,
    bio,
    profileImageUrl,
  });
}
