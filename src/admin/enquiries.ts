import type { SupabaseClient } from "@supabase/supabase-js";

export type EnquiryRow = {
  id: string;
  created_at: string;
  submitted_at: string;
  form_name: string;
  form_label: string;
  service: string;
  status: string;
  source: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  payload: Record<string, unknown>;
};

export type EnquiryGuestRow = {
  id: string;
  guest_name: string;
  guest_contact: string;
  created_at: string;
};

export async function loadEnquiriesForAdmin(
  supabase: SupabaseClient,
  limit = 150,
): Promise<{ ok: true; rows: EnquiryRow[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("enquiries")
    .select(
      "id, created_at, submitted_at, form_name, form_label, service, status, source, name, email, phone, payload",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false, message: error.message };
  const rows = (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const payload =
      r.payload && typeof r.payload === "object"
        ? (r.payload as Record<string, unknown>)
        : {};
    return {
      id: String(r.id ?? ""),
      created_at: String(r.created_at ?? ""),
      submitted_at: String(r.submitted_at ?? ""),
      form_name: String(r.form_name ?? ""),
      form_label: String(r.form_label ?? ""),
      service: String(r.service ?? ""),
      status: String(r.status ?? ""),
      source: String(r.source ?? ""),
      name: r.name != null ? String(r.name) : null,
      email: r.email != null ? String(r.email) : null,
      phone: r.phone != null ? String(r.phone) : null,
      payload,
    };
  });
  return { ok: true, rows };
}

export async function loadEnquiryGuests(
  supabase: SupabaseClient,
  enquiryId: string,
): Promise<{ ok: true; rows: EnquiryGuestRow[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("enquiry_guests")
    .select("id, guest_name, guest_contact, created_at")
    .eq("enquiry_id", enquiryId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, message: error.message };
  const rows = (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      guest_name: String(r.guest_name ?? ""),
      guest_contact: String(r.guest_contact ?? ""),
      created_at: String(r.created_at ?? ""),
    };
  });
  return { ok: true, rows };
}

export async function updateEnquiryStatus(
  supabase: SupabaseClient,
  enquiryId: string,
  status: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("enquiries")
    .update({ status: status.trim() || "new" })
    .eq("id", enquiryId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
