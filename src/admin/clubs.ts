import type { SupabaseClient } from "@supabase/supabase-js";
import type { Club, ClubFlyer, PromoterJob } from "../types";

type Ok<T> = { ok: true; rows: T[] } | { ok: false; message: string };
type OkOne<T> = { ok: true; row: T } | { ok: false; message: string };

export type ClubAccountRow = {
  id: string;
  club_slug: string;
  user_id: string | null;
  role: string;
  status: string;
  invite_email: string;
  invite_code: string;
  notes: string;
};

export type ClubEditRevisionRow = {
  id: string;
  club_slug: string;
  submitted_by: string;
  target_type: "club_payload" | "flyer" | "media";
  target_id: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  review_notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type JobDisputeRow = {
  id: string;
  club_slug: string;
  promoter_job_id: string | null;
  raised_by_user_id: string;
  raised_by_role: "club" | "admin" | "promoter";
  reason_code: string;
  description: string;
  status: "open" | "under_review" | "resolved" | "rejected";
  resolution_notes: string;
  created_at: string;
  resolved_at: string | null;
};

export type ClubPromoterAccessRow = {
  preferenceId: string;
  promoterId: string;
  displayName: string;
  status: string;
  weekdays: string[];
  notes: string;
};

export async function loadClubAccounts(
  supabase: SupabaseClient,
): Promise<Ok<ClubAccountRow>> {
  const { data, error } = await supabase
    .from("club_accounts")
    .select("id,club_slug,user_id,role,status,invite_email,invite_code,notes")
    .order("club_slug", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows: ClubAccountRow[] = (data ?? []).map((r) => ({
    id: String((r as { id?: string }).id ?? ""),
    club_slug: String((r as { club_slug?: string }).club_slug ?? ""),
    user_id: (r as { user_id?: string | null }).user_id ?? null,
    role: String((r as { role?: string }).role ?? "owner"),
    status: String((r as { status?: string }).status ?? "invited"),
    invite_email: String((r as { invite_email?: string }).invite_email ?? ""),
    invite_code: String((r as { invite_code?: string }).invite_code ?? ""),
    notes: String((r as { notes?: string }).notes ?? ""),
  }));
  return { ok: true, rows };
}

export async function issueClubInvite(
  supabase: SupabaseClient,
  input: { clubSlug: string; inviteEmail: string; role: "owner" | "manager" | "editor"; notes?: string },
): Promise<OkOne<{ inviteCode: string }>> {
  const { data, error } = await supabase.rpc("admin_issue_club_invite", {
    p_club_slug: input.clubSlug.trim(),
    p_invite_email: input.inviteEmail.trim().toLowerCase(),
    p_role: input.role,
    p_notes: String(input.notes ?? "").trim(),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, row: { inviteCode: String(data ?? "") } };
}

export async function loadClubBySlug(
  supabase: SupabaseClient,
  clubSlug: string,
): Promise<OkOne<Club>> {
  const { data, error } = await supabase
    .from("clubs")
    .select("payload")
    .eq("slug", clubSlug)
    .maybeSingle();
  if (error || !data) return { ok: false, message: error?.message ?? "Club not found." };
  return { ok: true, row: (data as { payload: Club }).payload };
}

export async function loadClubFlyers(
  supabase: SupabaseClient,
  clubSlug: string,
): Promise<Ok<ClubFlyer>> {
  const { data, error } = await supabase
    .from("club_weekly_flyers")
    .select("id,club_slug,event_date,title,description,image_path,image_url,is_active,sort_order")
    .eq("club_slug", clubSlug)
    .order("event_date", { ascending: false })
    .order("sort_order", { ascending: true });
  if (error) return { ok: false, message: error.message };
  const rows: ClubFlyer[] = (data ?? []).map((r) => ({
    id: String((r as { id?: string }).id ?? ""),
    clubSlug: String((r as { club_slug?: string }).club_slug ?? ""),
    eventDate: String((r as { event_date?: string }).event_date ?? ""),
    title: String((r as { title?: string }).title ?? ""),
    description: String((r as { description?: string }).description ?? ""),
    imagePath: String((r as { image_path?: string }).image_path ?? ""),
    imageUrl: String((r as { image_url?: string }).image_url ?? ""),
    isActive: Boolean((r as { is_active?: boolean }).is_active),
    sortOrder: Number((r as { sort_order?: number }).sort_order ?? 0) || 0,
  }));
  return { ok: true, rows };
}

export async function loadClubJobs(
  supabase: SupabaseClient,
  clubSlug: string,
): Promise<Ok<PromoterJob>> {
  const { data, error } = await supabase
    .from("promoter_jobs")
    .select("id,promoter_id,club_slug,service,job_date,status,guests_count,shift_fee,guestlist_fee,client_name,client_contact,notes")
    .eq("club_slug", clubSlug)
    .order("job_date", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows: PromoterJob[] = (data ?? []).map((r) => ({
    id: String((r as { id?: string }).id ?? ""),
    promoterId: String((r as { promoter_id?: string }).promoter_id ?? ""),
    clubSlug: String((r as { club_slug?: string }).club_slug ?? ""),
    service: String((r as { service?: string }).service ?? "guestlist") as PromoterJob["service"],
    jobDate: String((r as { job_date?: string }).job_date ?? ""),
    status: String((r as { status?: string }).status ?? "assigned") as PromoterJob["status"],
    guestsCount: Number((r as { guests_count?: number }).guests_count ?? 0) || 0,
    shiftFee: Number((r as { shift_fee?: number }).shift_fee ?? 0) || 0,
    guestlistFee: Number((r as { guestlist_fee?: number }).guestlist_fee ?? 0) || 0,
    clientName: String((r as { client_name?: string }).client_name ?? ""),
    clientContact: String((r as { client_contact?: string }).client_contact ?? ""),
    notes: String((r as { notes?: string }).notes ?? ""),
  }));
  return { ok: true, rows };
}

export async function loadClubPromoters(
  supabase: SupabaseClient,
  clubSlug: string,
): Promise<Ok<ClubPromoterAccessRow>> {
  const { data, error } = await supabase
    .from("promoter_club_preferences")
    .select("id,promoter_id,club_slug,weekdays,status,notes,promoters:promoter_id(display_name)")
    .eq("club_slug", clubSlug)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows = (data ?? []).map((r) => {
    const rr = r as {
      id?: string;
      promoter_id?: string;
      status?: string;
      weekdays?: string[];
      notes?: string;
      promoters?: { display_name?: string } | null;
    };
    return {
      preferenceId: String(rr.id ?? ""),
      promoterId: String(rr.promoter_id ?? ""),
      displayName: String(rr.promoters?.display_name ?? "Promoter"),
      status: String(rr.status ?? "pending"),
      weekdays: Array.isArray(rr.weekdays) ? rr.weekdays.map(String) : [],
      notes: String(rr.notes ?? ""),
    };
  });
  return { ok: true, rows };
}

export async function saveClubFlyer(
  supabase: SupabaseClient,
  input: {
    id?: string;
    clubSlug: string;
    eventDate: string;
    title: string;
    description: string;
    imagePath: string;
    imageUrl: string;
    sortOrder: number;
    isActive: boolean;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const row = {
    id: input.id || undefined,
    club_slug: input.clubSlug.trim(),
    event_date: input.eventDate.trim(),
    title: input.title.trim(),
    description: input.description.trim(),
    image_path: input.imagePath.trim(),
    image_url: input.imageUrl.trim(),
    sort_order: Number(input.sortOrder || 0) || 0,
    is_active: input.isActive,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("club_weekly_flyers").upsert(row, { onConflict: "id" });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function submitClubEditRevision(
  supabase: SupabaseClient,
  input: {
    clubSlug: string;
    targetType: "club_payload" | "flyer" | "media";
    targetId?: string | null;
    payload: Record<string, unknown>;
  },
): Promise<{ ok: true; revisionId: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("submit_club_edit_revision", {
    p_club_slug: input.clubSlug.trim(),
    p_target_type: input.targetType,
    p_target_id: input.targetId || null,
    p_payload: input.payload,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, revisionId: String(data ?? "") };
}

export async function reviewClubEditRevision(
  supabase: SupabaseClient,
  revisionId: string,
  approve: boolean,
  reviewNotes: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("review_club_edit_revision", {
    p_revision_id: revisionId,
    p_approve: approve,
    p_review_notes: reviewNotes,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function setClubPromoterAccess(
  supabase: SupabaseClient,
  preferenceId: string,
  allow: boolean,
  note: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("club_set_promoter_preference_access", {
    p_preference_id: preferenceId,
    p_allow: allow,
    p_note: note,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function decideClubJob(
  supabase: SupabaseClient,
  jobId: string,
  decision: "approve" | "deny",
  note: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("club_decide_promoter_job", {
    p_job_id: jobId,
    p_decision: decision,
    p_note: note,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function submitJobDispute(
  supabase: SupabaseClient,
  input: { promoterJobId: string; reasonCode: string; description: string; evidence?: Record<string, unknown> },
): Promise<{ ok: true; disputeId: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("submit_job_dispute", {
    p_promoter_job_id: input.promoterJobId,
    p_reason_code: input.reasonCode,
    p_description: input.description,
    p_evidence: input.evidence ?? {},
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, disputeId: String(data ?? "") };
}

export async function loadClubEditRevisions(
  supabase: SupabaseClient,
): Promise<Ok<ClubEditRevisionRow>> {
  const { data, error } = await supabase
    .from("club_edit_revisions")
    .select("id,club_slug,submitted_by,target_type,target_id,payload,status,review_notes,reviewed_by,reviewed_at,created_at")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows: ClubEditRevisionRow[] = (data ?? []).map((r) => ({
    id: String((r as { id?: string }).id ?? ""),
    club_slug: String((r as { club_slug?: string }).club_slug ?? ""),
    submitted_by: String((r as { submitted_by?: string }).submitted_by ?? ""),
    target_type: String((r as { target_type?: string }).target_type ?? "club_payload") as ClubEditRevisionRow["target_type"],
    target_id: (r as { target_id?: string | null }).target_id ?? null,
    payload: ((r as { payload?: Record<string, unknown> }).payload ?? {}) as Record<string, unknown>,
    status: String((r as { status?: string }).status ?? "pending") as ClubEditRevisionRow["status"],
    review_notes: String((r as { review_notes?: string }).review_notes ?? ""),
    reviewed_by: (r as { reviewed_by?: string | null }).reviewed_by ?? null,
    reviewed_at: (r as { reviewed_at?: string | null }).reviewed_at ?? null,
    created_at: String((r as { created_at?: string }).created_at ?? ""),
  }));
  return { ok: true, rows };
}

export async function loadJobDisputes(
  supabase: SupabaseClient,
): Promise<Ok<JobDisputeRow>> {
  const { data, error } = await supabase
    .from("job_disputes")
    .select("id,club_slug,promoter_job_id,raised_by_user_id,raised_by_role,reason_code,description,status,resolution_notes,created_at,resolved_at")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, message: error.message };
  const rows: JobDisputeRow[] = (data ?? []).map((r) => ({
    id: String((r as { id?: string }).id ?? ""),
    club_slug: String((r as { club_slug?: string }).club_slug ?? ""),
    promoter_job_id: (r as { promoter_job_id?: string | null }).promoter_job_id ?? null,
    raised_by_user_id: String((r as { raised_by_user_id?: string }).raised_by_user_id ?? ""),
    raised_by_role: String((r as { raised_by_role?: string }).raised_by_role ?? "club") as JobDisputeRow["raised_by_role"],
    reason_code: String((r as { reason_code?: string }).reason_code ?? "other"),
    description: String((r as { description?: string }).description ?? ""),
    status: String((r as { status?: string }).status ?? "open") as JobDisputeRow["status"],
    resolution_notes: String((r as { resolution_notes?: string }).resolution_notes ?? ""),
    created_at: String((r as { created_at?: string }).created_at ?? ""),
    resolved_at: (r as { resolved_at?: string | null }).resolved_at ?? null,
  }));
  return { ok: true, rows };
}

export async function reviewJobDispute(
  supabase: SupabaseClient,
  disputeId: string,
  status: "under_review" | "resolved" | "rejected",
  resolutionNotes: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("review_job_dispute", {
    p_dispute_id: disputeId,
    p_status: status,
    p_resolution_notes: resolutionNotes,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
