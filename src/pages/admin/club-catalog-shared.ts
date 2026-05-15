import type { Club, GuestlistRecurrence, VenueType } from "../../types";

export type ClubEntry = { dbId: string | null; club: Club };

export type ClubDetailTab =
  | "general"
  | "financial"
  | "rates"
  | "media"
  | "payments"
  | "jobs"
  | "promoters"
  | "accounts";

export const CLUB_DETAIL_TABS: Array<{ id: ClubDetailTab; label: string }> = [
  { id: "general", label: "General" },
  { id: "financial", label: "Financial" },
  { id: "rates", label: "Rates" },
  { id: "media", label: "Media" },
  { id: "payments", label: "Payments" },
  { id: "jobs", label: "Jobs" },
  { id: "promoters", label: "Promoters" },
  { id: "accounts", label: "Accounts" },
];

export function parseClubDetailTab(raw: string): ClubDetailTab {
  const t = raw.trim().toLowerCase();
  if (CLUB_DETAIL_TABS.some((x) => x.id === t)) return t as ClubDetailTab;
  return "general";
}

export function cloneClub(c?: Partial<Club>): Club {
  return {
    slug: c?.slug ?? "",
    name: c?.name ?? "",
    shortDescription: c?.shortDescription ?? "",
    longDescription: c?.longDescription ?? "",
    locationTag: c?.locationTag ?? "",
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

export function applyClubFullFromFormData(club: Club, fd: FormData): Club {
  return {
    ...applyClubPublicFromFormData(club, fd),
    slug: String(fd.get("slug") || "").trim(),
    featured: String(fd.get("featured") || "")
      .toLowerCase()
      .includes("true"),
    featuredDay: String(fd.get("featuredDay") || "").trim(),
    venueType: parseVenueType(String(fd.get("venueType") || "")),
    lat: Number(fd.get("lat") || 0) || 0,
    lng: Number(fd.get("lng") || 0) || 0,
    minSpend: String(fd.get("minSpend") || "").trim(),
    website: String(fd.get("website") || "").trim(),
    entryPricingWomen: String(fd.get("entryPricingWomen") || "").trim(),
    entryPricingMen: String(fd.get("entryPricingMen") || "").trim(),
    tablesStandard: String(fd.get("tablesStandard") || "").trim(),
    tablesLuxury: String(fd.get("tablesLuxury") || "").trim(),
    tablesVip: String(fd.get("tablesVip") || "").trim(),
    knownFor: parseLines(String(fd.get("knownFor") || "")),
    amenities: parseLines(String(fd.get("amenities") || "")),
    images: parseLines(String(fd.get("images") || "")),
    guestlists: parseGuestlists(String(fd.get("guestlists") || "")),
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

export function findClubEntryIndex(entries: ClubEntry[], slug: string): number {
  const s = slug.trim();
  if (!s) return -1;
  return entries.findIndex((e) => e.club.slug === s);
}
