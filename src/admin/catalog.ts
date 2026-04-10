import type { SupabaseClient } from "@supabase/supabase-js";
import type { Car, Club } from "../types";

export type ClubRow = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  payload: Club;
};

export type CarRow = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  payload: Car;
};

function asClubPayload(v: unknown): Club | null {
  return v && typeof v === "object" ? (v as Club) : null;
}

function asCarPayload(v: unknown): Car | null {
  return v && typeof v === "object" ? (v as Car) : null;
}

export async function loadClubsForAdmin(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: ClubRow[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("clubs")
    .select("id, slug, name, sort_order, is_active, payload")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return { ok: false, message: error.message };
  const rows: ClubRow[] = (data ?? [])
    .map((raw) => {
      const r = raw as Record<string, unknown>;
      const payload = asClubPayload(r.payload);
      if (!payload) return null;
      return {
        id: String(r.id ?? ""),
        slug: String(r.slug ?? "").trim(),
        name: String(r.name ?? "").trim(),
        sort_order: Number(r.sort_order) || 0,
        is_active: Boolean(r.is_active),
        payload,
      };
    })
    .filter((x): x is ClubRow => Boolean(x?.id && x.slug));
  return { ok: true, rows };
}

export async function loadCarsForAdmin(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: CarRow[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("cars")
    .select("id, slug, name, sort_order, is_active, payload")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return { ok: false, message: error.message };
  const rows: CarRow[] = (data ?? [])
    .map((raw) => {
      const r = raw as Record<string, unknown>;
      const payload = asCarPayload(r.payload);
      if (!payload) return null;
      return {
        id: String(r.id ?? ""),
        slug: String(r.slug ?? "").trim(),
        name: String(r.name ?? "").trim(),
        sort_order: Number(r.sort_order) || 0,
        is_active: Boolean(r.is_active),
        payload,
      };
    })
    .filter((x): x is CarRow => Boolean(x?.id && x.slug));
  return { ok: true, rows };
}

export async function upsertClubToDb(
  supabase: SupabaseClient,
  club: Club,
  opts: { sortOrder: number; isActive: boolean },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const slug = club.slug.trim();
  if (!slug) return { ok: false, message: "Club slug is required." };
  const row = {
    slug,
    name: club.name.trim() || slug,
    sort_order: opts.sortOrder,
    is_active: opts.isActive,
    payload: club,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("clubs").upsert(row, {
    onConflict: "slug",
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function upsertCarToDb(
  supabase: SupabaseClient,
  car: Car,
  opts: { sortOrder: number; isActive: boolean },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const slug = car.slug.trim();
  if (!slug) return { ok: false, message: "Car slug is required." };
  const row = {
    slug,
    name: car.name.trim() || slug,
    sort_order: opts.sortOrder,
    is_active: opts.isActive,
    payload: car,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("cars").upsert(row, {
    onConflict: "slug",
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteClubFromDb(
  supabase: SupabaseClient,
  slug: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("clubs").delete().eq("slug", slug.trim());
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteCarFromDb(
  supabase: SupabaseClient,
  slug: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("cars").delete().eq("slug", slug.trim());
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function upsertAllClubsOrder(
  supabase: SupabaseClient,
  clubs: Club[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  for (let i = 0; i < clubs.length; i++) {
    const res = await upsertClubToDb(supabase, clubs[i], {
      sortOrder: i + 1,
      isActive: true,
    });
    if (!res.ok) return res;
  }
  return { ok: true };
}

export async function upsertAllCarsOrder(
  supabase: SupabaseClient,
  cars: Car[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  for (let i = 0; i < cars.length; i++) {
    const res = await upsertCarToDb(supabase, cars[i], {
      sortOrder: cars[i].order || i + 1,
      isActive: true,
    });
    if (!res.ok) return res;
  }
  return { ok: true };
}
