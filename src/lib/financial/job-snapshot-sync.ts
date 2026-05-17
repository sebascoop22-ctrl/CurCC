import type { FinancialClubPaymentRate, PromoterJob } from "../../types";
import {
  buildJobFinancialSnapshot,
  resolveClubRateForJob,
  type JobFinancialSnapshotInput,
} from "./calculations";
import type { PromoterJobType } from "./job-type";

export type JobFinancialDbPatch = {
  net_spend_gbp: number;
  concierge_cut_gbp: number;
  promoter_cut_gbp: number;
  bonus_valid: boolean;
  club_payment_rate_id?: string | null;
};

export function jobToSnapshotInput(job: PromoterJob): JobFinancialSnapshotInput {
  return {
    jobType: job.jobType,
    jobDate: job.jobDate,
    clubSlug: job.clubSlug,
    maleCount: job.maleCount,
    femaleCount: job.femaleCount,
    guestsCount: job.guestsCount,
    guestsJoined: job.guestsJoined,
    guestsEntered: job.guestsEntered,
    ticketsSold: job.ticketsSold,
    grossSpendGbp: job.grossSpendGbp,
    shiftFee: job.shiftFee,
    guestlistFee: job.guestlistFee,
    bonusValid: job.bonusValid,
  };
}

/** GBP columns on `promoter_jobs` from venue rate + headcount (Phase 4 engine). */
export function financialDbPatchForJob(
  job: PromoterJob,
  rates: FinancialClubPaymentRate[],
): JobFinancialDbPatch {
  const resolved = resolveClubRateForJob(job.clubSlug ?? "", job.jobDate, job.jobType, rates, {
    clubPaymentRateId: job.clubPaymentRateId,
  });
  const snap = buildJobFinancialSnapshot(jobToSnapshotInput(job), resolved);
  const patch: JobFinancialDbPatch = {
    net_spend_gbp: snap.netSpendGbp,
    concierge_cut_gbp: snap.conciergeCutGbp,
    promoter_cut_gbp: snap.promoterCutGbp,
    bonus_valid: snap.bonusValid,
  };
  if (!job.clubPaymentRateId?.trim() && resolved?.rate.id) {
    patch.club_payment_rate_id = resolved.rate.id;
  }
  return patch;
}

export function resolveDefaultClubPaymentRateId(
  clubSlug: string,
  jobDate: string,
  jobType: PromoterJobType,
  rates: FinancialClubPaymentRate[],
): string | null {
  const resolved = resolveClubRateForJob(clubSlug, jobDate, jobType, rates);
  return resolved?.rate.id ?? null;
}
