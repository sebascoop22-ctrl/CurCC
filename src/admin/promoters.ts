import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PromoterAvailabilitySlot,
  PromoterClubPreference,
  PromoterInvoice,
  PromoterJob,
  PromoterProfile,
  PromoterSignupRequest,
} from "../types";

type Raw = Record<string, unknown>;

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function loadPromoterSignupRequestsForAdmin(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: PromoterSignupRequest[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("promoter_signup_requests")
    .select(
      "id,full_name,email,status,created_at,reviewed_at,reviewed_by,denial_reason,auth_user_id",
    )
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows: PromoterSignupRequest[] = (data ?? []).map((raw) => {
    const r = raw as Raw;
    return {
      id: String(r.id ?? ""),
      fullName: String(r.full_name ?? ""),
      email: String(r.email ?? ""),
      status: String(r.status ?? "pending") as PromoterSignupRequest["status"],
      createdAt: String(r.created_at ?? ""),
      reviewedAt: r.reviewed_at != null ? String(r.reviewed_at) : null,
      reviewedBy: r.reviewed_by != null ? String(r.reviewed_by) : null,
      denialReason: r.denial_reason != null ? String(r.denial_reason) : null,
      authUserId: r.auth_user_id != null ? String(r.auth_user_id) : null,
    };
  });
  rows.sort((a, b) => {
    const pri = (s: PromoterSignupRequest["status"]) =>
      s === "pending" ? 0 : s === "approved" ? 1 : 2;
    const d = pri(a.status) - pri(b.status);
    if (d !== 0) return d;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return { ok: true, rows };
}

export async function loadPromotersForAdmin(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: PromoterProfile[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("promoters")
    .select("id,user_id,display_name,bio,profile_image_url,is_approved,approval_status,approval_notes")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows: PromoterProfile[] = (data ?? []).map((raw) => {
    const r = raw as Raw;
    return {
      id: String(r.id ?? ""),
      userId: String(r.user_id ?? ""),
      displayName: String(r.display_name ?? ""),
      bio: String(r.bio ?? ""),
      profileImageUrl: String(r.profile_image_url ?? ""),
      isApproved: Boolean(r.is_approved),
      approvalStatus:
        String(r.approval_status ?? "pending") as PromoterProfile["approvalStatus"],
      approvalNotes: String(r.approval_notes ?? ""),
    };
  });
  return { ok: true, rows };
}

export type PromoterRevisionRow = {
  id: string;
  promoter_id: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  review_notes: string;
  created_at: string;
  reviewed_at: string | null;
};

export async function loadPromoterRevisionsForAdmin(
  supabase: SupabaseClient,
  promoterId?: string,
): Promise<{ ok: true; rows: PromoterRevisionRow[] } | { ok: false; message: string }> {
  let q = supabase
    .from("promoter_profile_revisions")
    .select("id,promoter_id,payload,status,review_notes,created_at,reviewed_at")
    .order("created_at", { ascending: false });
  if (promoterId?.trim()) q = q.eq("promoter_id", promoterId.trim());
  const { data, error } = await q;
  if (error) return { ok: false, message: error.message };
  const rows: PromoterRevisionRow[] = (data ?? []).map((raw) => {
    const r = raw as Raw;
    return {
      id: String(r.id ?? ""),
      promoter_id: String(r.promoter_id ?? ""),
      payload:
        r.payload && typeof r.payload === "object"
          ? (r.payload as Record<string, unknown>)
          : {},
      status: String(r.status ?? "pending") as PromoterRevisionRow["status"],
      review_notes: String(r.review_notes ?? ""),
      created_at: String(r.created_at ?? ""),
      reviewed_at: r.reviewed_at != null ? String(r.reviewed_at) : null,
    };
  });
  return { ok: true, rows };
}

export async function approvePromoterRevision(
  supabase: SupabaseClient,
  revisionId: string,
  approve: boolean,
  reviewNotes: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("approve_promoter_profile_revision", {
    p_revision_id: revisionId,
    p_approve: approve,
    p_review_notes: reviewNotes,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function loadPromoterByUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true; row: PromoterProfile | null } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("promoters")
    .select("id,user_id,display_name,bio,profile_image_url,is_approved,approval_status,approval_notes")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: true, row: null };
  const r = data as Raw;
  return {
    ok: true,
    row: {
      id: String(r.id ?? ""),
      userId: String(r.user_id ?? ""),
      displayName: String(r.display_name ?? ""),
      bio: String(r.bio ?? ""),
      profileImageUrl: String(r.profile_image_url ?? ""),
      isApproved: Boolean(r.is_approved),
      approvalStatus:
        String(r.approval_status ?? "pending") as PromoterProfile["approvalStatus"],
      approvalNotes: String(r.approval_notes ?? ""),
    },
  };
}

export async function submitPromoterRevision(
  supabase: SupabaseClient,
  promoterId: string,
  payload: {
    display_name: string;
    bio: string;
    profile_image_url: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("promoter_profile_revisions").insert({
    promoter_id: promoterId,
    payload,
    status: "pending",
  });
  if (error) return { ok: false, message: error.message };
  const { error: pErr } = await supabase
    .from("promoters")
    .update({
      approval_status: "pending",
      approval_notes: "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", promoterId);
  if (pErr) return { ok: false, message: pErr.message };
  return { ok: true };
}

export async function loadPromoterAvailability(
  supabase: SupabaseClient,
  promoterId: string,
): Promise<{ ok: true; rows: PromoterAvailabilitySlot[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("promoter_availability")
    .select("id,promoter_id,weekday,is_available,start_time,end_time")
    .eq("promoter_id", promoterId)
    .order("weekday", { ascending: true });
  if (error) return { ok: false, message: error.message };
  const rows: PromoterAvailabilitySlot[] = (data ?? []).map((raw) => {
    const r = raw as Raw;
    return {
      id: String(r.id ?? ""),
      promoterId: String(r.promoter_id ?? ""),
      weekday: asNumber(r.weekday),
      isAvailable: Boolean(r.is_available),
      startTime: r.start_time != null ? String(r.start_time) : null,
      endTime: r.end_time != null ? String(r.end_time) : null,
    };
  });
  return { ok: true, rows };
}

export async function savePromoterAvailability(
  supabase: SupabaseClient,
  promoterId: string,
  rows: Array<{
    weekday: number;
    is_available: boolean;
    start_time: string | null;
    end_time: string | null;
  }>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload = rows.map((r) => ({
    promoter_id: promoterId,
    weekday: r.weekday,
    is_available: r.is_available,
    start_time: r.start_time,
    end_time: r.end_time,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("promoter_availability")
    .upsert(payload, { onConflict: "promoter_id,weekday" });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function loadPromoterPreferences(
  supabase: SupabaseClient,
  promoterId: string,
): Promise<{ ok: true; rows: PromoterClubPreference[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("promoter_club_preferences")
    .select("id,promoter_id,club_slug,weekdays,notes,status")
    .eq("promoter_id", promoterId)
    .order("club_slug", { ascending: true });
  if (error) return { ok: false, message: error.message };
  const rows: PromoterClubPreference[] = (data ?? []).map((raw) => {
    const r = raw as Raw;
    return {
      id: String(r.id ?? ""),
      promoterId: String(r.promoter_id ?? ""),
      clubSlug: String(r.club_slug ?? ""),
      weekdays: Array.isArray(r.weekdays) ? r.weekdays.map(String) : [],
      notes: String(r.notes ?? ""),
      status:
        String(r.status ?? "pending") as PromoterClubPreference["status"],
    };
  });
  return { ok: true, rows };
}

export async function savePromoterPreference(
  supabase: SupabaseClient,
  promoterId: string,
  input: {
    club_slug: string;
    weekdays: string[];
    notes: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("promoter_club_preferences")
    .upsert(
      {
        promoter_id: promoterId,
        club_slug: input.club_slug,
        weekdays: input.weekdays,
        notes: input.notes,
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "promoter_id,club_slug" },
    );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function loadPromoterJobs(
  supabase: SupabaseClient,
  promoterId: string,
): Promise<{ ok: true; rows: PromoterJob[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("promoter_jobs")
    .select("id,promoter_id,club_slug,service,job_date,status,guests_count,shift_fee,guestlist_fee,notes")
    .eq("promoter_id", promoterId)
    .order("job_date", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows: PromoterJob[] = (data ?? []).map((raw) => {
    const r = raw as Raw;
    return {
      id: String(r.id ?? ""),
      promoterId: String(r.promoter_id ?? ""),
      clubSlug: r.club_slug != null ? String(r.club_slug) : null,
      service: String(r.service ?? ""),
      jobDate: String(r.job_date ?? ""),
      status: String(r.status ?? "assigned") as PromoterJob["status"],
      guestsCount: asNumber(r.guests_count),
      shiftFee: asNumber(r.shift_fee),
      guestlistFee: asNumber(r.guestlist_fee),
      notes: String(r.notes ?? ""),
    };
  });
  return { ok: true, rows };
}

export async function loadPromoterInvoices(
  supabase: SupabaseClient,
  promoterId: string,
): Promise<{ ok: true; rows: PromoterInvoice[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("promoter_invoices")
    .select("id,promoter_id,period_start,period_end,status,subtotal,adjustments,total")
    .eq("promoter_id", promoterId)
    .order("period_end", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows: PromoterInvoice[] = (data ?? []).map((raw) => {
    const r = raw as Raw;
    return {
      id: String(r.id ?? ""),
      promoterId: String(r.promoter_id ?? ""),
      periodStart: String(r.period_start ?? ""),
      periodEnd: String(r.period_end ?? ""),
      status: String(r.status ?? "draft") as PromoterInvoice["status"],
      subtotal: asNumber(r.subtotal),
      adjustments: asNumber(r.adjustments),
      total: asNumber(r.total),
    };
  });
  return { ok: true, rows };
}

export async function createPromoterJob(
  supabase: SupabaseClient,
  input: {
    promoter_id: string;
    club_slug: string | null;
    service: string;
    job_date: string;
    shift_fee: number;
    guestlist_fee: number;
    guests_count: number;
    notes: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("promoter_jobs").insert({
    ...input,
    status: "assigned",
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function completePromoterJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("promoter_jobs")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .select("id,promoter_id,job_date,shift_fee,guestlist_fee,guests_count")
    .single();
  if (error) return { ok: false, message: error.message };
  const r = data as Raw;
  const promoterId = String(r.promoter_id ?? "");
  const jobDate = String(r.job_date ?? "");
  const shiftFee = asNumber(r.shift_fee);
  const guestlistFee = asNumber(r.guestlist_fee) * asNumber(r.guests_count);
  const amount = shiftFee + guestlistFee;
  const { error: earnErr } = await supabase.from("promoter_earnings").insert({
    promoter_id: promoterId,
    promoter_job_id: String(r.id ?? ""),
    earning_date: jobDate,
    source: "job",
    amount,
    notes: "Auto from completed job",
  });
  if (earnErr) return { ok: false, message: earnErr.message };
  const { error: txErr } = await supabase.from("financial_transactions").insert({
    tx_date: jobDate,
    category: "promoter_payout",
    direction: "expense",
    amount,
    currency: "GBP",
    source_type: "promoter_job",
    source_ref: String(r.id ?? ""),
    notes: "Auto expense from completed promoter job",
  });
  if (txErr) return { ok: false, message: txErr.message };
  return { ok: true };
}

export async function generateInvoiceForPromoter(
  supabase: SupabaseClient,
  promoterId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ ok: true; invoiceId: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("generate_promoter_invoice", {
    p_promoter_id: promoterId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, invoiceId: String(data ?? "") };
}

export async function getFinancialReport(
  supabase: SupabaseClient,
  periodType: "month" | "tax_year",
  fromDate: string,
  toDate: string,
): Promise<
  | {
      ok: true;
      rows: Array<{ period_label: string; income: number; expense: number; net: number }>;
    }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase.rpc("get_financial_report", {
    p_period_type: periodType,
    p_from: fromDate,
    p_to: toDate,
  });
  if (error) return { ok: false, message: error.message };
  const rows = (data as Raw[] | null ?? []).map((r) => ({
    period_label: String(r.period_label ?? ""),
    income: asNumber(r.income),
    expense: asNumber(r.expense),
    net: asNumber(r.net),
  }));
  return { ok: true, rows };
}

