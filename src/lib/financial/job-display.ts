import type { PromoterJobType } from "./job-type";

export const PROMOTER_JOB_TYPES: PromoterJobType[] = [
  "guestlist",
  "table",
  "ticket",
  "venue_hire",
];

export function formatGbp(n: number): string {
  return `£${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

export function jobTypeLabel(t: PromoterJobType): string {
  switch (t) {
    case "guestlist":
      return "Guestlist";
    case "table":
      return "Table";
    case "ticket":
      return "Ticket";
    case "venue_hire":
      return "Venue hire";
    default:
      return t;
  }
}

export function legacyServiceLabel(service: string): string {
  const s = String(service || "").trim().toLowerCase();
  if (s === "table_sale") return "Table";
  if (s === "tickets") return "Tickets";
  if (s === "guestlist") return "Guestlist";
  return service || "—";
}
