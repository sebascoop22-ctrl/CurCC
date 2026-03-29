import type { Car, Club } from "../types";

export async function fetchClubs(): Promise<Club[]> {
  const r = await fetch("/data/clubs.json", { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to load clubs");
  return r.json() as Promise<Club[]>;
}

export async function fetchCars(): Promise<Car[]> {
  const r = await fetch("/data/cars.json", { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to load cars");
  return r.json() as Promise<Car[]>;
}
