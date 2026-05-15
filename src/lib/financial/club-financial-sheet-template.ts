/**
 * Default JSON shapes for `financial_club_payment_rates.sheet_extension` and
 * `financial_promoters.sheet_extension` (see Club financial tracking data.xlsx).
 * Numeric rates on each `financial_club_payment_rates` row power booking calculations.
 */

export type JsonObject = Record<string, unknown>;

export function emptyClubFinancialRuleSheetExtension(): JsonObject {
  return {
    _source: "club_standard_payment_rate_info",
    clubId: "",
    minAge: null,
    guestlist: {
      paymentTypeNote: "per guest, sex ratio, flat rate",
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

export function emptyPromoterFinancialSheetExtension(): JsonObject {
  return {
    _source: "promoter_payment_info",
    promoterId: "",
    paymentSchedule: "",
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
