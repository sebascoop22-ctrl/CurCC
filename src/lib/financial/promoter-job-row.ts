import type { PromoterJob } from "../../types";
import { parsePromoterJobService, parsePromoterJobType } from "./job-type";

type Raw = Record<string, unknown>;

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const PROMOTER_JOB_SELECT =
  "id,promoter_id,club_slug,service,job_type,job_date,status,client_name,client_contact,client_id,guests_count,shift_fee,guestlist_fee,notes,admin_confirmed,paid,male_count,female_count,guests_joined,guests_entered,tickets_sold,gross_spend_gbp,net_spend_gbp,concierge_cut_gbp,promoter_cut_gbp,bonus_valid,rate_override,club_payment_rate_id,financial_booking_id";

export function mapPromoterJobRow(raw: Raw): PromoterJob {
  const jobType = parsePromoterJobType(raw.job_type ?? raw.service);
  const rateOverride = raw.rate_override;
  return {
    id: String(raw.id ?? ""),
    promoterId: String(raw.promoter_id ?? ""),
    clubSlug: raw.club_slug != null ? String(raw.club_slug) : null,
    service: parsePromoterJobService(raw.service ?? jobType),
    jobType,
    jobDate: String(raw.job_date ?? "").slice(0, 10),
    status: String(raw.status ?? "assigned") as PromoterJob["status"],
    clientName: String(raw.client_name ?? "").trim() || undefined,
    clientContact: String(raw.client_contact ?? "").trim() || undefined,
    clientId: raw.client_id != null ? String(raw.client_id) : null,
    guestsCount: asNumber(raw.guests_count),
    shiftFee: asNumber(raw.shift_fee),
    guestlistFee: asNumber(raw.guestlist_fee),
    adminConfirmed: Boolean(raw.admin_confirmed),
    paid: Boolean(raw.paid),
    maleCount: Math.max(0, Math.round(asNumber(raw.male_count))),
    femaleCount: Math.max(0, Math.round(asNumber(raw.female_count))),
    guestsJoined: Math.max(0, Math.round(asNumber(raw.guests_joined))),
    guestsEntered: Math.max(0, Math.round(asNumber(raw.guests_entered))),
    ticketsSold: Math.max(0, Math.round(asNumber(raw.tickets_sold))),
    grossSpendGbp: asNumber(raw.gross_spend_gbp),
    netSpendGbp: asNumber(raw.net_spend_gbp),
    conciergeCutGbp: asNumber(raw.concierge_cut_gbp),
    promoterCutGbp: asNumber(raw.promoter_cut_gbp),
    bonusValid: raw.bonus_valid !== false,
    rateOverride:
      rateOverride && typeof rateOverride === "object" && !Array.isArray(rateOverride)
        ? (rateOverride as Record<string, unknown>)
        : {},
    notes: String(raw.notes ?? ""),
    clubPaymentRateId:
      raw.club_payment_rate_id != null ? String(raw.club_payment_rate_id) : null,
    financialBookingId:
      raw.financial_booking_id != null ? String(raw.financial_booking_id) : null,
  };
}
