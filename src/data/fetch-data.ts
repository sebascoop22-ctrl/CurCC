import type { Car, Club, ClubFlyer } from "../types";
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
