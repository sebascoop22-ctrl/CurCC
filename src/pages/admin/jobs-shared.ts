import type { PromoterJob, PromoterJobAdminRow, PromoterJobType } from "../../types";
import {
  buildJobFinancialSnapshot,
  resolveClubRateForJob,
} from "../../lib/financial/calculations";
import type { FinancialClubPaymentRate } from "../../types";
import { jobToSnapshotInput } from "../../lib/financial/job-snapshot-sync";
import {
  formatGbp,
  jobTypeLabel,
  PROMOTER_JOB_TYPES as ADMIN_JOB_TYPES,
} from "../../lib/financial/job-display";

export { ADMIN_JOB_TYPES, formatGbp, jobTypeLabel };

export type JobsLedgerFilters = {
  promoterId: string;
  clubSlug: string;
  jobType: string;
  status: string;
  adminConfirmed: "" | "yes" | "no";
  paid: "" | "yes" | "no";
  bonusValid: "" | "yes" | "no";
};

export function defaultJobsLedgerFilters(): JobsLedgerFilters {
  return {
    promoterId: "",
    clubSlug: "",
    jobType: "",
    status: "",
    adminConfirmed: "",
    paid: "",
    bonusValid: "",
  };
}

export function truncateDisplay(s: string, max: number): string {
  const t = String(s).replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export function jobTypeCalModifier(t: PromoterJobType): string {
  return `admin-jobs__cal-pill--type-${t.replace("_", "-")}`;
}

export function filterJobsRows(
  rows: PromoterJobAdminRow[],
  filters: JobsLedgerFilters,
  search: string,
): PromoterJobAdminRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((j) => {
    if (filters.promoterId && j.promoterId !== filters.promoterId) return false;
    if (filters.clubSlug && (j.clubSlug ?? "") !== filters.clubSlug) return false;
    if (filters.jobType && j.jobType !== filters.jobType) return false;
    if (filters.status && j.status !== filters.status) return false;
    if (filters.adminConfirmed === "yes" && !j.adminConfirmed) return false;
    if (filters.adminConfirmed === "no" && j.adminConfirmed) return false;
    if (filters.paid === "yes" && !j.paid) return false;
    if (filters.paid === "no" && j.paid) return false;
    if (filters.bonusValid === "yes" && !j.bonusValid) return false;
    if (filters.bonusValid === "no" && j.bonusValid) return false;
    if (q) {
      const hay = [
        j.jobDate,
        j.clubSlug ?? "",
        j.promoterDisplayName,
        j.clientName ?? "",
        j.notes,
        jobTypeLabel(j.jobType),
        j.status,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type JobLedgerKpis = {
  total: number;
  confirmed: number;
  paid: number;
  bonusBlocked: number;
};

export function computeJobLedgerKpis(rows: PromoterJobAdminRow[]): JobLedgerKpis {
  return {
    total: rows.length,
    confirmed: rows.filter((j) => j.adminConfirmed).length,
    paid: rows.filter((j) => j.paid).length,
    bonusBlocked: rows.filter((j) => !j.bonusValid).length,
  };
}

export type JobComputedFinancials = {
  conciergeCutGbp: number;
  promoterCutGbp: number;
  bonusValid: boolean;
  bonusGbp: number;
  guestlistRevenueGbp: number;
  netSpendGbp: number;
  sexRatioReason?: string;
  hasRateOverride: boolean;
};

export function computeJobDisplayFinancials(
  job: PromoterJob,
  rates: FinancialClubPaymentRate[],
): JobComputedFinancials {
  const resolved = resolveClubRateForJob(job.clubSlug ?? "", job.jobDate, job.jobType, rates, {
    clubPaymentRateId: job.clubPaymentRateId,
  });
  const snap = buildJobFinancialSnapshot(jobToSnapshotInput(job), resolved);
  const hasRateOverride =
    job.rateOverride != null &&
    typeof job.rateOverride === "object" &&
    Object.keys(job.rateOverride).length > 0;
  return {
    conciergeCutGbp: snap.conciergeCutGbp,
    promoterCutGbp: snap.promoterCutGbp,
    bonusValid: snap.bonusValid,
    bonusGbp: snap.bonusGbp,
    guestlistRevenueGbp: snap.guestlistRevenueGbp,
    netSpendGbp: snap.netSpendGbp,
    sexRatioReason: snap.sexRatioReason,
    hasRateOverride,
  };
}

export function displayConciergeGbp(job: PromoterJob, computed: JobComputedFinancials): number {
  if (job.conciergeCutGbp > 0 || job.status === "completed") return job.conciergeCutGbp;
  return computed.conciergeCutGbp;
}

export function displayPromoterGbp(job: PromoterJob, computed: JobComputedFinancials): number {
  if (job.promoterCutGbp > 0 || job.status === "completed") return job.promoterCutGbp;
  return computed.promoterCutGbp;
}
