import type { SupabaseClient } from "@supabase/supabase-js";

export type ClientRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  created_at: string;
  notes: string | null;
  guest_profile_id: string | null;
  typical_spend_gbp: number | null;
  preferred_nights: string | null;
  preferred_promoter_id: string | null;
  preferred_club_slug: string | null;
};

export type ClientGuestlistActivityRow = {
  id: string;
  club_slug: string;
  event_date: string;
  promoter_id: string | null;
  enquiry_id: string | null;
  guest_profile_id: string | null;
  created_at: string;
};

export type ClientAttendanceRow = {
  id: string;
  client_id: string;
  event_date: string;
  club_slug: string;
  promoter_id: string | null;
  spend_gbp: number;
  source: string;
  notes: string;
  created_at: string;
};

export async function loadClientsForAdmin(
  supabase: SupabaseClient,
  limit = 500,
): Promise<{ ok: true; rows: ClientRow[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, name, email, phone, instagram, created_at, notes, guest_profile_id, typical_spend_gbp, preferred_nights, preferred_promoter_id, preferred_club_slug",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false, message: error.message };
  const rows: ClientRow[] = (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const spendRaw = r.typical_spend_gbp;
    const spendNum =
      spendRaw == null || spendRaw === ""
        ? null
        : Number(spendRaw);
    return {
      id: String(r.id ?? ""),
      name: r.name != null ? String(r.name) : null,
      email: r.email != null ? String(r.email) : null,
      phone: r.phone != null ? String(r.phone) : null,
      instagram: r.instagram != null ? String(r.instagram) : null,
      created_at: String(r.created_at ?? ""),
      notes: r.notes != null ? String(r.notes) : null,
      guest_profile_id:
        r.guest_profile_id != null ? String(r.guest_profile_id) : null,
      typical_spend_gbp:
        spendNum != null && Number.isFinite(spendNum) ? spendNum : null,
      preferred_nights:
        r.preferred_nights != null ? String(r.preferred_nights) : null,
      preferred_promoter_id:
        r.preferred_promoter_id != null
          ? String(r.preferred_promoter_id)
          : null,
      preferred_club_slug:
        r.preferred_club_slug != null ? String(r.preferred_club_slug) : null,
    };
  });
  return { ok: true, rows };
}

export async function loadClientGuestlistActivityForAdmin(
  supabase: SupabaseClient,
  clientId: string,
): Promise<
  { ok: true; rows: ClientGuestlistActivityRow[] } | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from("client_guestlist_activity")
    .select(
      "id, club_slug, event_date, promoter_id, enquiry_id, guest_profile_id, created_at",
    )
    .eq("client_id", clientId)
    .order("event_date", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows: ClientGuestlistActivityRow[] = (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      club_slug: String(r.club_slug ?? ""),
      event_date: String(r.event_date ?? "").slice(0, 10),
      promoter_id: r.promoter_id != null ? String(r.promoter_id) : null,
      enquiry_id: r.enquiry_id != null ? String(r.enquiry_id) : null,
      guest_profile_id:
        r.guest_profile_id != null ? String(r.guest_profile_id) : null,
      created_at: String(r.created_at ?? ""),
    };
  });
  return { ok: true, rows };
}

export async function createEmptyClient(
  supabase: SupabaseClient,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: "New client",
      email: null,
      phone: null,
      instagram: null,
      notes: null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  const id = (data as { id?: string } | null)?.id;
  if (!id) return { ok: false, message: "No id returned." };
  return { ok: true, id: String(id) };
}

export async function updateClientById(
  supabase: SupabaseClient,
  id: string,
  patch: {
    name: string | null;
    email: string | null;
    phone: string | null;
    instagram: string | null;
    notes: string | null;
    typical_spend_gbp: number | null;
    preferred_nights: string | null;
    preferred_promoter_id: string | null;
    preferred_club_slug: string | null;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("clients")
    .update({
      name: patch.name,
      email: patch.email,
      phone: patch.phone,
      instagram: patch.instagram,
      notes: patch.notes,
      typical_spend_gbp: patch.typical_spend_gbp,
      preferred_nights: patch.preferred_nights,
      preferred_promoter_id: patch.preferred_promoter_id,
      preferred_club_slug: patch.preferred_club_slug,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function loadClientAttendancesForAdmin(
  supabase: SupabaseClient,
  clientId: string,
): Promise<
  { ok: true; rows: ClientAttendanceRow[] } | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from("client_attendances")
    .select(
      "id, client_id, event_date, club_slug, promoter_id, spend_gbp, source, notes, created_at",
    )
    .eq("client_id", clientId)
    .order("event_date", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows: ClientAttendanceRow[] = (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const spend = Number(r.spend_gbp ?? 0);
    return {
      id: String(r.id ?? ""),
      client_id: String(r.client_id ?? ""),
      event_date: String(r.event_date ?? "").slice(0, 10),
      club_slug: String(r.club_slug ?? ""),
      promoter_id: r.promoter_id != null ? String(r.promoter_id) : null,
      spend_gbp: Number.isFinite(spend) ? spend : 0,
      source: String(r.source ?? "manual"),
      notes: String(r.notes ?? ""),
      created_at: String(r.created_at ?? ""),
    };
  });
  return { ok: true, rows };
}

export async function saveClientAttendanceForAdmin(
  supabase: SupabaseClient,
  input: {
    id?: string;
    client_id: string;
    event_date: string;
    club_slug: string;
    promoter_id: string | null;
    spend_gbp: number;
    source?: string;
    notes?: string;
  },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const payload = {
    client_id: input.client_id,
    event_date: input.event_date,
    club_slug: input.club_slug,
    promoter_id: input.promoter_id,
    spend_gbp: Number(input.spend_gbp) || 0,
    source: (input.source || "manual").trim() || "manual",
    notes: (input.notes || "").trim(),
  };
  if (input.id?.trim()) {
    const id = input.id.trim();
    const { error } = await supabase.from("client_attendances").update(payload).eq("id", id);
    if (error) return { ok: false, message: error.message };
    return { ok: true, id };
  }
  const { data, error } = await supabase
    .from("client_attendances")
    .insert(payload)
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  return { ok: true, id: String((data as { id?: string } | null)?.id ?? "") };
}

export async function deleteClientAttendanceForAdmin(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("client_attendances").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteClientById(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
