import type { Car, Club } from "../types";

export async function fetchClubs(): Promise<Club[]> {
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
  try {
    const r = await fetch("/data/cars.json", { cache: "no-store" });
    if (!r.ok) return [];
    const data = (await r.json()) as unknown;
    return Array.isArray(data) ? (data as Car[]) : [];
  } catch {
    return [];
  }
}
