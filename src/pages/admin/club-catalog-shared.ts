import { normalizeCatalogSlug } from "../../lib/catalog-slug";
import type { Club, GuestlistRecurrence, VenueType } from "../../types";
import { parseMasterVenueType } from "./club-catalog-venue";

export { normalizeCatalogSlug } from "../../lib/catalog-slug";

export type ClubEntry = { dbId: string | null; club: Club; isActive: boolean };

export type ClubDetailTab =
  | "overview"
  | "guestlist"
  | "tickets"
  | "tables"
  | "events"
  | "banking"
  | "listing"
  | "media"
  | "jobs"
  | "promoters";

const CLUB_DETAIL_TAB_ALIASES: Record<string, ClubDetailTab> = {
  general: "overview",
  financial: "banking",
  rates: "guestlist",
  payments: "banking",
  accounts: "promoters",
};

export const CLUB_DETAIL_TABS: Array<{ id: ClubDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "guestlist", label: "Guestlist rules" },
  { id: "tickets", label: "Tickets" },
  { id: "tables", label: "Tables & hire" },
  { id: "events", label: "Event overrides" },
  { id: "banking", label: "Banking & tax" },
  { id: "listing", label: "Public listing" },
  { id: "media", label: "Media" },
  { id: "jobs", label: "Jobs" },
  { id: "promoters", label: "Promoters & access" },
];

/** Tabs shown for this club; tickets vs guestlist/table depend on `masterVenueType`. */
export function clubDetailTabsForClub(club: Club): Array<{ id: ClubDetailTab; label: string }> {
  const ops = club.masterVenueType ?? "high_end";
  return CLUB_DETAIL_TABS.filter((t) => {
    if (t.id === "tickets") return ops === "regional_ticket";
    if (t.id === "guestlist" || t.id === "tables") return ops !== "regional_ticket";
    return true;
  });
}

export function parseClubDetailTab(raw: string): ClubDetailTab {
  const t = raw.trim().toLowerCase();
  const mapped = CLUB_DETAIL_TAB_ALIASES[t] ?? t;
  if (CLUB_DETAIL_TABS.some((x) => x.id === mapped)) return mapped as ClubDetailTab;
  return "overview";
}

/** If current tab is hidden for this venue type, pick the first visible tab. */
export function normalizeClubDetailTabForClub(tab: ClubDetailTab, club: Club): ClubDetailTab {
  const visible = clubDetailTabsForClub(club);
  if (visible.some((t) => t.id === tab)) return tab;
  return visible[0]?.id ?? "overview";
}

export function cloneClub(c?: Partial<Club>): Club {
  return {
    slug: c?.slug ?? "",
    name: c?.name ?? "",
    shortDescription: c?.shortDescription ?? "",
    longDescription: c?.longDescription ?? "",
    locationTag: c?.locationTag ?? "",
    region: c?.region ?? c?.locationTag ?? null,
    masterVenueType: c?.masterVenueType ?? null,
    address: c?.address ?? "",
    daysOpen: c?.daysOpen ?? "",
    bestVisitDays: c?.bestVisitDays ?? [],
    featured: c?.featured ?? false,
    featuredDay: c?.featuredDay ?? "",
    venueType: c?.venueType ?? "lounge",
    lat: c?.lat ?? 0,
    lng: c?.lng ?? 0,
    minSpend: c?.minSpend ?? "",
    website: c?.website ?? "",
    entryPricingWomen: c?.entryPricingWomen ?? "",
    entryPricingMen: c?.entryPricingMen ?? "",
    tablesStandard: c?.tablesStandard ?? "",
    tablesLuxury: c?.tablesLuxury ?? "",
    tablesVip: c?.tablesVip ?? "",
    knownFor: c?.knownFor ?? [],
    amenities: c?.amenities ?? [],
    images: c?.images ?? [],
    guestlists: c?.guestlists ?? [],
    paymentDetails: {
      method: c?.paymentDetails?.method ?? "",
      beneficiaryName: c?.paymentDetails?.beneficiaryName ?? "",
      accountNumber: c?.paymentDetails?.accountNumber ?? "",
      sortCode: c?.paymentDetails?.sortCode ?? "",
      iban: c?.paymentDetails?.iban ?? "",
      swiftBic: c?.paymentDetails?.swiftBic ?? "",
      reference: c?.paymentDetails?.reference ?? "",
      payoutEmail: c?.paymentDetails?.payoutEmail ?? "",
    },
    taxDetails: {
      registeredName: c?.taxDetails?.registeredName ?? "",
      taxId: c?.taxDetails?.taxId ?? "",
      vatNumber: c?.taxDetails?.vatNumber ?? "",
      countryCode: c?.taxDetails?.countryCode ?? "",
      isVatRegistered: c?.taxDetails?.isVatRegistered ?? false,
      notes: c?.taxDetails?.notes ?? "",
    },
    discoveryCardTitle: c?.discoveryCardTitle,
    discoveryCardBlurb: c?.discoveryCardBlurb,
    discoveryCardImage: c?.discoveryCardImage,
  };
}

export function parseLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function parseGuestlists(raw: string): Club["guestlists"] {
  return parseLines(raw).map((line) => {
    const [daysRaw = "", recRaw = "weekly", notesRaw = ""] = line.split(",");
    const recurrence: GuestlistRecurrence =
      recRaw.trim().toLowerCase() === "one_off" ? "one_off" : "weekly";
    return {
      days: daysRaw
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean),
      recurrence,
      notes: notesRaw.trim(),
    };
  });
}

export function guestlistsText(rows: Club["guestlists"]): string {
  return rows
    .map((g) => `${g.days.join("|")},${g.recurrence},${g.notes ?? ""}`)
    .join("\n");
}

export function parseVenueType(raw: string): VenueType {
  const t = raw.trim().toLowerCase();
  if (t === "dining") return "dining";
  if (t === "club") return "club";
  return "lounge";
}

/** Public / quick-edit fields only. */
export function applyClubPublicFromFormData(club: Club, fd: FormData): Club {
  return {
    ...club,
    name: String(fd.get("name") || "").trim(),
    shortDescription: String(fd.get("shortDescription") || "").trim(),
    longDescription: String(fd.get("longDescription") || "").trim(),
    locationTag: String(fd.get("locationTag") || "").trim(),
    address: String(fd.get("address") || "").trim(),
    daysOpen: String(fd.get("daysOpen") || "").trim(),
    bestVisitDays: String(fd.get("bestVisitDays") || "")
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean),
    discoveryCardTitle: String(fd.get("discoveryCardTitle") || "").trim() || undefined,
    discoveryCardBlurb: String(fd.get("discoveryCardBlurb") || "").trim() || undefined,
    discoveryCardImage: String(fd.get("discoveryCardImage") || "").trim() || undefined,
  };
}

/** Media tab only — does not clear profile fields missing from that form. */
export function applyClubMediaFromFormData(club: Club, fd: FormData): Club {
  return {
    ...club,
    images: parseLines(String(fd.get("images") || "")),
    guestlists: parseGuestlists(String(fd.get("guestlists") || "")),
  };
}

export function applyClubOverviewFromFormData(
  club: Club,
  fd: FormData,
): { club: Club; isActive: boolean } {
  const region = String(fd.get("region") ?? "").trim() || club.locationTag?.trim() || null;
  const masterVenueType = parseMasterVenueType(String(fd.get("masterVenueType") ?? ""));
  return {
    club: {
      ...club,
      slug: fd.has("slug")
        ? normalizeCatalogSlug(String(fd.get("slug") || "")) || club.slug
        : club.slug,
      name: String(fd.get("name") ?? "").trim() || club.name,
      region,
      masterVenueType: masterVenueType ?? club.masterVenueType ?? null,
    },
    isActive: fd.get("catalogIsActive") != null,
  };
}

export function applyClubFinancialFromFormData(club: Club, fd: FormData): Club {
  return {
    ...club,
    paymentDetails: {
      method: String(fd.get("paymentMethod") || "").trim(),
      beneficiaryName: String(fd.get("beneficiaryName") || "").trim(),
      accountNumber: String(fd.get("accountNumber") || "").trim(),
      sortCode: String(fd.get("sortCode") || "").trim(),
      iban: String(fd.get("iban") || "").trim(),
      swiftBic: String(fd.get("swiftBic") || "").trim(),
      reference: String(fd.get("paymentReference") || "").trim(),
      payoutEmail: String(fd.get("payoutEmail") || "").trim(),
    },
    taxDetails: {
      registeredName: String(fd.get("taxRegisteredName") || "").trim(),
      taxId: String(fd.get("taxId") || "").trim(),
      vatNumber: String(fd.get("vatNumber") || "").trim(),
      countryCode: String(fd.get("taxCountryCode") || "").trim().toUpperCase(),
      isVatRegistered: String(fd.get("isVatRegistered") || "false").trim() === "true",
      notes: String(fd.get("taxNotes") || "").trim(),
    },
  };
}

/** General-tab fields only (profile, location, hours, venue). */
export function applyClubFullFromFormData(club: Club, fd: FormData): Club {
  const slugRaw = String(fd.get("slug") || "").trim();
  const slug = slugRaw ? normalizeCatalogSlug(slugRaw) : normalizeCatalogSlug(club.slug);
  return {
    ...applyClubPublicFromFormData(club, fd),
    slug,
    featured: fd.has("featured")
      ? String(fd.get("featured") || "")
          .toLowerCase()
          .includes("true")
      : club.featured,
    featuredDay: fd.has("featuredDay")
      ? String(fd.get("featuredDay") || "").trim()
      : club.featuredDay,
    venueType: fd.has("venueType")
      ? parseVenueType(String(fd.get("venueType") || ""))
      : club.venueType,
    lat: fd.has("lat") ? Number(fd.get("lat") || 0) || 0 : club.lat,
    lng: fd.has("lng") ? Number(fd.get("lng") || 0) || 0 : club.lng,
    minSpend: fd.has("minSpend") ? String(fd.get("minSpend") || "").trim() : club.minSpend,
    website: fd.has("website") ? String(fd.get("website") || "").trim() : club.website,
    entryPricingWomen: fd.has("entryPricingWomen")
      ? String(fd.get("entryPricingWomen") || "").trim()
      : club.entryPricingWomen,
    entryPricingMen: fd.has("entryPricingMen")
      ? String(fd.get("entryPricingMen") || "").trim()
      : club.entryPricingMen,
    tablesStandard: fd.has("tablesStandard")
      ? String(fd.get("tablesStandard") || "").trim()
      : club.tablesStandard,
    tablesLuxury: fd.has("tablesLuxury")
      ? String(fd.get("tablesLuxury") || "").trim()
      : club.tablesLuxury,
    tablesVip: fd.has("tablesVip") ? String(fd.get("tablesVip") || "").trim() : club.tablesVip,
    knownFor: fd.has("knownFor") ? parseLines(String(fd.get("knownFor") || "")) : club.knownFor,
    amenities: fd.has("amenities") ? parseLines(String(fd.get("amenities") || "")) : club.amenities,
  };
}

export function findClubEntryIndex(entries: ClubEntry[], slug: string): number {
  const s = slug.trim().toLowerCase();
  if (!s) return -1;
  return entries.findIndex((e) => e.club.slug.trim().toLowerCase() === s);
}

/** Canonical slug from URL/state/DOM hints; case-insensitive match against catalog entries. */
export function resolveClubCatalogSlug(
  entries: ClubEntry[],
  ...candidates: string[]
): string | null {
  for (const raw of candidates) {
    const i = findClubEntryIndex(entries, raw);
    if (i >= 0) return entries[i]!.club.slug.trim();
  }
  return null;
}
