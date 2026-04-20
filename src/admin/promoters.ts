import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PaymentDetails,
  TaxDetails,
  FinancialDirection,
  FinancialPayee,
  FinancialPeriodSummary,
  FinancialRecurringTemplate,
  FinancialStatus,
  FinancialTransactionRow,
  PromoterAvailabilitySlot,
  PromoterClubPreference,
  PromoterGuestlistEntry,
  PromoterGuestlistQueueRow,
  PromoterInvoice,
  PromoterJob,
  PromoterJobAdminRow,
  PromoterNightAdjustment,
  PromoterNightAdjustmentQueueRow,
  PromoterProfile,
  PromoterSignupRequest,
  PromoterTableSale,
  PromoterTableSaleQueueRow,
  PromoterTableSaleReportRow,
} from "../types";

type Raw = Record<string, unknown>;

function emptyPaymentDetails(): PaymentDetails {
  return {
    method: "",
    beneficiaryName: "",
    accountNumber: "",
    sortCode: "",
    iban: "",
    swiftBic: "",
    reference: "",
    payoutEmail: "",
  };
}

function emptyTaxDetails(): TaxDetails {
  return {
    registeredName: "",
    taxId: "",
    vatNumber: "",
    countryCode: "",
    isVatRegistered: false,
    notes: "",
  };
}

function parsePaymentDetails(raw: unknown): PaymentDetails {
  const r = raw && typeof raw === "object" ? (raw as Raw) : {};
  const base = emptyPaymentDetails();
  return {
    method: String(r.method ?? base.method).trim(),
    beneficiaryName: String(r.beneficiaryName ?? r.beneficiary_name ?? base.beneficiaryName).trim(),
    accountNumber: String(r.accountNumber ?? r.account_number ?? base.accountNumber).trim(),
    sortCode: String(r.sortCode ?? r.sort_code ?? base.sortCode).trim(),
    iban: String(r.iban ?? base.iban).trim(),
    swiftBic: String(r.swiftBic ?? r.swift_bic ?? base.swiftBic).trim(),
    reference: String(r.reference ?? base.reference).trim(),
    payoutEmail: String(r.payoutEmail ?? r.payout_email ?? base.payoutEmail).trim(),
  };
}

function parseTaxDetails(raw: unknown): TaxDetails {
  const r = raw && typeof raw === "object" ? (raw as Raw) : {};
  const base = emptyTaxDetails();
  return {
    registeredName: String(r.registeredName ?? r.registered_name ?? base.registeredName).trim(),
    taxId: String(r.taxId ?? r.tax_id ?? base.taxId).trim(),
    vatNumber: String(r.vatNumber ?? r.vat_number ?? base.vatNumber).trim(),
    countryCode: String(r.countryCode ?? r.country_code ?? base.countryCode).trim().toUpperCase(),
    isVatRegistered: Boolean(r.isVatRegistered ?? r.is_vat_registered ?? base.isVatRegistered),
    notes: String(r.notes ?? base.notes).trim(),
  };
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseJsonbStringArray(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    const s = String(x).trim();
    if (s) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function parsePgTextArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s.startsWith("{") && s.endsWith("}")) {
      const inner = s.slice(1, -1);
      if (!inner) return [];
      return inner
        .split(",")
        .map((p) => p.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
  }
  return [];
}

function mapPromoterRowToProfile(r: Raw): PromoterProfile {
  const imgs = parseJsonbStringArray(r.profile_image_urls, 12);
  const primary = String(r.profile_image_url ?? "").trim();
  const merged = imgs.length > 0 ? imgs : primary ? [primary] : [];
  return {
    id: String(r.id ?? ""),
    userId: String(r.user_id ?? ""),
    displayName: String(r.display_name ?? ""),
    bio: String(r.bio ?? ""),
    profileImageUrl: merged[0] ?? "",
    profileImageUrls: merged,
    portfolioClubSlugs: parsePgTextArray(r.portfolio_club_slugs),
    paymentDetails: parsePaymentDetails(r.payment_details),
    taxDetails: parseTaxDetails(r.tax_details),
    isApproved: Boolean(r.is_approved),
    approvalStatus:
      String(r.approval_status ?? "pending") as PromoterProfile["approvalStatus"],
    approvalNotes: String(r.approval_notes ?? ""),
  };
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
    .select(
      "id,user_id,display_name,bio,profile_image_url,profile_image_urls,portfolio_club_slugs,payment_details,tax_details,is_approved,approval_status,approval_notes",
    )
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows: PromoterProfile[] = (data ?? []).map((raw) => mapPromoterRowToProfile(raw as Raw));
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
    .select(
      "id,user_id,display_name,bio,profile_image_url,profile_image_urls,portfolio_club_slugs,payment_details,tax_details,is_approved,approval_status,approval_notes",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: true, row: null };
  return { ok: true, row: mapPromoterRowToProfile(data as Raw) };
}

export async function submitPromoterRevision(
  supabase: SupabaseClient,
  promoterId: string,
  payload: {
    display_name: string;
    bio: string;
    profile_image_url: string;
    profile_image_urls?: string[];
    portfolio_club_slugs?: string[];
    payment_details?: PaymentDetails;
    tax_details?: TaxDetails;
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

/** Inclusive date range `from` / `to` as YYYY-MM-DD (local calendar month). */
export async function loadPromoterJobsCalendar(
  supabase: SupabaseClient,
  opts: {
    from: string;
    to: string;
    promoterId?: string;
    clubSlug?: string;
  },
): Promise<{ ok: true; rows: PromoterJobAdminRow[] } | { ok: false; message: string }> {
  let q = supabase
    .from("promoter_jobs")
    .select(
      "id,promoter_id,club_slug,service,job_date,status,guests_count,shift_fee,guestlist_fee,notes",
    )
    .gte("job_date", opts.from)
    .lte("job_date", opts.to)
    .order("job_date", { ascending: true })
    .order("id", { ascending: true });
  if (opts.promoterId?.trim()) q = q.eq("promoter_id", opts.promoterId.trim());
  if (opts.clubSlug?.trim()) q = q.eq("club_slug", opts.clubSlug.trim());
  const { data, error } = await q;
  if (error) return { ok: false, message: error.message };
  const rawJobs: PromoterJob[] = (data ?? []).map((raw) => {
    const r = raw as Raw;
    return {
      id: String(r.id ?? ""),
      promoterId: String(r.promoter_id ?? ""),
      clubSlug: r.club_slug != null ? String(r.club_slug) : null,
      service: String(r.service ?? ""),
      jobDate: String(r.job_date ?? "").slice(0, 10),
      status: String(r.status ?? "assigned") as PromoterJob["status"],
      guestsCount: asNumber(r.guests_count),
      shiftFee: asNumber(r.shift_fee),
      guestlistFee: asNumber(r.guestlist_fee),
      notes: String(r.notes ?? ""),
    };
  });
  const promoterIds = [...new Set(rawJobs.map((j) => j.promoterId))];
  const nameById = new Map<string, string>();
  if (promoterIds.length) {
    const { data: promData, error: pErr } = await supabase
      .from("promoters")
      .select("id,display_name")
      .in("id", promoterIds);
    if (pErr) return { ok: false, message: pErr.message };
    for (const row of promData ?? []) {
      const r = row as Raw;
      nameById.set(
        String(r.id ?? ""),
        String(r.display_name ?? "").trim() || String(r.id ?? "").slice(0, 8),
      );
    }
  }
  const rows: PromoterJobAdminRow[] = rawJobs.map((j) => ({
    ...j,
    promoterDisplayName:
      nameById.get(j.promoterId) || `${j.promoterId.slice(0, 8)}…`,
  }));
  return { ok: true, rows };
}

export async function updatePromoterJob(
  supabase: SupabaseClient,
  jobId: string,
  patch: Partial<{
    club_slug: string | null;
    service: string;
    job_date: string;
    status: PromoterJob["status"];
    guests_count: number;
    shift_fee: number;
    guestlist_fee: number;
    notes: string;
  }>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) payload[k] = v;
  }
  if (Object.keys(payload).length <= 1) {
    return { ok: false, message: "Nothing to update." };
  }
  const { error } = await supabase
    .from("promoter_jobs")
    .update(payload)
    .eq("id", jobId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/**
 * Remove a promoter job and any admin-created side effects from “complete job”:
 * `financial_transactions` (source_type promoter_job) and `promoter_earnings` rows
 * tied to this job, then the job row. Runs in one DB transaction via
 * `public.delete_promoter_job_safe`. Guestlist entries cascade on job delete;
 * invoice lines get `promoter_job_id` set null by FK.
 */
export async function deletePromoterJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<
  | { ok: true; clearedFinancialTx: number; clearedEarnings: number }
  | { ok: false; message: string }
> {
  const id = jobId.trim();
  if (!id) return { ok: false, message: "Missing job id." };

  const { data, error } = await supabase.rpc("delete_promoter_job_safe", {
    p_job_id: id,
  });
  if (error) return { ok: false, message: error.message };

  const raw = data as Raw | null;
  if (!raw || raw.ok !== true) {
    const errMsg =
      typeof raw?.error === "string" ? raw.error : "Delete failed.";
    return { ok: false, message: errMsg };
  }
  return {
    ok: true,
    clearedFinancialTx: asNumber(raw.clearedFinancialTx),
    clearedEarnings: asNumber(raw.clearedEarnings),
  };
}

export async function loadPromoterInvoices(
  supabase: SupabaseClient,
  promoterId: string,
): Promise<{ ok: true; rows: PromoterInvoice[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("promoter_invoices")
    .select(
      "id,promoter_id,period_start,period_end,status,subtotal,adjustments,total,sent_at,sent_to_email,emailed_via",
    )
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
      sentAt: r.sent_at != null ? String(r.sent_at) : null,
      sentToEmail: String(r.sent_to_email ?? ""),
      emailedVia: String(r.emailed_via ?? ""),
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

function parseGuestlistEntryRow(raw: Raw): PromoterGuestlistEntry {
  const st = String(raw.approval_status ?? "pending");
  const approvalStatus: PromoterGuestlistEntry["approvalStatus"] =
    st === "approved" || st === "rejected" || st === "pending" ? st : "pending";
  return {
    id: String(raw.id ?? ""),
    promoterJobId: String(raw.promoter_job_id ?? ""),
    guestName: String(raw.guest_name ?? ""),
    guestContact: String(raw.guest_contact ?? ""),
    approvalStatus,
    createdAt: String(raw.created_at ?? ""),
    reviewedAt: raw.reviewed_at != null ? String(raw.reviewed_at) : null,
    reviewNotes: String(raw.review_notes ?? ""),
  };
}

/** Guestlist rows for the given job ids (promoter or admin RLS). */
export async function loadPromoterGuestlistEntriesForJobs(
  supabase: SupabaseClient,
  jobIds: string[],
): Promise<{ ok: true; rows: PromoterGuestlistEntry[] } | { ok: false; message: string }> {
  const ids = [...new Set(jobIds.map((x) => x.trim()).filter(Boolean))];
  if (!ids.length) return { ok: true, rows: [] };
  const { data, error } = await supabase
    .from("promoter_guestlist_entries")
    .select(
      "id,promoter_job_id,guest_name,guest_contact,approval_status,created_at,reviewed_at,review_notes",
    )
    .in("promoter_job_id", ids)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, message: error.message };
  const rows = (data ?? []).map((raw) => parseGuestlistEntryRow(raw as Raw));
  return { ok: true, rows };
}

/** Admin: pending guestlist names submitted by promoters. */
export async function loadPendingGuestlistQueueForAdmin(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: PromoterGuestlistQueueRow[] } | { ok: false; message: string }> {
  const { data: entries, error: e1 } = await supabase
    .from("promoter_guestlist_entries")
    .select(
      "id,promoter_job_id,guest_name,guest_contact,approval_status,created_at,reviewed_at,review_notes",
    )
    .eq("approval_status", "pending")
    .order("created_at", { ascending: true });
  if (e1) return { ok: false, message: e1.message };
  const list = entries ?? [];
  if (!list.length) return { ok: true, rows: [] };
  const jobIds = [...new Set(list.map((x) => String((x as Raw).promoter_job_id ?? "")).filter(Boolean))];
  const { data: jobs, error: e2 } = await supabase
    .from("promoter_jobs")
    .select("id,job_date,club_slug,promoter_id,promoters(display_name)")
    .in("id", jobIds);
  if (e2) return { ok: false, message: e2.message };
  const jobMeta = new Map<
    string,
    { jobDate: string; clubSlug: string | null; promoterDisplayName: string }
  >();
  for (const row of jobs ?? []) {
    const r = row as Raw & { promoters?: { display_name?: string } | null };
    const id = String(r.id ?? "");
    const pr = r.promoters;
    jobMeta.set(id, {
      jobDate: String(r.job_date ?? "").slice(0, 10),
      clubSlug: r.club_slug != null ? String(r.club_slug) : null,
      promoterDisplayName: String(pr?.display_name ?? "").trim() || id.slice(0, 8),
    });
  }
  const rows: PromoterGuestlistQueueRow[] = list.map((raw) => {
    const e = parseGuestlistEntryRow(raw as Raw);
    const m = jobMeta.get(e.promoterJobId);
    return {
      ...e,
      jobDate: m?.jobDate ?? "",
      clubSlug: m?.clubSlug ?? null,
      promoterDisplayName: m?.promoterDisplayName ?? "",
    };
  });
  return { ok: true, rows };
}

export async function insertPromoterGuestlistEntry(
  supabase: SupabaseClient,
  input: { jobId: string; guestName: string; guestContact: string },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("insert_promoter_guestlist_entry", {
    p_job_id: input.jobId.trim(),
    p_guest_name: input.guestName.trim(),
    p_guest_contact: input.guestContact.trim(),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, id: String(data ?? "") };
}

export async function reviewGuestlistEntryAsAdmin(
  supabase: SupabaseClient,
  entryId: string,
  approve: boolean,
  reviewNotes: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("admin_review_guestlist_entry", {
    p_entry_id: entryId.trim(),
    p_approve: approve,
    p_review_notes: reviewNotes.trim(),
  });
  if (error) return { ok: false, message: error.message };
  const raw = data as Raw | null;
  if (!raw || raw.ok !== true) {
    const errMsg = typeof raw?.error === "string" ? raw.error : "Review failed.";
    return { ok: false, message: errMsg };
  }
  return { ok: true };
}

export async function completePromoterJob(
  supabase: SupabaseClient,
  jobId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = jobId.trim();
  if (!id) return { ok: false, message: "Missing job id." };

  const { data: pre, error: preErr } = await supabase
    .from("promoter_jobs")
    .select("id,promoter_id,job_date,shift_fee,guestlist_fee,guests_count")
    .eq("id", id)
    .maybeSingle();
  if (preErr) return { ok: false, message: preErr.message };
  if (!pre) return { ok: false, message: "Job not found." };

  const [{ count: nTotal, error: c1 }, { count: nApproved, error: c2 }] =
    await Promise.all([
      supabase
        .from("promoter_guestlist_entries")
        .select("*", { count: "exact", head: true })
        .eq("promoter_job_id", id),
      supabase
        .from("promoter_guestlist_entries")
        .select("*", { count: "exact", head: true })
        .eq("promoter_job_id", id)
        .eq("approval_status", "approved"),
    ]);
  if (c1 || c2) {
    return { ok: false, message: c1?.message || c2?.message || "Could not count guests." };
  }
  const totalEntries = nTotal ?? 0;
  const approved = nApproved ?? 0;
  const fallbackGuests = asNumber(pre.guests_count);
  const billingGuests = totalEntries > 0 ? approved : fallbackGuests;

  const { error: upErr } = await supabase
    .from("promoter_jobs")
    .update({
      status: "completed",
      guests_count: billingGuests,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (upErr) return { ok: false, message: upErr.message };

  const r = pre as Raw;
  const promoterId = String(r.promoter_id ?? "");
  const jobDate = String(r.job_date ?? "");
  const shiftFee = asNumber(r.shift_fee);
  const guestlistFee = asNumber(r.guestlist_fee) * billingGuests;
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

function mapNightAdjustmentRow(raw: Raw): PromoterNightAdjustment {
  const st = String(raw.status ?? "pending");
  const status: PromoterNightAdjustment["status"] =
    st === "approved" || st === "rejected" || st === "pending" ? st : "pending";
  return {
    id: String(raw.id ?? ""),
    promoterId: String(raw.promoter_id ?? ""),
    nightDate: String(raw.night_date ?? "").slice(0, 10),
    availableOverride: Boolean(raw.available_override),
    startTime: raw.start_time != null ? String(raw.start_time).slice(0, 5) : null,
    endTime: raw.end_time != null ? String(raw.end_time).slice(0, 5) : null,
    notes: String(raw.notes ?? ""),
    status,
    createdAt: String(raw.created_at ?? ""),
    reviewedAt: raw.reviewed_at != null ? String(raw.reviewed_at) : null,
    reviewNotes: String(raw.review_notes ?? ""),
  };
}

export async function loadPromoterNightAdjustments(
  supabase: SupabaseClient,
  promoterId: string,
): Promise<{ ok: true; rows: PromoterNightAdjustment[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("promoter_night_adjustments")
    .select(
      "id,promoter_id,night_date,available_override,start_time,end_time,notes,status,created_at,reviewed_at,review_notes",
    )
    .eq("promoter_id", promoterId)
    .order("night_date", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows = (data ?? []).map((raw) => mapNightAdjustmentRow(raw as Raw));
  return { ok: true, rows };
}

export async function upsertPromoterNightAdjustment(
  supabase: SupabaseClient,
  input: {
    nightDate: string;
    availableOverride: boolean;
    startTime: string | null;
    endTime: string | null;
    notes: string;
  },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const d = input.nightDate.trim().slice(0, 10);
  if (!d) return { ok: false, message: "Pick a date." };
  const { data, error } = await supabase.rpc("upsert_promoter_night_adjustment", {
    p_night_date: d,
    p_available_override: input.availableOverride,
    p_start_time: input.startTime?.trim() || null,
    p_end_time: input.endTime?.trim() || null,
    p_notes: input.notes.trim(),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, id: String(data ?? "") };
}

export async function loadPendingNightAdjustmentsForAdmin(
  supabase: SupabaseClient,
): Promise<
  { ok: true; rows: PromoterNightAdjustmentQueueRow[] } | { ok: false; message: string }
> {
  const { data: rowsRaw, error } = await supabase
    .from("promoter_night_adjustments")
    .select(
      "id,promoter_id,night_date,available_override,start_time,end_time,notes,status,created_at,reviewed_at,review_notes",
    )
    .eq("status", "pending")
    .order("night_date", { ascending: true });
  if (error) return { ok: false, message: error.message };
  const list = rowsRaw ?? [];
  if (!list.length) return { ok: true, rows: [] };
  const pids = [...new Set(list.map((x) => String((x as Raw).promoter_id ?? "")).filter(Boolean))];
  const { data: promData, error: pErr } = await supabase
    .from("promoters")
    .select("id,display_name")
    .in("id", pids);
  if (pErr) return { ok: false, message: pErr.message };
  const nameBy = new Map<string, string>();
  for (const pr of promData ?? []) {
    const r = pr as Raw;
    nameBy.set(
      String(r.id ?? ""),
      String(r.display_name ?? "").trim() || String(r.id ?? "").slice(0, 8),
    );
  }
  const rows: PromoterNightAdjustmentQueueRow[] = list.map((raw) => {
    const a = mapNightAdjustmentRow(raw as Raw);
    return {
      ...a,
      promoterDisplayName: nameBy.get(a.promoterId) ?? a.promoterId.slice(0, 8),
    };
  });
  return { ok: true, rows };
}

export async function reviewNightAdjustmentAsAdmin(
  supabase: SupabaseClient,
  adjustmentId: string,
  approve: boolean,
  reviewNotes: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("admin_review_night_adjustment", {
    p_adjustment_id: adjustmentId.trim(),
    p_approve: approve,
    p_review_notes: reviewNotes.trim(),
  });
  if (error) return { ok: false, message: error.message };
  const raw = data as Raw | null;
  if (!raw || raw.ok !== true) {
    const errMsg = typeof raw?.error === "string" ? raw.error : "Review failed.";
    return { ok: false, message: errMsg };
  }
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
  filters?: {
    direction?: FinancialDirection | "";
    status?: FinancialStatus | "";
    paymentTag?: string;
    payeeId?: string | null;
  },
): Promise<
  | {
      ok: true;
      rows: Array<{ period_label: string; income: number; expense: number; net: number }>;
    }
  | { ok: false; message: string }
> {
  const direction = filters?.direction?.trim() || null;
  const status = filters?.status?.trim() || null;
  const paymentTag = filters?.paymentTag?.trim() || null;
  const payeeId = filters?.payeeId?.trim() || null;
  const { data, error } = await supabase.rpc("get_financial_report", {
    p_period_type: periodType,
    p_from: fromDate,
    p_to: toDate,
    p_direction: direction,
    p_status: status,
    p_payment_tag: paymentTag,
    p_payee_id: payeeId,
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

function mapFinancialTxRow(raw: Raw): FinancialTransactionRow {
  const dir = String(raw.direction ?? "expense");
  const direction: FinancialTransactionRow["direction"] = dir === "income" ? "income" : "expense";
  const st = String(raw.status ?? "pending");
  const status: FinancialTransactionRow["status"] =
    st === "paid" || st === "cancelled" || st === "failed" || st === "pending" ? st : "pending";
  return {
    id: String(raw.id ?? ""),
    txDate: String(raw.tx_date ?? "").slice(0, 10),
    category: String(raw.category ?? ""),
    direction,
    status,
    paymentTag: String(raw.payment_tag ?? ""),
    amount: asNumber(raw.amount),
    currency: String(raw.currency ?? "GBP"),
    convertForeign: Boolean(raw.convert_foreign),
    sourceType: String(raw.source_type ?? ""),
    sourceRef: raw.source_ref != null ? String(raw.source_ref) : null,
    payeeId: raw.payee_id != null ? String(raw.payee_id) : null,
    payeeLabel: String(raw.payee_label ?? ""),
    notes: String(raw.notes ?? ""),
    createdAt: String(raw.created_at ?? ""),
  };
}

function mapRecurringTemplateRow(raw: Raw): FinancialRecurringTemplate {
  const dir = String(raw.direction ?? "expense");
  const direction: FinancialRecurringTemplate["direction"] =
    dir === "income" ? "income" : "expense";
  const st = String(raw.default_status ?? "pending");
  const defaultStatus: FinancialRecurringTemplate["defaultStatus"] =
    st === "paid" || st === "cancelled" || st === "failed" || st === "pending" ? st : "pending";
  const ru = String(raw.recurrence_unit ?? "custom_days");
  const recurrenceUnit: FinancialRecurringTemplate["recurrenceUnit"] =
    ru === "monthly" || ru === "quarterly" || ru === "annual" || ru === "custom_days"
      ? ru
      : "custom_days";
  return {
    id: String(raw.id ?? ""),
    label: String(raw.label ?? ""),
    category: String(raw.category ?? ""),
    direction,
    defaultStatus,
    paymentTag: String(raw.payment_tag ?? ""),
    amount: asNumber(raw.amount),
    currency: String(raw.currency ?? "GBP"),
    convertForeign: Boolean(raw.convert_foreign),
    payeeId: raw.payee_id != null ? String(raw.payee_id) : null,
    payeeLabel: String(raw.payee_label ?? ""),
    notes: String(raw.notes ?? ""),
    intervalDays: Math.max(1, Math.round(asNumber(raw.interval_days)) || 1),
    recurrenceUnit,
    recurrenceEvery: Math.max(1, Math.round(asNumber(raw.recurrence_every)) || 1),
    nextDueDate: String(raw.next_due_date ?? "").slice(0, 10),
    isActive: Boolean(raw.is_active),
    lastGeneratedOn: raw.last_generated_on != null ? String(raw.last_generated_on).slice(0, 10) : null,
    createdAt: String(raw.created_at ?? ""),
    updatedAt: String(raw.updated_at ?? ""),
  };
}

export async function loadFinancialTransactions(
  supabase: SupabaseClient,
  opts: {
    from: string;
    to: string;
    direction?: FinancialDirection | "";
    status?: FinancialStatus | "";
    paymentTag?: string;
    payeeId?: string | null;
  },
): Promise<{ ok: true; rows: FinancialTransactionRow[] } | { ok: false; message: string }> {
  const from = opts.from.trim().slice(0, 10);
  const to = opts.to.trim().slice(0, 10);
  if (!from || !to) return { ok: false, message: "Date range required." };
  let q = supabase
    .from("financial_transactions")
    .select(
      "id,tx_date,category,direction,status,payment_tag,amount,currency,convert_foreign,source_type,source_ref,payee_id,payee_label,notes,created_at",
    )
    .gte("tx_date", from)
    .lte("tx_date", to);
  const direction = opts.direction?.trim();
  if (direction) q = q.eq("direction", direction);
  const status = opts.status?.trim();
  if (status) q = q.eq("status", status);
  const paymentTag = opts.paymentTag?.trim();
  if (paymentTag) q = q.eq("payment_tag", paymentTag);
  const payeeId = opts.payeeId?.trim();
  if (payeeId) q = q.eq("payee_id", payeeId);
  const { data, error } = await q
    .order("tx_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return { ok: false, message: error.message };
  return { ok: true, rows: (data ?? []).map((x) => mapFinancialTxRow(x as Raw)) };
}

export async function insertFinancialTransaction(
  supabase: SupabaseClient,
  input: {
    txDate: string;
    category: string;
    direction: FinancialDirection;
    status: FinancialStatus;
    paymentTag: string;
    amount: number;
    currency: string;
    convertForeign: boolean;
    payeeId: string | null;
    payeeLabel: string;
    notes: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const txDate = input.txDate.trim().slice(0, 10);
  const category = input.category.trim();
  if (!txDate || !category) return { ok: false, message: "Date and category are required." };
  const { error } = await supabase.from("financial_transactions").insert({
    tx_date: txDate,
    category,
    direction: input.direction,
    status: input.status,
    payment_tag: input.paymentTag.trim(),
    amount: Number(input.amount) || 0,
    currency: input.currency.trim() || "GBP",
    convert_foreign: Boolean(input.convertForeign),
    source_type: "manual",
    payee_id: input.payeeId?.trim() || null,
    payee_label: input.payeeLabel.trim(),
    notes: input.notes.trim(),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function upsertFinancialTransaction(
  supabase: SupabaseClient,
  input: {
    id?: string;
    txDate: string;
    category: string;
    direction: FinancialDirection;
    status: FinancialStatus;
    paymentTag: string;
    amount: number;
    currency: string;
    convertForeign: boolean;
    payeeId: string | null;
    payeeLabel: string;
    notes: string;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const txDate = input.txDate.trim().slice(0, 10);
  const category = input.category.trim();
  if (!txDate || !category) return { ok: false, message: "Date and category are required." };
  const row = {
    id: input.id?.trim() || undefined,
    tx_date: txDate,
    category,
    direction: input.direction,
    status: input.status,
    payment_tag: input.paymentTag.trim(),
    amount: Number(input.amount) || 0,
    currency: input.currency.trim() || "GBP",
    convert_foreign: Boolean(input.convertForeign),
    source_type: "manual",
    payee_id: input.payeeId?.trim() || null,
    payee_label: input.payeeLabel.trim(),
    notes: input.notes.trim(),
  };
  const { error } = await supabase.from("financial_transactions").upsert(row, { onConflict: "id" });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function loadFinancialRecurringTemplates(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: FinancialRecurringTemplate[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("financial_recurring_templates")
    .select(
      "id,label,category,direction,default_status,payment_tag,amount,currency,convert_foreign,payee_id,payee_label,notes,interval_days,recurrence_unit,recurrence_every,next_due_date,is_active,last_generated_on,created_at,updated_at",
    )
    .order("next_due_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { ok: false, message: error.message };
  return { ok: true, rows: (data ?? []).map((x) => mapRecurringTemplateRow(x as Raw)) };
}

export async function upsertFinancialRecurringTemplate(
  supabase: SupabaseClient,
  input: {
    id?: string;
    label: string;
    category: string;
    direction: FinancialDirection;
    defaultStatus: FinancialStatus;
    paymentTag: string;
    amount: number;
    currency: string;
    convertForeign: boolean;
    payeeId: string | null;
    payeeLabel: string;
    notes: string;
    intervalDays: number;
    recurrenceUnit: FinancialRecurringTemplate["recurrenceUnit"];
    recurrenceEvery: number;
    nextDueDate: string;
    isActive: boolean;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const label = input.label.trim();
  const category = input.category.trim();
  const nextDueDate = input.nextDueDate.trim().slice(0, 10);
  if (!label || !category || !nextDueDate) {
    return { ok: false, message: "Label, category, and next due date are required." };
  }
  const row = {
    id: input.id?.trim() || undefined,
    label,
    category,
    direction: input.direction,
    default_status: input.defaultStatus,
    payment_tag: input.paymentTag.trim(),
    amount: Number(input.amount) || 0,
    currency: input.currency.trim() || "GBP",
    convert_foreign: Boolean(input.convertForeign),
    payee_id: input.payeeId?.trim() || null,
    payee_label: input.payeeLabel.trim(),
    notes: input.notes.trim(),
    interval_days: Math.max(1, Math.round(Number(input.intervalDays) || 1)),
    recurrence_unit: input.recurrenceUnit,
    recurrence_every: Math.max(1, Math.round(Number(input.recurrenceEvery) || 1)),
    next_due_date: nextDueDate,
    is_active: Boolean(input.isActive),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("financial_recurring_templates")
    .upsert(row, { onConflict: "id" });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function setFinancialRecurringTemplateActive(
  supabase: SupabaseClient,
  templateId: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = templateId.trim();
  if (!id) return { ok: false, message: "Missing template id." };
  const { error } = await supabase
    .from("financial_recurring_templates")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteFinancialRecurringTemplate(
  supabase: SupabaseClient,
  templateId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = templateId.trim();
  if (!id) return { ok: false, message: "Missing template id." };
  const { error } = await supabase
    .from("financial_recurring_templates")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function applyRecurringFinancialTransactions(
  supabase: SupabaseClient,
  throughDate: string,
): Promise<{ ok: true; createdRows: number } | { ok: false; message: string }> {
  const d = throughDate.trim().slice(0, 10);
  if (!d) return { ok: false, message: "Pick a through date." };
  const { data, error } = await supabase.rpc("apply_recurring_financial_transactions", {
    p_through: d,
  });
  if (error) return { ok: false, message: error.message };
  const raw = data as Raw | null;
  if (!raw || raw.ok !== true) {
    return { ok: false, message: String(raw?.error ?? "Recurring apply failed.") };
  }
  return { ok: true, createdRows: Math.max(0, Math.round(asNumber(raw.createdRows))) };
}

export async function getFinancialPeriodSummary(
  supabase: SupabaseClient,
  fromDate: string,
  toDate: string,
  filters?: {
    direction?: FinancialDirection | "";
    status?: FinancialStatus | "";
    paymentTag?: string;
    payeeId?: string | null;
  },
): Promise<{ ok: true; row: FinancialPeriodSummary } | { ok: false; message: string }> {
  const from = fromDate.trim().slice(0, 10);
  const to = toDate.trim().slice(0, 10);
  if (!from || !to) return { ok: false, message: "Date range required." };
  const { data, error } = await supabase.rpc("get_financial_period_summary", {
    p_from: from,
    p_to: to,
    p_direction: filters?.direction?.trim() || null,
    p_status: filters?.status?.trim() || null,
    p_payment_tag: filters?.paymentTag?.trim() || null,
    p_payee_id: filters?.payeeId?.trim() || null,
  });
  if (error) return { ok: false, message: error.message };
  const raw = (data as Raw[] | null)?.[0] ?? {};
  return {
    ok: true,
    row: {
      income: asNumber(raw.income),
      expense: asNumber(raw.expense),
      net: asNumber(raw.net),
      txCount: Math.max(0, Math.round(asNumber(raw.tx_count))),
    },
  };
}

function mapFinancialPayeeRow(raw: Raw): FinancialPayee {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    defaultPaymentTag: String(raw.default_payment_tag ?? ""),
    defaultCurrency: String(raw.default_currency ?? "GBP"),
    paymentDetails: parsePaymentDetails(raw.payment_details),
    taxDetails: parseTaxDetails(raw.tax_details),
    notes: String(raw.notes ?? ""),
    isActive: Boolean(raw.is_active),
    createdAt: String(raw.created_at ?? ""),
    updatedAt: String(raw.updated_at ?? ""),
  };
}

export async function loadFinancialPayees(
  supabase: SupabaseClient,
  opts?: { search?: string; activeOnly?: boolean },
): Promise<{ ok: true; rows: FinancialPayee[] } | { ok: false; message: string }> {
  let q = supabase
    .from("financial_payees")
    .select("id,name,default_payment_tag,default_currency,payment_details,tax_details,notes,is_active,created_at,updated_at");
  const search = opts?.search?.trim();
  if (search) q = q.ilike("name", `%${search.replace(/%/g, "")}%`);
  if (opts?.activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q.order("name", { ascending: true }).limit(300);
  if (error) return { ok: false, message: error.message };
  return { ok: true, rows: (data ?? []).map((x) => mapFinancialPayeeRow(x as Raw)) };
}

export async function upsertFinancialPayee(
  supabase: SupabaseClient,
  input: {
    id?: string;
    name: string;
    defaultPaymentTag: string;
    defaultCurrency: string;
    paymentDetails: PaymentDetails;
    taxDetails: TaxDetails;
    notes: string;
    isActive: boolean;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Payee name is required." };
  const row = {
    id: input.id?.trim() || undefined,
    name,
    default_payment_tag: input.defaultPaymentTag.trim(),
    default_currency: input.defaultCurrency.trim() || "GBP",
    payment_details: input.paymentDetails,
    tax_details: input.taxDetails,
    notes: input.notes.trim(),
    is_active: Boolean(input.isActive),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("financial_payees").upsert(row, { onConflict: "id" });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

function parseTableSaleRow(raw: Raw): PromoterTableSale {
  const ch = String(raw.entry_channel ?? "");
  const entryChannel: PromoterTableSale["entryChannel"] = ch === "admin" ? "admin" : "promoter";
  const tierRaw = String(raw.tier ?? "other").toLowerCase();
  const tier: PromoterTableSale["tier"] =
    tierRaw === "standard" || tierRaw === "luxury" || tierRaw === "vip" || tierRaw === "other"
      ? tierRaw
      : "other";
  const st = String(raw.approval_status ?? "pending");
  const approvalStatus: PromoterTableSale["approvalStatus"] =
    st === "approved" || st === "rejected" || st === "pending" ? st : "pending";
  return {
    id: String(raw.id ?? ""),
    promoterId: String(raw.promoter_id ?? ""),
    clubSlug: String(raw.club_slug ?? ""),
    saleDate: String(raw.sale_date ?? "").slice(0, 10),
    promoterJobId: raw.promoter_job_id != null ? String(raw.promoter_job_id) : null,
    entryChannel,
    tier,
    tableCount: Math.max(1, Math.round(asNumber(raw.table_count)) || 1),
    totalMinSpend: asNumber(raw.total_min_spend),
    notes: String(raw.notes ?? ""),
    approvalStatus,
    createdAt: String(raw.created_at ?? ""),
    reviewedAt: raw.reviewed_at != null ? String(raw.reviewed_at) : null,
    reviewNotes: String(raw.review_notes ?? ""),
  };
}

export async function loadPromoterTableSales(
  supabase: SupabaseClient,
  promoterId: string,
): Promise<{ ok: true; rows: PromoterTableSale[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("promoter_table_sales")
    .select(
      "id,promoter_id,club_slug,sale_date,promoter_job_id,entry_channel,tier,table_count,total_min_spend,notes,approval_status,created_at,reviewed_at,review_notes",
    )
    .eq("promoter_id", promoterId)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { ok: false, message: error.message };
  const rows = (data ?? []).map((raw) => parseTableSaleRow(raw as Raw));
  return { ok: true, rows };
}

export async function insertPromoterTableSale(
  supabase: SupabaseClient,
  input: {
    saleDate: string;
    clubSlug: string;
    promoterJobId: string | null;
    tier: string;
    tableCount: number;
    totalMinSpend: number;
    notes: string;
  },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const slug = input.clubSlug.trim();
  if (!slug) return { ok: false, message: "Choose a club." };
  const d = input.saleDate.trim().slice(0, 10);
  if (!d) return { ok: false, message: "Pick a date." };
  const jid = input.promoterJobId?.trim();
  const { data, error } = await supabase.rpc("insert_promoter_table_sale", {
    p_sale_date: d,
    p_club_slug: slug,
    p_promoter_job_id: jid ? jid : null,
    p_tier: input.tier.trim() || "other",
    p_table_count: Math.max(1, Math.round(Number(input.tableCount)) || 1),
    p_total_min_spend: Number(input.totalMinSpend) || 0,
    p_notes: input.notes.trim(),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, id: String(data ?? "") };
}

export async function loadPendingTableSalesQueueForAdmin(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: PromoterTableSaleQueueRow[] } | { ok: false; message: string }> {
  const { data: list, error } = await supabase
    .from("promoter_table_sales")
    .select(
      "id,promoter_id,club_slug,sale_date,promoter_job_id,entry_channel,tier,table_count,total_min_spend,notes,approval_status,created_at,reviewed_at,review_notes",
    )
    .eq("approval_status", "pending")
    .order("created_at", { ascending: true });
  if (error) return { ok: false, message: error.message };
  const rowsRaw = list ?? [];
  if (!rowsRaw.length) return { ok: true, rows: [] };
  const pids = [...new Set(rowsRaw.map((x) => String((x as Raw).promoter_id ?? "")).filter(Boolean))];
  const { data: promData, error: pErr } = await supabase
    .from("promoters")
    .select("id,display_name")
    .in("id", pids);
  if (pErr) return { ok: false, message: pErr.message };
  const nameBy = new Map<string, string>();
  for (const pr of promData ?? []) {
    const r = pr as Raw;
    nameBy.set(
      String(r.id ?? ""),
      String(r.display_name ?? "").trim() || String(r.id ?? "").slice(0, 8),
    );
  }
  const rows: PromoterTableSaleQueueRow[] = rowsRaw.map((raw) => {
    const s = parseTableSaleRow(raw as Raw);
    return {
      ...s,
      promoterDisplayName: nameBy.get(s.promoterId) ?? s.promoterId.slice(0, 8),
    };
  });
  return { ok: true, rows };
}

export async function loadTableSalesReportForAdmin(
  supabase: SupabaseClient,
  opts: { from: string; to: string; clubSlug?: string },
): Promise<{ ok: true; rows: PromoterTableSaleReportRow[] } | { ok: false; message: string }> {
  const from = opts.from.trim().slice(0, 10);
  const to = opts.to.trim().slice(0, 10);
  if (!from || !to) return { ok: false, message: "Date range required." };
  let q = supabase
    .from("promoter_table_sales")
    .select(
      "id,promoter_id,club_slug,sale_date,promoter_job_id,entry_channel,tier,table_count,total_min_spend,notes,approval_status,created_at,reviewed_at,review_notes",
    )
    .gte("sale_date", from)
    .lte("sale_date", to);
  const club = opts.clubSlug?.trim();
  if (club) q = q.eq("club_slug", club);
  const { data, error } = await q.order("sale_date", { ascending: false }).limit(500);
  if (error) return { ok: false, message: error.message };
  const list = data ?? [];
  if (!list.length) return { ok: true, rows: [] };
  const pids = [...new Set(list.map((x) => String((x as Raw).promoter_id ?? "")).filter(Boolean))];
  const { data: promData, error: pErr } = await supabase
    .from("promoters")
    .select("id,display_name")
    .in("id", pids);
  if (pErr) return { ok: false, message: pErr.message };
  const nameBy = new Map<string, string>();
  for (const pr of promData ?? []) {
    const r = pr as Raw;
    nameBy.set(
      String(r.id ?? ""),
      String(r.display_name ?? "").trim() || String(r.id ?? "").slice(0, 8),
    );
  }
  const rows: PromoterTableSaleReportRow[] = list.map((raw) => {
    const s = parseTableSaleRow(raw as Raw);
    return {
      ...s,
      promoterDisplayName: nameBy.get(s.promoterId) ?? s.promoterId.slice(0, 8),
    };
  });
  rows.sort((a, b) => {
    const d = b.saleDate.localeCompare(a.saleDate);
    if (d !== 0) return d;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return { ok: true, rows };
}

export async function adminInsertTableSale(
  supabase: SupabaseClient,
  input: {
    promoterId: string;
    saleDate: string;
    clubSlug: string;
    promoterJobId: string | null;
    tier: string;
    tableCount: number;
    totalMinSpend: number;
    notes: string;
  },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const pid = input.promoterId.trim();
  if (!pid) return { ok: false, message: "Choose a promoter." };
  const slug = input.clubSlug.trim();
  if (!slug) return { ok: false, message: "Choose a club." };
  const d = input.saleDate.trim().slice(0, 10);
  if (!d) return { ok: false, message: "Pick a date." };
  const jid = input.promoterJobId?.trim();
  const { data, error } = await supabase.rpc("admin_insert_table_sale", {
    p_promoter_id: pid,
    p_sale_date: d,
    p_club_slug: slug,
    p_promoter_job_id: jid ? jid : null,
    p_tier: input.tier.trim() || "other",
    p_table_count: Math.max(1, Math.round(Number(input.tableCount)) || 1),
    p_total_min_spend: Number(input.totalMinSpend) || 0,
    p_notes: input.notes.trim(),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, id: String(data ?? "") };
}

export async function reviewTableSaleAsAdmin(
  supabase: SupabaseClient,
  entryId: string,
  approve: boolean,
  reviewNotes: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("admin_review_table_sale", {
    p_entry_id: entryId.trim(),
    p_approve: approve,
    p_review_notes: reviewNotes.trim(),
  });
  if (error) return { ok: false, message: error.message };
  const raw = data as Raw | null;
  if (!raw || raw.ok !== true) {
    const errMsg = typeof raw?.error === "string" ? raw.error : "Review failed.";
    return { ok: false, message: errMsg };
  }
  return { ok: true };
}

