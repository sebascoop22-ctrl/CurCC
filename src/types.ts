export type VenueType = "club" | "dining" | "lounge";

/** From `public/clubs/guestlists.csv` — merged at build time */
export type GuestlistRecurrence = "one_off" | "weekly";

export interface GuestlistOffer {
  days: string[];
  recurrence: GuestlistRecurrence;
  notes: string;
}

export interface PaymentDetails {
  method: string;
  beneficiaryName: string;
  accountNumber: string;
  sortCode: string;
  iban: string;
  swiftBic: string;
  reference: string;
  payoutEmail: string;
}

export interface TaxDetails {
  registeredName: string;
  taxId: string;
  vatNumber: string;
  countryCode: string;
  isVatRegistered: boolean;
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
  /**
   * Optional overrides for nightlife discovery cards (carousel + all-venues grid).
   * When unset, cards use `name`, `shortDescription`, and `images[0]`.
   */
  discoveryCardTitle?: string;
  discoveryCardBlurb?: string;
  discoveryCardImage?: string;
  /** Optional video URLs (YouTube/Vimeo/direct); from CSV `video_urls` or DB payload */
  videos?: string[];
  /**
   * When false, venue is listed but Cooper has no operational partnership yet
   * (sorting + CTAs treat as non-guestlist partner).
   */
  hasPartnership?: boolean;
  /** Guestlist rows for this venue (empty if none in guestlists.csv) */
  guestlists: GuestlistOffer[];
  paymentDetails?: PaymentDetails;
  taxDetails?: TaxDetails;
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
  /** Primary / legacy single image (first of `profileImageUrls` when set). */
  profileImageUrl: string;
  /** Approved gallery URLs (max 12). */
  profileImageUrls: string[];
  /** Club slugs highlighted on the promoter profile (coordinator-facing). */
  portfolioClubSlugs: string[];
  paymentDetails: PaymentDetails;
  taxDetails: TaxDetails;
  isApproved: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
  approvalNotes: string;
}

/** One-off calendar-night availability override; admin approves before it is relied on. */
export interface PromoterNightAdjustment {
  id: string;
  promoterId: string;
  nightDate: string;
  availableOverride: boolean;
  startTime: string | null;
  endTime: string | null;
  notes: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string;
}

export type PromoterNightAdjustmentQueueRow = PromoterNightAdjustment & {
  promoterDisplayName: string;
};

/** Row in `public.promoter_signup_requests` */
export interface PromoterSignupRequest {
  id: string;
  fullName: string;
  email: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  denialReason: string | null;
  authUserId: string | null;
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
  service: PromoterJobService;
  jobDate: string;
  status: "assigned" | "completed" | "cancelled";
  guestsCount: number;
  shiftFee: number;
  guestlistFee: number;
  clientName?: string;
  clientContact?: string;
  notes: string;
}

export type PromoterJobService = "guestlist" | "table_sale" | "tickets" | "other";

/** Job row with promoter display name for admin calendar / list views. */
export type PromoterJobAdminRow = PromoterJob & {
  promoterDisplayName: string;
};

export interface PromoterInvoice {
  id: string;
  promoterId: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "finalized" | "paid" | "cancelled";
  subtotal: number;
  adjustments: number;
  total: number;
  /** When the statement was emailed via Resend (Edge Function). */
  sentAt: string | null;
  sentToEmail: string;
  /** e.g. `resend` when sent through the invoice Edge Function. */
  emailedVia: string;
}

/** Row in `public.promoter_guestlist_entries` (promoter-submitted guests; admin approves for billing). */
export interface PromoterGuestlistEntry {
  id: string;
  promoterJobId: string;
  guestName: string;
  guestContact: string;
  approvalStatus: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string;
}

/** Pending entry + job context for the admin review queue. */
export type PromoterGuestlistQueueRow = PromoterGuestlistEntry & {
  jobDate: string;
  clubSlug: string | null;
  promoterDisplayName: string;
};

export interface PromoterShiftAssignment {
  /** Real job id, or synthetic `pref:promoterId:clubSlug` when from approved club preferences. */
  jobId: string;
  promoterId: string;
  promoterName: string;
  clubSlug: string;
  jobDate: string;
  status: "assigned" | "completed" | "cancelled";
  /** Populated when data comes from `guestlist_hosts_for_date` RPC. */
  source?: "job" | "preference";
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

/** Table / min-spend booking log (`public.promoter_table_sales`). */
export interface PromoterTableSale {
  id: string;
  promoterId: string;
  clubSlug: string;
  saleDate: string;
  promoterJobId: string | null;
  entryChannel: "promoter" | "admin";
  tier: "standard" | "luxury" | "vip" | "other";
  tableCount: number;
  totalMinSpend: number;
  clientName?: string;
  clientContact?: string;
  notes: string;
  approvalStatus: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string;
}

export type PromoterTableSaleQueueRow = PromoterTableSale & {
  promoterDisplayName: string;
};

export type PromoterTableSaleReportRow = PromoterTableSale & {
  promoterDisplayName: string;
};

export type FinancialDirection = "income" | "expense";
export type FinancialStatus = "pending" | "paid" | "cancelled" | "failed";
export type FinancialRecurrenceUnit = "monthly" | "quarterly" | "annual" | "custom_days";

export interface FinancialPayee {
  id: string;
  name: string;
  defaultPaymentTag: string;
  defaultCurrency: string;
  paymentDetails: PaymentDetails;
  taxDetails: TaxDetails;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialTransactionRow {
  id: string;
  txDate: string;
  category: string;
  direction: FinancialDirection;
  status: FinancialStatus;
  paymentTag: string;
  amount: number;
  currency: string;
  convertForeign: boolean;
  sourceType: string;
  sourceRef: string | null;
  payeeId: string | null;
  payeeLabel: string;
  notes: string;
  createdAt: string;
}

export interface FinancialRecurringTemplate {
  id: string;
  label: string;
  category: string;
  direction: FinancialDirection;
  defaultStatus: FinancialStatus;
  paymentTag: string;
  amount: number;
  currency: string;
  convertForeign: boolean;
  payeeId: string | null;
  payeeLabel: string;
  notes: string;
  intervalDays: number;
  recurrenceUnit: FinancialRecurrenceUnit;
  recurrenceEvery: number;
  nextDueDate: string;
  isActive: boolean;
  lastGeneratedOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialPeriodSummary {
  income: number;
  expense: number;
  net: number;
  txCount: number;
}
