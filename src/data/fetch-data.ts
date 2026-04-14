import type { SupabaseClient } from "@supabase/supabase-js";
import type { Car, Club, ClubFlyer, PromoterShiftAssignment } from "../types";
import { getSupabaseClient } from "../lib/supabase";

type CatalogRow = {
  payload: unknown;
};

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

type PromoterShiftRow = {
  id: string;
  promoter_id: string;
  club_slug: string | null;
  job_date: string;
  status: string;
  promoters: { id: string; display_name: string } | null;
};

export async function fetchClubs(): Promise<Club[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("clubs")
        .select("payload")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (!error && Array.isArray(data)) {
        return data
          .map((row) => (row as CatalogRow).payload)
          .filter((payload): payload is Club => Boolean(payload && typeof payload === "object"));
      }
      if (error) {
        console.warn(`[Cooper Concierge] clubs DB fetch failed: ${error.message}`);
      }
    } catch {
      // fall back to static json
    }
  }
  try {
    const r = await fetch("/data/clubs.json", { cache: "no-store" });
    if (!r.ok) return [];
    const data = (await r.json()) as unknown;
    return Array.isArray(data) ? (data as Club[]) : [];
  } catch {
    return [];
  }
}

export async function fetchCars(): Promise<Car[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("cars")
        .select("payload")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (!error && Array.isArray(data)) {
        return data
          .map((row) => (row as CatalogRow).payload)
          .filter((payload): payload is Car => Boolean(payload && typeof payload === "object"));
      }
      if (error) {
        console.warn(`[Cooper Concierge] cars DB fetch failed: ${error.message}`);
      }
    } catch {
      // fall back to static json
    }
  }
  try {
    const r = await fetch("/data/cars.json", { cache: "no-store" });
    if (!r.ok) return [];
    const data = (await r.json()) as unknown;
    return Array.isArray(data) ? (data as Car[]) : [];
  } catch {
    return [];
  }
}

/** All flyers (including inactive) for admin — requires authenticated admin session. */
export async function fetchClubFlyersAdmin(
  supabase: SupabaseClient,
): Promise<ClubFlyer[]> {
  try {
    const { data, error } = await supabase
      .from("club_weekly_flyers")
      .select(
        "id,club_slug,event_date,title,description,image_path,image_url,is_active,sort_order",
      )
      .order("event_date", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      console.warn(`[Cooper Concierge] club flyers admin fetch failed: ${error.message}`);
      return [];
    }
    if (!Array.isArray(data)) return [];
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

export async function fetchClubFlyers(): Promise<ClubFlyer[]> {
  const supabase = getSupabaseClient();
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
    if (error) {
      console.warn(`[Cooper Concierge] club flyers DB fetch failed: ${error.message}`);
      return [];
    }
    if (!Array.isArray(data)) return [];
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

export async function fetchPromoterAssignments(
  dateIso?: string,
): Promise<PromoterShiftAssignment[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const date = dateIso?.trim() || new Date().toISOString().slice(0, 10);
  try {
    const { data, error } = await supabase
      .from("promoter_jobs")
      .select("id,promoter_id,club_slug,job_date,status,promoters(id,display_name)")
      .eq("job_date", date)
      .in("status", ["assigned", "completed"]);
    if (error || !Array.isArray(data)) return [];
    return data
      .map((raw) => {
        const row = raw as unknown as PromoterShiftRow;
        if (!row.club_slug) return null;
        return {
          jobId: String(row.id || ""),
          promoterId: String(row.promoter_id || ""),
          promoterName: String(row.promoters?.display_name || "Promoter"),
          clubSlug: String(row.club_slug),
          jobDate: String(row.job_date || ""),
          status:
            (String(row.status || "assigned") as PromoterShiftAssignment["status"]),
        };
      })
      .filter((x): x is PromoterShiftAssignment => Boolean(x?.jobId && x.clubSlug));
  } catch {
    return [];
  }
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
