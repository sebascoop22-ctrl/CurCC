export type VenueType = "lounge" | "dining";

/** From `public/clubs/guestlists.csv` — merged at build time */
export type GuestlistRecurrence = "one_off" | "weekly";

export interface GuestlistOffer {
  days: string[];
  recurrence: GuestlistRecurrence;
  notes: string;
}

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
  /** Door / guestlist — women (CSV `entry_pricing_women`) */
  entryPricingWomen: string;
  /** Door / guestlist — men (CSV `entry_pricing_men`) */
  entryPricingMen: string;
  /** Table tier copy from CSV */
  tablesStandard: string;
  tablesLuxury: string;
  tablesVip: string;
  /** Standout points; semicolon-separated in CSV → array */
  knownFor: string[];
  amenities: string[];
  images: string[];
  /** Guestlist rows for this venue (empty if none in guestlists.csv) */
  guestlists: GuestlistOffer[];
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
