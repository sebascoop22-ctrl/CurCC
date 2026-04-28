import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FinancialBooking,
  FinancialDashboardSnapshot,
  FinancialDepartment,
  FinancialLogicType,
  FinancialPaymentStatus,
  FinancialPromoterProfile,
  FinancialRule,
  FinancialBonusType,
  FinancialConfigChangeRequest,
} from "../types";
import { computeNightlife, computeService } from "../lib/financial/calculations";

type Raw = Record<string, unknown>;

export type TypedError = { ok: false; code: string; message: string; details?: unknown };
type Ok<T> = { ok: true; data: T };

function badRequest(message: string, details?: unknown): TypedError {
  return { ok: false, code: "bad_request", message, details };
}

function dbError(message: string): TypedError {
  return { ok: false, code: "db_error", message };
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseDept(v: unknown): FinancialDepartment {
  const x = String(v ?? "").trim().toLowerCase();
  if (x === "nightlife" || x === "transport" || x === "protection" || x === "other") return x;
  return "other";
}

function parseLogic(v: unknown): FinancialLogicType {
  const x = String(v ?? "").trim().toLowerCase();
  if (x === "headcount_pay" || x === "commission_percent" || x === "flat_fee") return x;
  return "flat_fee";
}

function parseBonus(v: unknown): FinancialBonusType {
  const x = String(v ?? "").trim().toLowerCase();
  if (x === "flat" || x === "stacking" || x === "none") return x;
  return "none";
}

function parsePaymentStatus(v: unknown): FinancialPaymentStatus {
  const x = String(v ?? "").trim().toLowerCase();
  if (x === "expected" || x === "attended" || x === "paid_final") return x;
  return "expected";
}

function mapRule(raw: Raw): FinancialRule {
  return {
    id: String(raw.id ?? ""),
    department: parseDept(raw.department),
    clubSlug: raw.club_slug != null ? String(raw.club_slug) : null,
    venueOrServiceName: String(raw.venue_or_service_name ?? ""),
    maleRate: asNumber(raw.male_rate),
    femaleRate: asNumber(raw.female_rate),
    baseRate: asNumber(raw.base_rate),
    logicType: parseLogic(raw.logic_type),
    bonusType: parseBonus(raw.bonus_type),
    bonusGoal: Math.max(0, Math.round(asNumber(raw.bonus_goal))),
    bonusAmount: asNumber(raw.bonus_amount),
    isActive: Boolean(raw.is_active),
    effectiveFrom: String(raw.effective_from ?? ""),
    effectiveTo: raw.effective_to != null ? String(raw.effective_to) : null,
  };
}

function mapPromoter(raw: Raw): FinancialPromoterProfile {
  return {
    id: String(raw.id ?? ""),
    userId: raw.user_id != null ? String(raw.user_id) : null,
    name: String(raw.name ?? ""),
    commissionPercentage: asNumber(raw.commission_percentage),
    isActive: Boolean(raw.is_active),
    contact: String(raw.contact ?? ""),
    notes: String(raw.notes ?? ""),
  };
}

function mapBooking(raw: Raw): FinancialBooking {
  return {
    id: String(raw.id ?? ""),
    bookingReference: String(raw.booking_reference ?? ""),
    bookingDate: String(raw.booking_date ?? ""),
    department: parseDept(raw.department),
    clubSlug: raw.club_slug != null ? String(raw.club_slug) : null,
    promoterId: raw.promoter_id != null ? String(raw.promoter_id) : null,
    promoterName: raw.promoter_name != null ? String(raw.promoter_name) : null,
    clientId: raw.client_id != null ? String(raw.client_id) : null,
    clientName: raw.client_name != null ? String(raw.client_name) : null,
    ruleId: raw.rule_id != null ? String(raw.rule_id) : null,
    venueOrServiceName: String(raw.venue_or_service_name ?? ""),
    paymentStatus: parsePaymentStatus(raw.payment_status),
    maleGuests: Math.max(0, Math.round(asNumber(raw.male_guests))),
    femaleGuests: Math.max(0, Math.round(asNumber(raw.female_guests))),
    totalSpend: asNumber(raw.total_spend),
    otherCosts: asNumber(raw.other_costs),
    totalGuests: Math.max(0, Math.round(asNumber(raw.total_guests))),
    totalRevenue: asNumber(raw.total_revenue),
    bonus: asNumber(raw.bonus),
    bonusGoal: Math.max(0, Math.round(asNumber(raw.bonus_goal))),
    nearMissBonusGoal: Boolean(raw.near_miss_bonus_goal),
    projectedAgencyProfit: asNumber(raw.projected_agency_profit),
    realizedAgencyProfit: asNumber(raw.realized_agency_profit),
  };
}

function mapChangeRequest(raw: Raw): FinancialConfigChangeRequest {
  const t = String(raw.target_type ?? "");
  const targetType: FinancialConfigChangeRequest["targetType"] =
    t === "financial_promoter" ? "financial_promoter" : "financial_rule";
  const s = String(raw.status ?? "pending");
  const status: FinancialConfigChangeRequest["status"] =
    s === "approved" || s === "rejected" ? s : "pending";
  return {
    id: String(raw.id ?? ""),
    targetType,
    targetId: String(raw.target_id ?? ""),
    payload:
      raw.payload && typeof raw.payload === "object"
        ? (raw.payload as Record<string, unknown>)
        : {},
    requestedBy: String(raw.requested_by ?? ""),
    requestedByLabel: "",
    clubSlug: null,
    clubName: null,
    status,
    reviewedBy: raw.reviewed_by != null ? String(raw.reviewed_by) : null,
    reviewNotes: String(raw.review_notes ?? ""),
    createdAt: String(raw.created_at ?? ""),
    reviewedAt: raw.reviewed_at != null ? String(raw.reviewed_at) : null,
  };
}

export async function listFinancialRules(
  supabase: SupabaseClient,
): Promise<Ok<FinancialRule[]> | TypedError> {
  const { data, error } = await supabase
    .from("financial_rules")
    .select("*")
    .order("department", { ascending: true })
    .order("venue_or_service_name", { ascending: true });
  if (error) return dbError(error.message);
  return { ok: true, data: (data ?? []).map((x) => mapRule(x as Raw)) };
}

export async function upsertFinancialRule(
  supabase: SupabaseClient,
  input: Partial<FinancialRule> & {
    venueOrServiceName: string;
    department: FinancialDepartment;
    clubSlug?: string | null;
    id?: string;
  },
): Promise<Ok<string> | TypedError> {
  const venueOrServiceName = input.venueOrServiceName.trim();
  if (!venueOrServiceName) return badRequest("Venue/service name is required.");
  const bonusGoal = Math.max(0, Math.round(Number(input.bonusGoal ?? 0)));
  const department = input.department;
  const logicType = department === "nightlife" ? "flat_fee" : (input.logicType ?? "flat_fee");
  const payload = {
    id: input.id?.trim() || undefined,
    department,
    club_slug: input.clubSlug?.trim() || null,
    venue_or_service_name: venueOrServiceName,
    male_rate: Math.max(0, asNumber(input.maleRate)),
    female_rate: Math.max(0, asNumber(input.femaleRate)),
    base_rate: Math.max(0, asNumber(input.baseRate)),
    logic_type: logicType,
    bonus_type: input.bonusType ?? "none",
    bonus_goal: bonusGoal,
    bonus_amount: Math.max(0, asNumber(input.bonusAmount)),
    is_active: input.isActive !== false,
    effective_from: String(input.effectiveFrom || new Date().toISOString().slice(0, 10)),
    effective_to: input.effectiveTo ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("financial_rules")
    .upsert(payload, { onConflict: "id" })
    .select("id")
    .single();
  if (error) return dbError(error.message);
  return { ok: true, data: String((data as Raw).id ?? "") };
}

export async function archiveFinancialRule(
  supabase: SupabaseClient,
  id: string,
): Promise<Ok<true> | TypedError> {
  const ruleId = id.trim();
  if (!ruleId) return badRequest("Rule id is required.");
  const { error } = await supabase
    .from("financial_rules")
    .update({ is_active: false, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", ruleId);
  if (error) return dbError(error.message);
  return { ok: true, data: true };
}

export async function listFinancialPromoters(
  supabase: SupabaseClient,
): Promise<Ok<FinancialPromoterProfile[]> | TypedError> {
  const { data, error } = await supabase.from("financial_promoters").select("*").order("name", { ascending: true });
  if (error) return dbError(error.message);
  return { ok: true, data: (data ?? []).map((x) => mapPromoter(x as Raw)) };
}

export async function upsertFinancialPromoter(
  supabase: SupabaseClient,
  input: Partial<FinancialPromoterProfile> & { name: string; id?: string },
): Promise<Ok<string> | TypedError> {
  const name = input.name.trim();
  if (!name) return badRequest("Promoter name is required.");
  const commission = asNumber(input.commissionPercentage ?? 0);
  if (commission < 0 || commission > 100) {
    return badRequest("Commission percentage must be between 0 and 100.");
  }
  const payload = {
    id: input.id?.trim() || undefined,
    user_id: input.userId ?? null,
    name,
    commission_percentage: commission,
    is_active: input.isActive !== false,
    contact: String(input.contact ?? "").trim(),
    notes: String(input.notes ?? "").trim(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("financial_promoters")
    .upsert(payload, { onConflict: "id" })
    .select("id")
    .single();
  if (error) return dbError(error.message);
  return { ok: true, data: String((data as Raw).id ?? "") };
}

export async function listFinancialBookings(
  supabase: SupabaseClient,
  params: {
    from: string;
    to: string;
    department?: FinancialDepartment;
    paymentStatus?: FinancialPaymentStatus;
    promoterId?: string;
    venueOrServiceName?: string;
  },
): Promise<Ok<FinancialBooking[]> | TypedError> {
  let q = supabase
    .from("financial_bookings")
    .select("*, financial_booking_nightlife(*), financial_booking_service(*), financial_promoters(name), clients(name)")
    .gte("booking_date", params.from)
    .lte("booking_date", params.to)
    .eq("is_archived", false)
    .order("booking_date", { ascending: false });
  if (params.department) q = q.eq("department", params.department);
  if (params.paymentStatus) q = q.eq("payment_status", params.paymentStatus);
  if (params.promoterId?.trim()) q = q.eq("promoter_id", params.promoterId.trim());
  if (params.venueOrServiceName?.trim()) q = q.ilike("venue_or_service_name", `%${params.venueOrServiceName.trim()}%`);
  const { data, error } = await q.limit(500);
  if (error) return dbError(error.message);

  const rows: FinancialBooking[] = (data ?? []).map((row) => {
    const raw = row as Raw;
    const night = (raw.financial_booking_nightlife as Raw[] | null)?.[0] ?? {};
    const svc = (raw.financial_booking_service as Raw[] | null)?.[0] ?? {};
    const promoter = (raw.financial_promoters as Raw | null) ?? null;
    const client = (raw.clients as Raw | null) ?? null;
    const snapshot = (raw.rule_snapshot_json as Raw | null) ?? {};
    return mapBooking({
      ...raw,
      promoter_name: promoter?.name,
      client_name: client?.name,
      male_guests: night.male_guests,
      female_guests: night.female_guests,
      total_spend: svc.total_spend,
      other_costs: night.other_costs,
      total_guests: snapshot.totalGuests,
      total_revenue: snapshot.totalRevenue,
      bonus: snapshot.bonus,
      bonus_goal: snapshot.bonusGoal,
      near_miss_bonus_goal: snapshot.nearMissBonusGoal,
      projected_agency_profit: snapshot.projectedAgencyProfit,
      realized_agency_profit: snapshot.realizedAgencyProfit,
    });
  });
  return { ok: true, data: rows };
}

export async function upsertNightlifeFinancialBooking(
  supabase: SupabaseClient,
  input: {
    id?: string;
    bookingReference: string;
    bookingDate: string;
    clubSlug?: string | null;
    promoterId: string | null;
    clientId: string | null;
    ruleId: string;
    venueOrServiceName: string;
    maleGuests: number;
    femaleGuests: number;
    otherCosts: number;
    paymentStatus: FinancialPaymentStatus;
  },
): Promise<Ok<string> | TypedError> {
  if (!input.ruleId.trim()) return badRequest("Rule is required for nightlife bookings.");
  const { data: ruleData, error: ruleErr } = await supabase
    .from("financial_rules")
    .select("*")
    .eq("id", input.ruleId.trim())
    .maybeSingle();
  if (ruleErr) return dbError(ruleErr.message);
  if (!ruleData) return badRequest("Selected rule was not found.");
  const rule = mapRule(ruleData as Raw);
  const calc = computeNightlife({
    maleGuests: input.maleGuests,
    femaleGuests: input.femaleGuests,
    baseRate: rule.baseRate,
    logicType: rule.logicType,
    maleRate: rule.maleRate,
    femaleRate: rule.femaleRate,
    otherCosts: input.otherCosts,
    bonusType: rule.bonusType,
    bonusGoal: rule.bonusGoal,
    bonusAmount: rule.bonusAmount,
    paymentStatus: input.paymentStatus,
  });

  const bookingPayload = {
    id: input.id?.trim() || undefined,
    booking_reference: input.bookingReference.trim(),
    booking_date: input.bookingDate.trim().slice(0, 10),
    department: "nightlife",
    club_slug: input.clubSlug?.trim() || null,
    promoter_id: input.promoterId?.trim() || null,
    client_id: input.clientId?.trim() || null,
    rule_id: rule.id,
    venue_or_service_name: input.venueOrServiceName.trim() || rule.venueOrServiceName,
    payment_status: input.paymentStatus,
    rule_snapshot_json: {
      ruleId: rule.id,
      department: rule.department,
      venueOrServiceName: rule.venueOrServiceName,
      baseRate: rule.baseRate,
      logicType: rule.logicType,
      maleRate: rule.maleRate,
      femaleRate: rule.femaleRate,
      bonusType: rule.bonusType,
      bonusGoal: rule.bonusGoal,
      bonusAmount: rule.bonusAmount,
      totalGuests: calc.totalGuests,
      totalRevenue: calc.totalRevenue,
      bonus: calc.bonus,
      projectedAgencyProfit: calc.projectedAgencyProfit,
      realizedAgencyProfit: calc.realizedAgencyProfit,
      nearMissBonusGoal: calc.nearMissBonusGoal,
    },
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("financial_bookings")
    .upsert(bookingPayload, { onConflict: "id" })
    .select("id")
    .single();
  if (error) return dbError(error.message);
  const bookingId = String((data as Raw).id ?? "");
  const { error: extErr } = await supabase.from("financial_booking_nightlife").upsert({
    financial_booking_id: bookingId,
    male_guests: Math.max(0, Math.floor(input.maleGuests)),
    female_guests: Math.max(0, Math.floor(input.femaleGuests)),
    other_costs: Math.max(0, asNumber(input.otherCosts)),
    updated_at: new Date().toISOString(),
  });
  if (extErr) return dbError(extErr.message);
  return { ok: true, data: bookingId };
}

export async function upsertServiceFinancialBooking(
  supabase: SupabaseClient,
  input: {
    id?: string;
    bookingReference: string;
    bookingDate: string;
    clubSlug?: string | null;
    department: "transport" | "protection" | "other";
    promoterId: string | null;
    clientId: string | null;
    ruleId: string | null;
    venueOrServiceName: string;
    totalSpend: number;
    commissionPercentage: number;
    paymentStatus: FinancialPaymentStatus;
  },
): Promise<Ok<string> | TypedError> {
  const calc = computeService({
    totalSpend: input.totalSpend,
    commissionPercentage: input.commissionPercentage,
    paymentStatus: input.paymentStatus,
  });

  const bookingPayload = {
    id: input.id?.trim() || undefined,
    booking_reference: input.bookingReference.trim(),
    booking_date: input.bookingDate.trim().slice(0, 10),
    department: input.department,
    club_slug: input.clubSlug?.trim() || null,
    promoter_id: input.promoterId?.trim() || null,
    client_id: input.clientId?.trim() || null,
    rule_id: input.ruleId?.trim() || null,
    venue_or_service_name: input.venueOrServiceName.trim(),
    payment_status: input.paymentStatus,
    rule_snapshot_json: {
      ruleId: input.ruleId?.trim() || null,
      commissionPercentage: input.commissionPercentage,
      projectedAgencyProfit: calc.projectedAgencyProfit,
      realizedAgencyProfit: calc.realizedAgencyProfit,
    },
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("financial_bookings")
    .upsert(bookingPayload, { onConflict: "id" })
    .select("id")
    .single();
  if (error) return dbError(error.message);
  const bookingId = String((data as Raw).id ?? "");
  const { error: extErr } = await supabase.from("financial_booking_service").upsert({
    financial_booking_id: bookingId,
    total_spend: Math.max(0, asNumber(input.totalSpend)),
    commission_percentage_override: input.commissionPercentage,
    updated_at: new Date().toISOString(),
  });
  if (extErr) return dbError(extErr.message);
  return { ok: true, data: bookingId };
}

export async function archiveFinancialBooking(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<Ok<true> | TypedError> {
  const id = bookingId.trim();
  if (!id) return badRequest("Booking id is required.");
  const { error } = await supabase
    .from("financial_bookings")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return dbError(error.message);
  return { ok: true, data: true };
}

export async function submitFinancialConfigChangeRequest(
  supabase: SupabaseClient,
  input: {
    targetType: "financial_rule" | "financial_promoter";
    targetId: string;
    payload: Record<string, unknown>;
  },
): Promise<Ok<string> | TypedError> {
  const targetId = input.targetId.trim();
  if (!targetId) return badRequest("Target id is required.");
  const { data, error } = await supabase
    .from("financial_config_change_requests")
    .insert({
      target_type: input.targetType,
      target_id: targetId,
      payload: input.payload,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return dbError(error.message);
  return { ok: true, data: String((data as Raw).id ?? "") };
}

export async function listFinancialConfigChangeRequests(
  supabase: SupabaseClient,
  opts?: { status?: "pending" | "approved" | "rejected" },
): Promise<Ok<FinancialConfigChangeRequest[]> | TypedError> {
  let q = supabase
    .from("financial_config_change_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q.limit(300);
  if (error) return dbError(error.message);
  const rows = (data ?? []).map((x) => mapChangeRequest(x as Raw));
  if (!rows.length) return { ok: true, data: rows };

  const requesterIds = [...new Set(rows.map((r) => r.requestedBy).filter(Boolean))];
  const ruleTargetIds = rows
    .filter((r) => r.targetType === "financial_rule")
    .map((r) => r.targetId)
    .filter(Boolean);

  const [profilesRes, rulesRes] = await Promise.all([
    requesterIds.length
      ? supabase.from("profiles").select("id,display_name").in("id", requesterIds)
      : Promise.resolve({ data: [], error: null }),
    ruleTargetIds.length
      ? supabase
          .from("financial_rules")
          .select("id,club_slug,clubs(name)")
          .in("id", ruleTargetIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesRes.error) return dbError(profilesRes.error.message);
  if (rulesRes.error) return dbError(rulesRes.error.message);

  const profileById = new Map<string, string>();
  for (const row of profilesRes.data ?? []) {
    const r = row as Raw;
    profileById.set(
      String(r.id ?? ""),
      String(r.display_name ?? "").trim() || String(r.id ?? "").slice(0, 8),
    );
  }

  const ruleMetaById = new Map<string, { clubSlug: string | null; clubName: string | null }>();
  for (const row of rulesRes.data ?? []) {
    const r = row as Raw;
    const club = (r.clubs as Raw | null) ?? null;
    ruleMetaById.set(String(r.id ?? ""), {
      clubSlug: r.club_slug != null ? String(r.club_slug) : null,
      clubName: club?.name != null ? String(club.name) : null,
    });
  }

  for (const row of rows) {
    row.requestedByLabel = profileById.get(row.requestedBy) ?? row.requestedBy.slice(0, 8);
    const meta = ruleMetaById.get(row.targetId);
    if (meta) {
      row.clubSlug = meta.clubSlug;
      row.clubName = meta.clubName;
    }
  }
  return { ok: true, data: rows };
}

export async function reviewFinancialConfigChangeRequest(
  supabase: SupabaseClient,
  input: {
    requestId: string;
    approve: boolean;
    reviewNotes: string;
  },
): Promise<Ok<true> | TypedError> {
  const requestId = input.requestId.trim();
  if (!requestId) return badRequest("Request id is required.");
  const { data: req, error: reqErr } = await supabase
    .from("financial_config_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (reqErr) return dbError(reqErr.message);
  if (!req) return badRequest("Request was not found.");

  const status = input.approve ? "approved" : "rejected";
  const { error: updReqErr } = await supabase
    .from("financial_config_change_requests")
    .update({
      status,
      review_notes: input.reviewNotes.trim(),
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (updReqErr) return dbError(updReqErr.message);

  if (!input.approve) return { ok: true, data: true };

  const row = req as Raw;
  const targetType = String(row.target_type ?? "");
  const targetId = String(row.target_id ?? "");
  const payload = (row.payload as Raw | null) ?? {};
  if (targetType === "financial_rule") {
    const { error } = await supabase
      .from("financial_rules")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", targetId);
    if (error) return dbError(error.message);
  } else if (targetType === "financial_promoter") {
    const { error } = await supabase
      .from("financial_promoters")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", targetId);
    if (error) return dbError(error.message);
  }
  return { ok: true, data: true };
}

export async function getFinancialDashboardSnapshot(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<Ok<FinancialDashboardSnapshot> | TypedError> {
  const { data, error } = await supabase.rpc("get_financial_dashboard_snapshot", {
    p_from: from,
    p_to: to,
  });
  if (error) return dbError(error.message);
  const row = ((data as Raw[] | null) ?? [])[0] ?? {};
  return {
    ok: true,
    data: {
      totalRealizedProfit: asNumber(row.total_realized_profit),
      nightlifeRealizedProfit: asNumber(row.nightlife_realized_profit),
      transportRealizedProfit: asNumber(row.transport_realized_profit),
      protectionRealizedProfit: asNumber(row.protection_realized_profit),
      otherRealizedProfit: asNumber(row.other_realized_profit),
      totalNightlifeGuests: Math.max(0, Math.round(asNumber(row.total_nightlife_guests))),
      avgNightlifeProfitPerGuest: asNumber(row.avg_nightlife_profit_per_guest),
      outstandingProjectedProfit: asNumber(row.outstanding_projected_profit),
      realizedProjectedProfit: asNumber(row.realized_projected_profit),
      topPromoterName: row.top_promoter_name != null ? String(row.top_promoter_name) : null,
      topPromoterRealizedProfit: asNumber(row.top_promoter_realized_profit),
    },
  };
}
