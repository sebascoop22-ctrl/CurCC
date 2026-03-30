export type VenueType = "lounge" | "dining";

export interface Club {
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  reviews: string[];
  locationTag: string;
  address: string;
  daysOpen: string;
  /** Short labels from CSV (e.g. Thu, Fri) — pipe-separated in club.csv */
  bestVisitDays: string[];
  featured: boolean;
  featuredDay: string;
  venueType: VenueType;
  lat: number;
  lng: number;
  minSpend: string;
  /** Full URL from CSV (build normalizes scheme) */
  website: string;
  amenities: string[];
  images: string[];
}

export type FleetGridSize = "large" | "medium" | "feature";

export interface Car {
  slug: string;
  name: string;
  roleLabel: string;
  specsHover: string[];
  gridSize: FleetGridSize;
  order: number;
  images: string[];
}
