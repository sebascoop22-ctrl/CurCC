export type VenueType = "club" | "dining" | "lounge";

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

export interface ClubFlyer {
  id: string;
  clubSlug: string;
  eventDate: string;
  title: string;
  description: string;
  imagePath: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
}

export interface FeaturedRecommendation {
  date: Date;
  clubs: Club[];
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

export interface PromoterProfile {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  profileImageUrl: string;
  isApproved: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
  approvalNotes: string;
}

export interface PromoterAvailabilitySlot {
  id: string;
  promoterId: string;
  weekday: number;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface PromoterClubPreference {
  id: string;
  promoterId: string;
  clubSlug: string;
  weekdays: string[];
  notes: string;
  status: "pending" | "approved" | "rejected";
}

export interface PromoterJob {
  id: string;
  promoterId: string;
  clubSlug: string | null;
  service: string;
  jobDate: string;
  status: "assigned" | "completed" | "cancelled";
  guestsCount: number;
  shiftFee: number;
  guestlistFee: number;
  notes: string;
}

export interface PromoterInvoice {
  id: string;
  promoterId: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "finalized" | "paid" | "cancelled";
  subtotal: number;
  adjustments: number;
  total: number;
}

export interface PromoterShiftAssignment {
  jobId: string;
  promoterId: string;
  promoterName: string;
  clubSlug: string;
  jobDate: string;
  status: "assigned" | "completed" | "cancelled";
}

export interface GuestlistEventContext {
  eventId: string;
  clubSlug: string;
  eventDate: string;
  status: "open" | "closed" | "cancelled";
  capacity: number;
  signups: number;
  attended: number;
  conversion: number;
}
