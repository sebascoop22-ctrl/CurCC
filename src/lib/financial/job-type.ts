/** V4 operational job types (`promoter_jobs.job_type`). */
export type PromoterJobType = "guestlist" | "table" | "ticket" | "venue_hire";

/** Legacy `promoter_jobs.service` values kept in sync via DB trigger. */
export type PromoterJobService = "guestlist" | "table_sale" | "tickets" | "other";

const JOB_TYPES: PromoterJobType[] = ["guestlist", "table", "ticket", "venue_hire"];

export function parsePromoterJobType(raw: unknown): PromoterJobType {
  const v = String(raw ?? "").trim().toLowerCase();
  if (JOB_TYPES.includes(v as PromoterJobType)) return v as PromoterJobType;
  return serviceToJobType(raw);
}

export function serviceToJobType(service: unknown): PromoterJobType {
  const v = String(service ?? "").trim().toLowerCase();
  if (v === "guestlist") return "guestlist";
  if (v === "table_sale" || v === "private_table" || v === "table") return "table";
  if (v === "tickets" || v === "ticket") return "ticket";
  if (v === "venue_access" || v === "venue_hire" || v === "other") return "venue_hire";
  return "guestlist";
}

export function jobTypeToService(jobType: PromoterJobType): PromoterJobService {
  switch (jobType) {
    case "table":
      return "table_sale";
    case "ticket":
      return "tickets";
    case "venue_hire":
      return "other";
    default:
      return "guestlist";
  }
}

export function parsePromoterJobService(raw: unknown): PromoterJobService {
  const fromType = parsePromoterJobType(raw);
  const mapped = jobTypeToService(fromType);
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "guestlist" || v === "table_sale" || v === "tickets" || v === "other") {
    return v as PromoterJobService;
  }
  if (v === "private_table" || v === "table") return "table_sale";
  if (v === "ticket") return "tickets";
  if (v === "venue_access" || v === "venue_hire") return "other";
  return mapped;
}
