import type {
  Club,
  ClubFlyer,
  GuestlistEventContext,
  PromoterShiftAssignment,
} from "../src/types";
import { parseGuestlistHostsFromRpc } from "../src/lib/guestlist-hosts.js";
import { normalizeClubPayload } from "./normalize-club.js";
import { createServerSupabase } from "./supabase-server.js";
import { siteOrigin } from "./site-base.js";

type CatalogRow = { payload: unknown; sort_order: number | null };

type FlyerRow = {
  id: string;
  club_slug: string;
  event_date: string;
  title: string | null;
  description: string | null;
  image_path: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number | null;
};

type EventContextRow = {
  id: string;
  club_slug: string;
  event_date: string;
  status: "open" | "closed" | "cancelled";
  capacity: number | null;
};

export type ClubRow = { club: Club; sortOrder: number };

export async function fetchClubRowsFromDb(): Promise<ClubRow[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("clubs")
    .select("payload,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error || !Array.isArray(data)) return [];
  const out: ClubRow[] = [];
  for (const row of data as CatalogRow[]) {
    const p = row.payload;
    if (!p || typeof p !== "object") continue;
    out.push({
      club: normalizeClubPayload(p as Club),
      sortOrder: Number(row.sort_order) || 0,
    });
  }
  return out;
}

async function fetchClubsJsonFallback(): Promise<ClubRow[]> {
  const origin = siteOrigin();
  try {
    const r = await fetch(`${origin}/data/clubs.json`, { cache: "no-store" });
    if (!r.ok) return [];
    const data = (await r.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return (data as Club[]).map((c, i) => ({
      club: normalizeClubPayload(c),
      sortOrder: i,
    }));
  } catch {
    return [];
  }
}

export async function loadClubCatalog(): Promise<ClubRow[]> {
  const fromDb = await fetchClubRowsFromDb();
  if (fromDb.length) return fromDb;
  return fetchClubsJsonFallback();
}

/** Case-insensitive slug match (URL segment vs DB/CSV casing). */
export function findClubRowBySlug(
  rows: ClubRow[],
  slug: string,
): ClubRow | undefined {
  const q = slug.trim().toLowerCase();
  if (!q) return undefined;
  return rows.find((r) => r.club.slug.toLowerCase() === q);
}

export async function fetchClubFlyersServer(): Promise<ClubFlyer[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("club_weekly_flyers")
      .select(
        "id,club_slug,event_date,title,description,image_path,image_url,is_active,sort_order",
      )
      .eq("is_active", true)
      .order("event_date", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => {
      const flyer = row as FlyerRow;
      return {
        id: String(flyer.id || ""),
        clubSlug: String(flyer.club_slug || "").trim(),
        eventDate: String(flyer.event_date || ""),
        title: String(flyer.title || "").trim(),
        description: String(flyer.description || "").trim(),
        imagePath: String(flyer.image_path || "").trim(),
        imageUrl: String(flyer.image_url || "").trim(),
        isActive: Boolean(flyer.is_active),
        sortOrder: Number(flyer.sort_order || 0) || 0,
      };
    });
  } catch {
    return [];
  }
}

export async function fetchPromoterAssignmentsServer(
  dateIso?: string,
): Promise<PromoterShiftAssignment[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];
  const date = dateIso?.trim() || new Date().toISOString().slice(0, 10);
  try {
    const { data, error } = await supabase.rpc("guestlist_hosts_for_date", {
      p_date: date,
    });
    if (error) return [];
    return parseGuestlistHostsFromRpc(data);
  } catch {
    return [];
  }
}

export async function fetchGuestlistEventContextsServer(
  dateIso?: string,
): Promise<GuestlistEventContext[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];
  const date = dateIso?.trim() || new Date().toISOString().slice(0, 10);
  try {
    const [{ data: events, error: eventError }, { data: metrics, error: metricError }] =
      await Promise.all([
        supabase
          .from("guestlist_events")
          .select("id,club_slug,event_date,status,capacity")
          .eq("event_date", date),
        supabase.rpc("get_guestlist_conversion_metrics", {
          p_club_slug: null,
          p_promoter_id: null,
          p_from: date,
          p_to: date,
        }),
      ]);
    if (eventError || metricError || !Array.isArray(events) || !Array.isArray(metrics)) {
      return [];
    }
    const metricsByEvent = new Map<
      string,
      { signups: number; attended: number; conversion: number }
    >();
    for (const raw of metrics) {
      const r = raw as Record<string, unknown>;
      metricsByEvent.set(String(r.event_id ?? ""), {
        signups: Number(r.signups ?? 0) || 0,
        attended: Number(r.attended ?? 0) || 0,
        conversion: Number(r.conversion ?? 0) || 0,
      });
    }
    return events.map((raw) => {
      const row = raw as unknown as EventContextRow;
      const metric = metricsByEvent.get(String(row.id || "")) || {
        signups: 0,
        attended: 0,
        conversion: 0,
      };
      return {
        eventId: String(row.id || ""),
        clubSlug: String(row.club_slug || ""),
        eventDate: String(row.event_date || ""),
        status: row.status || "open",
        capacity: Number(row.capacity || 0) || 0,
        signups: metric.signups,
        attended: metric.attended,
        conversion: metric.conversion,
      };
    });
  } catch {
    return [];
  }
}

export function groupFlyersByClubSlug(
  flyers: ClubFlyer[],
): Record<string, ClubFlyer[]> {
  const out: Record<string, ClubFlyer[]> = {};
  for (const flyer of flyers) {
    const slug = flyer.clubSlug.trim();
    if (!slug) continue;
    if (!out[slug]) out[slug] = [];
    out[slug].push(flyer);
  }
  return out;
}

export function groupAssignmentsByClub(
  rows: PromoterShiftAssignment[],
): Record<string, PromoterShiftAssignment[]> {
  const by: Record<string, PromoterShiftAssignment[]> = {};
  for (const row of rows) {
    const slug = row.clubSlug.trim();
    if (!slug) continue;
    if (!by[slug]) by[slug] = [];
    by[slug].push(row);
  }
  return by;
}
