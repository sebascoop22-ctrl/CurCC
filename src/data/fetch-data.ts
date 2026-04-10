import type { Car, Club } from "../types";
import { getSupabaseClient } from "../lib/supabase";

type CatalogRow = {
  payload: unknown;
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
