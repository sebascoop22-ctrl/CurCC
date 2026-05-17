/**
 * Default JSON shapes for `financial_club_payment_rates.sheet_extension` and
 * `financial_promoters.sheet_extension` (see Club financial tracking data.xlsx).
 * Numeric rates on each `financial_club_payment_rates` row power booking calculations.
 */

export type JsonObject = Record<string, unknown>;

/** V4 guestlist payment model (§1). */
export type GuestlistPaymentModel = "per_guest" | "sex_ratio" | "flat_rate";

/** V4 bonus payout eligibility toggle. */
export type BonusEligibility = "mixed_group" | "girls_only";

/** Mirrors `clubs.venue_type` on the default rate row when set. */
export type ClubMasterVenueType = "high_end" | "regional_ticket";

export function emptyClubFinancialRuleSheetExtension(): JsonObject {
  return {
    _source: "club_standard_payment_rate_info",
    clubId: "",
    minAge: null,
    venueType: null,
    bonusEligibility: null,
    guestlist: {
      paymentTypeNote: "per guest, sex ratio, flat rate",
      paymentModel: null,
      minGuests: null,
      standardRatePerGuest: null,
      maleBonusRate: null,
      femaleBonusRate: null,
      flatRateGuestAgnostic: null,
      maleFemaleRequiredRatio: "",
    },
    guestlistBonuses: {
      requiredNumber: null,
      bonusType: "",
      bonusRatePerGuest: null,
      bonusExtraRatePerMaleGuest: null,
      bonusExtraRatePerFemaleGuest: null,
      bonusFlatRate: null,
    },
    regionalTickets: {
      ticketPrice: null,
      fixedCommissionPerTicket: null,
      volumeBonusThreshold: null,
      volumeBonusAmount: null,
    },
    table: {
      tablePrices: "",
      extrasCommissionRatePerGuest: null,
      venueHire: null,
      ageOverride: "",
      paymentType: "",
      deposit: null,
      minBarSpending: null,
      minMaxGuests: "",
    },
    eventsOverrides: {
      _source: "events_payment_rate_info",
      note: "Per-date overrides; inherit club standard when null",
      byDate: {} as Record<string, JsonObject>,
    },
  };
}

/** V4 payout cadence (`financial_promoters.sheet_extension`). */
export type PaymentSchedule = "after_job" | "weekly" | "monthly";

export function emptyPromoterFinancialSheetExtension(): JsonObject {
  return {
    _source: "promoter_payment_info",
    promoterId: "",
    paymentSchedule: null,
    bonusRate: null,
    bonusThreshold: null,
    bank: {
      name: "",
      alias: "",
      address: "",
      sortCode: "",
      accountNumber: "",
      bic: "",
      iban: "",
    },
    tax: {
      registeredName: "",
      taxId: "",
      vatNumber: "",
      countryCode: "",
      isVatRegistered: null,
      notes: "",
    },
    /** Legacy free-text tax notes; prefer structured `tax` block. */
    taxInfo: "",
  };
}

export function mergeSheetExtensions(base: JsonObject, patch: JsonObject): JsonObject {
  const out: JsonObject = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = mergeSheetExtensions(out[k] as JsonObject, v as JsonObject);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function parseGuestlistPaymentModel(v: unknown): GuestlistPaymentModel | null {
  const x = String(v ?? "").trim().toLowerCase();
  if (x === "per_guest" || x === "sex_ratio" || x === "flat_rate") return x;
  return null;
}

function parseBonusEligibility(v: unknown): BonusEligibility | null {
  const x = String(v ?? "").trim().toLowerCase();
  if (x === "mixed_group" || x === "girls_only") return x;
  return null;
}

function parseClubMasterVenueType(v: unknown): ClubMasterVenueType | null {
  const x = String(v ?? "").trim().toLowerCase();
  if (x === "high_end" || x === "regional_ticket") return x;
  return null;
}

/** Deep-merge `ext` onto the V4 default shape; coerce enum-like fields. */
export function normalizeClubFinancialRuleSheetExtension(ext: unknown): JsonObject {
  const patch =
    ext && typeof ext === "object" && !Array.isArray(ext) ? (ext as JsonObject) : {};
  const merged = mergeSheetExtensions(emptyClubFinancialRuleSheetExtension(), patch);
  const guestlist = merged.guestlist as JsonObject;
  guestlist.paymentModel = parseGuestlistPaymentModel(guestlist.paymentModel);
  merged.bonusEligibility = parseBonusEligibility(merged.bonusEligibility);
  merged.venueType = parseClubMasterVenueType(merged.venueType);
  return merged;
}

function parsePaymentSchedule(v: unknown): PaymentSchedule | null {
  const x = String(v ?? "").trim().toLowerCase();
  if (x === "after_job" || x === "weekly" || x === "monthly") return x;
  return null;
}

function normalizeBankBlock(bank: JsonObject): void {
  bank.name = String(bank.name ?? "").trim();
  bank.alias = String(bank.alias ?? "").trim();
  bank.address = String(bank.address ?? "").trim();
  bank.sortCode = String(bank.sortCode ?? "").trim();
  bank.accountNumber = String(bank.accountNumber ?? "").trim();
  bank.bic = String(bank.bic ?? "").trim();
  bank.iban = String(bank.iban ?? "").trim();
}

/** Deep-merge promoter payment sheet; coerce V4 enums and bank/tax blocks. */
export function normalizePromoterFinancialSheetExtension(ext: unknown): JsonObject {
  const patch =
    ext && typeof ext === "object" && !Array.isArray(ext) ? (ext as JsonObject) : {};
  const merged = mergeSheetExtensions(emptyPromoterFinancialSheetExtension(), patch);
  merged.paymentSchedule = parsePaymentSchedule(merged.paymentSchedule);
  const bank = merged.bank as JsonObject;
  normalizeBankBlock(bank);
  const tax = merged.tax as JsonObject;
  if (tax && typeof tax === "object") {
    tax.registeredName = String(tax.registeredName ?? "").trim();
    tax.taxId = String(tax.taxId ?? "").trim();
    tax.vatNumber = String(tax.vatNumber ?? "").trim();
    tax.countryCode = String(tax.countryCode ?? "").trim().toUpperCase().slice(0, 2);
    const vr = tax.isVatRegistered;
    tax.isVatRegistered =
      vr === true || vr === "true" ? true : vr === false || vr === "false" ? false : null;
    tax.notes = String(tax.notes ?? "").trim();
  }
  merged.taxInfo = String(merged.taxInfo ?? "").trim();
  return merged;
}
