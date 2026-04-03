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
  /** Short labels from CSV (e.g. Thu, Fri) — pipe-separated in public/clubs/clubs.csv */
  bestVisitDays: string[];
  featured: boolean;
  /** Home featured banner: YYYY-MM-DD or DD/MM/YYYY for one-off dates; or weekday names (e.g. "Monday Wednesday"). */
  featuredDay: string;
  venueType: VenueType;
  lat: number;
  lng: number;
  minSpend: string;
  /** Full URL from CSV (build normalizes scheme) */
  website: string;
  /** Guestlist / door pricing (plain text from CSV) */
  entryPricing: string;
  /** Table packages and minimums (plain text from CSV) */
  tablesPricing: string;
  /** Scene and standout nights (plain text from CSV) */
  knownFor: string;
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
