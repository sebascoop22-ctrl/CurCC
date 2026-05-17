import type {
  FinancialBonusType,
  FinancialClubPaymentRate,
  FinancialLogicType,
  FinancialPaymentStatus,
} from "../../types";
import type { PromoterJobType } from "./job-type";
import {
  mergeSheetExtensions,
  normalizeClubFinancialRuleSheetExtension,
  type GuestlistPaymentModel,
  type JsonObject,
} from "./club-financial-sheet-template";

/** Alias for V4 `promoter_jobs.job_type`. */
export type JobType = PromoterJobType;

export interface NightlifeCalculationInput {
  maleGuests: number;
  femaleGuests: number;
  baseRate: number;
  logicType: FinancialLogicType;
  maleRate: number;
  femaleRate: number;
  otherCosts: number;
  bonusType: FinancialBonusType;
  bonusGoal: number;
  bonusAmount: number;
  paymentStatus: FinancialPaymentStatus;
  /** When false (ratio hard-stop), bonus is zero. */
  bonusValid?: boolean;
}

export interface ServiceCalculationInput {
  totalSpend: number;
  commissionPercentage: number;
  paymentStatus: FinancialPaymentStatus;
}

export interface NightlifeCalculationResult {
  totalGuests: number;
  totalRevenue: number;
  bonus: number;
  projectedAgencyProfit: number;
  realizedAgencyProfit: number;
  nearMissBonusGoal: boolean;
}

export interface ServiceCalculationResult {
  projectedAgencyProfit: number;
  realizedAgencyProfit: number;
}

export interface ResolvedRate {
  rate: FinancialClubPaymentRate;
  sheet: JsonObject;
  jobDate: string;
  hasDateOverride: boolean;
}

export interface SexRatioEvaluation {
  valid: boolean;
  reason?: string;
}

export interface GuestlistRevenueInput {
  paymentModel: GuestlistPaymentModel | null;
  headcount: number;
  maleCount: number;
  femaleCount: number;
  standardRatePerGuest: number;
  maleRate: number;
  femaleRate: number;
  flatRatePerNight: number;
}

export interface GuestlistRevenueResult {
  revenue: number;
  headcount: number;
}

export interface TicketEconomicsInput {
  ticketsSold: number;
  ticketPrice: number;
  commissionPerTicket: number;
  volumeBonusThreshold?: number;
  volumeBonusAmount?: number;
}

export interface TicketEconomicsResult {
  conciergeCut: number;
  promoterCut: number;
  totalRevenue: number;
}

export interface JobFinancialSnapshotInput {
  jobType: PromoterJobType;
  jobDate: string;
  clubSlug: string | null;
  maleCount: number;
  femaleCount: number;
  guestsCount: number;
  guestsJoined: number;
  guestsEntered: number;
  ticketsSold: number;
  grossSpendGbp: number;
  shiftFee: number;
  guestlistFee: number;
  bonusValid?: boolean;
  otherCosts?: number;
  paymentStatus?: FinancialPaymentStatus;
}

export interface JobFinancialSnapshot {
  netSpendGbp: number;
  conciergeCutGbp: number;
  promoterCutGbp: number;
  bonusValid: boolean;
  guestlistRevenueGbp: number;
  bonusGbp: number;
  billingHeadcount: number;
  ledgerAmountGbp: number;
  sexRatioReason?: string;
}

const DEFAULT_VAT_RATE = 0.2;
const DEFAULT_TABLE_COMMISSION = 0.1;

function asMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function asInt(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

function asRate(value: unknown, fallback = 0): number {
  const n = Number(value);
  return asMoney(Number.isFinite(n) ? n : fallback);
}

function rateAppliesOnDate(rate: FinancialClubPaymentRate, jobDate: string): boolean {
  const d = jobDate.slice(0, 10);
  const from = (rate.effectiveFrom ?? "").slice(0, 10) || "0000-01-01";
  const to = rate.effectiveTo?.slice(0, 10);
  if (d < from) return false;
  if (to && d > to) return false;
  return true;
}

function parseGuestlistPaymentModel(v: unknown): GuestlistPaymentModel | null {
  const x = String(v ?? "").trim().toLowerCase();
  if (x === "per_guest" || x === "sex_ratio" || x === "flat_rate") return x;
  return null;
}

function applyDateOverrideToRate(
  rate: FinancialClubPaymentRate,
  override: JsonObject | undefined,
): FinancialClubPaymentRate {
  if (!override) return rate;
  const next = { ...rate };
  if (typeof override.baseRate === "number") next.baseRate = override.baseRate;
  if (typeof override.maleRate === "number") next.maleRate = override.maleRate;
  if (typeof override.femaleRate === "number") next.femaleRate = override.femaleRate;
  if (typeof override.bonusGoal === "number") next.bonusGoal = override.bonusGoal;
  if (typeof override.bonusAmount === "number") next.bonusAmount = override.bonusAmount;
  return next;
}

/** Effective club rate for a job date; merges `eventsOverrides.byDate[jobDate]`. */
export function resolveClubRateForJob(
  clubSlug: string,
  jobDate: string,
  jobType: JobType,
  rates: FinancialClubPaymentRate[],
  opts?: { clubPaymentRateId?: string | null },
): ResolvedRate | null {
  const slug = clubSlug.trim();
  const date = jobDate.slice(0, 10);
  if (!slug) return null;

  let candidates = rates.filter(
    (r) =>
      r.isActive &&
      (r.clubSlug?.trim() === slug || !r.clubSlug?.trim()) &&
      rateAppliesOnDate(r, date),
  );

  const preferredId = opts?.clubPaymentRateId?.trim();
  if (preferredId) {
    const picked = candidates.find((r) => r.id === preferredId);
    if (picked) candidates = [picked];
  }

  const deptPriority: Record<JobType, string[]> = {
    guestlist: ["nightlife"],
    table: ["nightlife"],
    ticket: ["nightlife", "other"],
    venue_hire: ["nightlife"],
  };
  const depts = deptPriority[jobType];
  const chosen =
    candidates.find((r) => depts.includes(r.department)) ?? candidates[0] ?? null;
  if (!chosen) return null;

  const baseSheet = normalizeClubFinancialRuleSheetExtension(chosen.sheetExtension);
  const events = baseSheet.eventsOverrides as JsonObject | undefined;
  const byDate = (events?.byDate ?? {}) as Record<string, JsonObject>;
  const dateKey = Object.keys(byDate).find((k) => k.slice(0, 10) === date);
  const overridePatch = dateKey ? byDate[dateKey] : undefined;
  const mergedSheet = overridePatch
    ? normalizeClubFinancialRuleSheetExtension(
        mergeSheetExtensions(baseSheet, overridePatch),
      )
    : baseSheet;
  const patchedRate = applyDateOverrideToRate(chosen, overridePatch);

  return {
    rate: patchedRate,
    sheet: mergedSheet,
    jobDate: date,
    hasDateOverride: Boolean(overridePatch),
  };
}

/** VAT-exclusive spend from gross (default 20% VAT → ÷ 1.20). */
export function computeNetSpendFromGross(gross: number, vatRate = DEFAULT_VAT_RATE): number {
  const g = asMoney(gross);
  if (g <= 0) return 0;
  const divisor = 1 + Math.max(0, vatRate);
  return asMoney(g / divisor);
}

/** Table / venue-hire concierge commission on net spend (default 10%). */
export function computeTableConciergeCut(
  netSpend: number,
  commissionRate = DEFAULT_TABLE_COMMISSION,
): number {
  const net = asMoney(netSpend);
  const rate = Math.max(0, Math.min(1, commissionRate));
  return asMoney(net * rate);
}

/** Billing headcount for guestlist / invoice lines (matches DB trigger priority). */
export function billingHeadcount(input: {
  guestsEntered: number;
  guestsCount: number;
  maleCount: number;
  femaleCount: number;
}): number {
  return Math.max(
    asInt(input.guestsEntered),
    asInt(input.guestsCount),
    asInt(input.maleCount) + asInt(input.femaleCount),
    0,
  );
}

/**
 * Parse ratio strings such as `2:1` or `2:1 F:M` (females per male required).
 * `1:2 M:F` is interpreted as 2 females per 1 male.
 */
export function parseSexRatioRule(rule: string): { female: number; male: number } | null {
  const raw = String(rule ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/(\d+)\s*:\s*(\d+)/);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  if (!(a > 0 && b > 0)) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("m:f") || lower.includes("m : f")) {
    return { female: b, male: a };
  }
  return { female: a, male: b };
}

/** V4 ratio hard-stop — invalid ratio blocks bonus, not necessarily job completion. */
export function evaluateSexRatioRule(
  maleCount: number,
  femaleCount: number,
  rule: string,
): SexRatioEvaluation {
  const parsed = parseSexRatioRule(rule);
  if (!parsed) return { valid: true };
  const m = asInt(maleCount);
  const f = asInt(femaleCount);
  if (m === 0) return { valid: true };
  const required = parsed.female / parsed.male;
  const actual = f / m;
  if (actual + 1e-9 >= required) return { valid: true };
  return {
    valid: false,
    reason: `Requires ${parsed.female}:${parsed.male} F:M; got ${f}F / ${m}M`,
  };
}

export function computeGuestlistRevenue(input: GuestlistRevenueInput): GuestlistRevenueResult {
  const headcount = asInt(input.headcount);
  const m = asInt(input.maleCount);
  const f = asInt(input.femaleCount);
  const model = input.paymentModel ?? "per_guest";
  const standard = asRate(input.standardRatePerGuest);
  const maleRate = asRate(input.maleRate);
  const femaleRate = asRate(input.femaleRate);
  const flat = asRate(input.flatRatePerNight);

  let revenue = 0;
  switch (model) {
    case "sex_ratio":
      revenue = asMoney(m * maleRate + f * femaleRate);
      break;
    case "flat_rate":
      revenue = asMoney(flat > 0 ? flat : standard);
      break;
    case "per_guest":
    default:
      revenue = asMoney(headcount * standard);
      break;
  }
  return { revenue, headcount };
}

export function computeTicketEconomics(input: TicketEconomicsInput): TicketEconomicsResult {
  const sold = asInt(input.ticketsSold);
  const price = asRate(input.ticketPrice);
  const commission = asRate(input.commissionPerTicket);
  let conciergeCut = asMoney(sold * commission);
  const threshold = asInt(input.volumeBonusThreshold ?? 0);
  const bonusAmt = asRate(input.volumeBonusAmount ?? 0);
  if (threshold > 0 && sold >= threshold && bonusAmt > 0) {
    conciergeCut = asMoney(conciergeCut + bonusAmt);
  }
  const totalRevenue = asMoney(sold * price);
  const promoterCut = asMoney(Math.max(0, totalRevenue - conciergeCut));
  return { conciergeCut, promoterCut, totalRevenue };
}

/**
 * Legacy invoice ledger line (mirrors `public.job_ledger_amount_gbp` in Phase 3 SQL).
 * shift_fee + guestlist_fee × billing headcount — keep in sync with migration tests.
 */
export function computeJobLedgerAmountGbp(input: {
  shiftFee: number;
  guestlistFee: number;
  guestsEntered: number;
  guestsCount: number;
  maleCount: number;
  femaleCount: number;
}): number {
  const guests = billingHeadcount(input);
  return asMoney(asRate(input.shiftFee) + asRate(input.guestlistFee) * guests);
}

function resolveGuestlistBonusParams(
  rate: FinancialClubPaymentRate,
  sheet: JsonObject,
): { bonusType: FinancialBonusType; bonusGoal: number; bonusAmount: number } {
  const gb = (sheet.guestlistBonuses ?? {}) as JsonObject;
  const rawType = String(gb.bonusType ?? "").trim().toLowerCase();
  let bonusType = rate.bonusType;
  if (rawType === "flat" || rawType === "stacking" || rawType === "none") {
    bonusType = rawType;
  }
  const bonusGoal = asInt(Number(gb.requiredNumber ?? rate.bonusGoal));
  const bonusAmount = asRate(
    Number(gb.bonusFlatRate ?? gb.bonusRatePerGuest ?? rate.bonusAmount),
  );
  return { bonusType, bonusGoal, bonusAmount };
}

function guestlistRatesFromResolved(resolved: ResolvedRate): GuestlistRevenueInput {
  const { rate, sheet } = resolved;
  const gl = (sheet.guestlist ?? {}) as JsonObject;
  return {
    paymentModel: parseGuestlistPaymentModel(gl.paymentModel),
    headcount: 0,
    maleCount: 0,
    femaleCount: 0,
    standardRatePerGuest: asRate(gl.standardRatePerGuest, rate.baseRate),
    maleRate: asRate(gl.maleBonusRate ?? gl.maleRate, rate.maleRate),
    femaleRate: asRate(gl.femaleBonusRate ?? gl.femaleRate, rate.femaleRate),
    flatRatePerNight: asRate(gl.flatRateGuestAgnostic, rate.baseRate),
  };
}

/** V4 automated GBP fields for a job row + resolved venue rate. */
export function buildJobFinancialSnapshot(
  job: JobFinancialSnapshotInput,
  resolved: ResolvedRate | null,
): JobFinancialSnapshot {
  const hc = billingHeadcount(job);
  const paymentStatus = job.paymentStatus ?? "expected";
  const ratioRule = String(
    ((resolved?.sheet.guestlist ?? {}) as JsonObject).maleFemaleRequiredRatio ?? "",
  );
  const ratio = evaluateSexRatioRule(job.maleCount, job.femaleCount, ratioRule);
  const bonusValid = job.bonusValid !== false && ratio.valid;

  let netSpendGbp = 0;
  let conciergeCutGbp = 0;
  let promoterCutGbp = 0;
  let guestlistRevenueGbp = 0;
  let bonusGbp = 0;

  if (!resolved) {
    return {
      netSpendGbp: asMoney(job.grossSpendGbp > 0 ? computeNetSpendFromGross(job.grossSpendGbp) : 0),
      conciergeCutGbp: 0,
      promoterCutGbp: computeJobLedgerAmountGbp(job),
      bonusValid,
      guestlistRevenueGbp: 0,
      bonusGbp: 0,
      billingHeadcount: hc,
      ledgerAmountGbp: computeJobLedgerAmountGbp(job),
      sexRatioReason: ratio.reason,
    };
  }

  const { rate, sheet } = resolved;

  switch (job.jobType) {
    case "table":
    case "venue_hire": {
      netSpendGbp = computeNetSpendFromGross(job.grossSpendGbp);
      conciergeCutGbp = computeTableConciergeCut(netSpendGbp);
      promoterCutGbp = asMoney(
        Math.max(0, asMoney(job.grossSpendGbp) - netSpendGbp - conciergeCutGbp),
      );
      break;
    }
    case "ticket": {
      const rt = (sheet.regionalTickets ?? {}) as JsonObject;
      const econ = computeTicketEconomics({
        ticketsSold: job.ticketsSold,
        ticketPrice: asRate(rt.ticketPrice),
        commissionPerTicket: asRate(rt.fixedCommissionPerTicket),
        volumeBonusThreshold: asInt(Number(rt.volumeBonusThreshold ?? 0)),
        volumeBonusAmount: asRate(Number(rt.volumeBonusAmount ?? 0)),
      });
      conciergeCutGbp = econ.conciergeCut;
      promoterCutGbp = econ.promoterCut;
      netSpendGbp = econ.totalRevenue;
      break;
    }
    case "guestlist":
    default: {
      const glInput = guestlistRatesFromResolved(resolved);
      glInput.headcount = hc;
      glInput.maleCount = job.maleCount;
      glInput.femaleCount = job.femaleCount;
      const gl = computeGuestlistRevenue(glInput);
      guestlistRevenueGbp = gl.revenue;

      const bonusParams = resolveGuestlistBonusParams(rate, sheet);
      let bonusMale = asInt(job.maleCount);
      let bonusFemale = asInt(job.femaleCount);
      if (bonusMale + bonusFemale === 0 && hc > 0) {
        bonusFemale = hc;
      }
      const nightlife = computeNightlife({
        maleGuests: bonusMale,
        femaleGuests: bonusFemale,
        baseRate: glInput.standardRatePerGuest,
        logicType: rate.logicType,
        maleRate: glInput.maleRate,
        femaleRate: glInput.femaleRate,
        otherCosts: job.otherCosts ?? 0,
        bonusType: bonusParams.bonusType,
        bonusGoal: bonusParams.bonusGoal,
        bonusAmount: bonusParams.bonusAmount,
        paymentStatus,
        bonusValid,
      });
      bonusGbp = nightlife.bonus;
      conciergeCutGbp = asMoney(guestlistRevenueGbp + bonusGbp);
      promoterCutGbp = computeJobLedgerAmountGbp(job);
      netSpendGbp = guestlistRevenueGbp;
      break;
    }
  }

  return {
    netSpendGbp,
    conciergeCutGbp,
    promoterCutGbp,
    bonusValid,
    guestlistRevenueGbp,
    bonusGbp,
    billingHeadcount: hc,
    ledgerAmountGbp: computeJobLedgerAmountGbp(job),
    sexRatioReason: ratio.reason,
  };
}

export function computeNightlife(
  input: NightlifeCalculationInput,
): NightlifeCalculationResult {
  const maleGuests = asInt(input.maleGuests);
  const femaleGuests = asInt(input.femaleGuests);
  const totalGuests = maleGuests + femaleGuests;
  const baseRate = asMoney(input.baseRate);
  const totalRevenue = asMoney(totalGuests * baseRate);
  const bonusGoal = asInt(input.bonusGoal);
  const bonusAmount = asMoney(input.bonusAmount);
  const bonusEligible = input.bonusValid !== false;
  let bonus = 0;
  if (bonusEligible && input.bonusType === "flat" && bonusGoal > 0 && totalGuests >= bonusGoal) {
    bonus = bonusAmount;
  } else if (
    bonusEligible &&
    input.bonusType === "stacking" &&
    bonusGoal > 0
  ) {
    bonus = asMoney(bonusAmount * Math.floor(femaleGuests / bonusGoal));
  }
  const otherCosts = asMoney(input.otherCosts);
  const projectedAgencyProfit = asMoney(totalRevenue + bonus - otherCosts);
  const paid = input.paymentStatus === "paid_final";
  const realizedAgencyProfit = paid ? projectedAgencyProfit : 0;
  const nearMissBonusGoal =
    bonusEligible && bonusGoal > 0 && totalGuests < bonusGoal && bonusGoal - totalGuests <= 2;

  return {
    totalGuests,
    totalRevenue,
    bonus,
    projectedAgencyProfit,
    realizedAgencyProfit,
    nearMissBonusGoal,
  };
}

export function computeService(
  input: ServiceCalculationInput,
): ServiceCalculationResult {
  const spend = asMoney(input.totalSpend);
  const commissionPercentage = Math.max(
    0,
    Math.min(100, Number.isFinite(input.commissionPercentage) ? input.commissionPercentage : 0),
  );
  const projectedAgencyProfit = asMoney(spend * (commissionPercentage / 100));
  return {
    projectedAgencyProfit,
    realizedAgencyProfit: input.paymentStatus === "paid_final" ? projectedAgencyProfit : 0,
  };
}

/** DB patch columns for `promoter_jobs` from a snapshot (Phase 6 integration). */
export function jobFinancialSnapshotToDbPatch(
  snapshot: JobFinancialSnapshot,
): Record<string, number | boolean> {
  return {
    net_spend_gbp: snapshot.netSpendGbp,
    concierge_cut_gbp: snapshot.conciergeCutGbp,
    promoter_cut_gbp: snapshot.promoterCutGbp,
    bonus_valid: snapshot.bonusValid,
  };
}
