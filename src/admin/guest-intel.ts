import type { SupabaseClient } from "@supabase/supabase-js";

type Raw = Record<string, unknown>;

export type GuestEventRow = {
  id: string;
  club_slug: string;
  event_date: string;
  promoter_id: string | null;
  status: string;
  capacity: number;
};

export type GuestSignupRow = {
  id: string;
  guestlist_event_id: string;
  guest_profile_id: string;
  status: string;
  signup_at: string;
  guest_name: string;
  guest_phone: string | null;
  guest_instagram: string | null;
  guest_email: string | null;
  guest_age: number | null;
  guest_gender: string | null;
};

export type AudienceRow = {
  id: string;
  name: string;
  description: string;
  created_at: string;
};

function asNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function loadGuestEvents(
  supabase: SupabaseClient,
  from?: string,
  to?: string,
): Promise<{ ok: true; rows: GuestEventRow[] } | { ok: false; message: string }> {
  let q = supabase
    .from("guestlist_events")
    .select("id,club_slug,event_date,promoter_id,status,capacity")
    .order("event_date", { ascending: false });
  if (from) q = q.gte("event_date", from);
  if (to) q = q.lte("event_date", to);
  const { data, error } = await q;
  if (error) return { ok: false, message: error.message };
  const rows: GuestEventRow[] = (data ?? []).map((raw) => {
    const r = raw as Raw;
    return {
      id: String(r.id ?? ""),
      club_slug: String(r.club_slug ?? ""),
      event_date: String(r.event_date ?? ""),
      promoter_id: r.promoter_id != null ? String(r.promoter_id) : null,
      status: String(r.status ?? ""),
      capacity: asNum(r.capacity),
    };
  });
  return { ok: true, rows };
}

export async function loadGuestSignupsByEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ ok: true; rows: GuestSignupRow[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("guestlist_signups")
    .select(
      "id,guestlist_event_id,guest_profile_id,status,signup_at,guest_profiles(full_name,primary_phone,primary_instagram,primary_email,age,gender)",
    )
    .eq("guestlist_event_id", eventId)
    .order("signup_at", { ascending: true });
  if (error) return { ok: false, message: error.message };
  const rows: GuestSignupRow[] = (data ?? []).map((raw) => {
    const r = raw as Raw;
    const gp = (r.guest_profiles as Raw | null) ?? {};
    return {
      id: String(r.id ?? ""),
      guestlist_event_id: String(r.guestlist_event_id ?? ""),
      guest_profile_id: String(r.guest_profile_id ?? ""),
      status: String(r.status ?? ""),
      signup_at: String(r.signup_at ?? ""),
      guest_name: String(gp.full_name ?? ""),
      guest_phone: gp.primary_phone != null ? String(gp.primary_phone) : null,
      guest_instagram:
        gp.primary_instagram != null ? String(gp.primary_instagram) : null,
      guest_email: gp.primary_email != null ? String(gp.primary_email) : null,
      guest_age: gp.age != null ? asNum(gp.age) : null,
      guest_gender: gp.gender != null ? String(gp.gender) : null,
    };
  });
  return { ok: true, rows };
}

export async function checkInSignup(
  supabase: SupabaseClient,
  signupId: string,
  source: "self" | "promoter" | "admin",
  age?: number | null,
  gender?: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("promote_signup_to_attended", {
    p_signup_id: signupId,
    p_source: source,
    p_checked_in_by: null,
    p_age: age ?? null,
    p_gender: gender ?? null,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function loadConversionMetrics(
  supabase: SupabaseClient,
  input: { clubSlug?: string; promoterId?: string; from?: string; to?: string },
): Promise<
  | {
      ok: true;
      rows: Array<{
        event_id: string;
        club_slug: string;
        promoter_id: string | null;
        event_date: string;
        signups: number;
        attended: number;
        conversion: number;
      }>;
    }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase.rpc("get_guestlist_conversion_metrics", {
    p_club_slug: input.clubSlug ?? null,
    p_promoter_id: input.promoterId ?? null,
    p_from: input.from ?? null,
    p_to: input.to ?? null,
  });
  if (error) return { ok: false, message: error.message };
  const rows = (data as Raw[] | null ?? []).map((r) => ({
    event_id: String(r.event_id ?? ""),
    club_slug: String(r.club_slug ?? ""),
    promoter_id: r.promoter_id != null ? String(r.promoter_id) : null,
    event_date: String(r.event_date ?? ""),
    signups: asNum(r.signups),
    attended: asNum(r.attended),
    conversion: Number(r.conversion ?? 0),
  }));
  return { ok: true, rows };
}

export async function createAudience(
  supabase: SupabaseClient,
  name: string,
  description: string,
  minAttendedEvents: number,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("generate_campaign_audience", {
    p_name: name,
    p_description: description,
    p_filter_payload: { min_attended_events: minAttendedEvents },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, id: String(data ?? "") };
}

export async function loadAudiences(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: AudienceRow[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("campaign_audiences")
    .select("id,name,description,created_at")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows: AudienceRow[] = (data ?? []).map((raw) => {
    const r = raw as Raw;
    return {
      id: String(r.id ?? ""),
      name: String(r.name ?? ""),
      description: String(r.description ?? ""),
      created_at: String(r.created_at ?? ""),
    };
  });
  return { ok: true, rows };
}

export async function loadAudienceMembers(
  supabase: SupabaseClient,
  audienceId: string,
): Promise<
  | {
      ok: true;
      rows: Array<{
        guest_profile_id: string;
        full_name: string;
        phone: string | null;
        instagram: string | null;
        email: string | null;
      }>;
    }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from("campaign_audience_members")
    .select("guest_profile_id,guest_profiles(full_name,primary_phone,primary_instagram,primary_email)")
    .eq("audience_id", audienceId);
  if (error) return { ok: false, message: error.message };
  const rows = (data ?? []).map((raw) => {
    const r = raw as Raw;
    const gp = (r.guest_profiles as Raw | null) ?? {};
    return {
      guest_profile_id: String(r.guest_profile_id ?? ""),
      full_name: String(gp.full_name ?? ""),
      phone: gp.primary_phone != null ? String(gp.primary_phone) : null,
      instagram:
        gp.primary_instagram != null ? String(gp.primary_instagram) : null,
      email: gp.primary_email != null ? String(gp.primary_email) : null,
    };
  });
  return { ok: true, rows };
}
