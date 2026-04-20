import type { PromoterShiftAssignment } from "../types";

/** Rows returned by `public.guestlist_hosts_for_date` (JSON). */
type RpcGuestlistHostRow = {
  jobId?: string;
  promoterId?: string;
  promoterName?: string;
  clubSlug?: string;
  jobDate?: string;
  status?: string;
  source?: string;
};

/**
 * Map RPC JSON (array of objects) to `PromoterShiftAssignment[]`.
 * `jobId` may be a real job UUID or a synthetic `pref:promoterId:clubSlug`.
 */
export function parseGuestlistHostsFromRpc(data: unknown): PromoterShiftAssignment[] {
  if (!Array.isArray(data)) return [];
  const out: PromoterShiftAssignment[] = [];
  for (const raw of data) {
    const r = raw as RpcGuestlistHostRow;
    const jobId = String(r.jobId ?? "").trim();
    const promoterId = String(r.promoterId ?? "").trim();
    const clubSlug = String(r.clubSlug ?? "").trim();
    const jobDate = String(r.jobDate ?? "").trim().slice(0, 10);
    const promoterName = String(r.promoterName ?? "").trim() || "Host";
    const st = String(r.status ?? "assigned").trim();
    const status =
      st === "completed" || st === "cancelled" || st === "assigned"
        ? st
        : "assigned";
    const source =
      r.source === "preference"
        ? ("preference" as const)
        : ("job" as const);
    if (!jobId || !clubSlug) continue;
    out.push({
      jobId,
      promoterId,
      promoterName,
      clubSlug,
      jobDate,
      status: status as PromoterShiftAssignment["status"],
      source,
    });
  }
  return out;
}
