import type { FinancialClubPaymentRate } from "../../types";
import type { ClubMasterVenueType } from "../../types";
import {
  emptyClubFinancialRuleSheetExtension,
  mergeSheetExtensions,
  normalizeClubFinancialRuleSheetExtension,
  type GuestlistPaymentModel,
  type JsonObject,
} from "../../lib/financial/club-financial-sheet-template";
import { parseSexRatioRule } from "../../lib/financial/calculations";

export function parseMasterVenueType(raw: string): ClubMasterVenueType | null {
  const x = raw.trim().toLowerCase();
  if (x === "high_end" || x === "regional_ticket") return x;
  return null;
}

export function masterVenueTypeLabel(v: ClubMasterVenueType | null | undefined): string {
  if (v === "regional_ticket") return "Regional ticket";
  if (v === "high_end") return "High-end";
  return "—";
}

export function pickPrimaryNightlifeRate(
  slug: string,
  rates: FinancialClubPaymentRate[],
): FinancialClubPaymentRate | null {
  const s = slug.trim();
  const clubRates = rates.filter((r) => r.clubSlug?.trim() === s && r.department === "nightlife");
  const active = clubRates.filter((r) => r.isActive);
  const pool = active.length ? active : clubRates;
  return pool.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0] ?? null;
}

export function primaryRateSheet(rate: FinancialClubPaymentRate | null): JsonObject {
  if (!rate) return emptyClubFinancialRuleSheetExtension();
  return normalizeClubFinancialRuleSheetExtension(rate.sheetExtension);
}

function num(fd: FormData, name: string): number | null {
  const raw = String(fd.get(name) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

export function validateSexRatioField(rule: string): string | null {
  const t = rule.trim();
  if (!t) return null;
  if (!parseSexRatioRule(t)) {
    return 'Use a ratio like "2:1" or "2:1 F:M" (females per male).';
  }
  return null;
}

export function validateVenueMasterForms(
  club: { masterVenueType?: ClubMasterVenueType | null; region?: string | null },
  fdGuestlist: FormData | null,
  fdTickets: FormData | null,
): string[] {
  const errs: string[] = [];
  const ops = club.masterVenueType;
  if (!club.region?.trim()) {
    errs.push("Region is required for venue master.");
  }
  if (!ops) {
    errs.push("Select an operational venue type (high-end or regional ticket).");
  }
  if (fdGuestlist && ops !== "regional_ticket") {
    const ratioErr = validateSexRatioField(str(fdGuestlist, "maleFemaleRequiredRatio"));
    if (ratioErr) errs.push(ratioErr);
    const model = str(fdGuestlist, "guestlistPaymentModel");
    if (model === "per_guest" && num(fdGuestlist, "standardRatePerGuest") == null) {
      errs.push("Standard rate per guest is required for per-guest payment.");
    }
  }
  if (fdTickets && ops === "regional_ticket") {
    if (num(fdTickets, "fixedCommissionPerTicket") == null) {
      errs.push("Fixed commission per ticket is required for regional venues.");
    }
  }
  return errs;
}

/** Build FormData for events tab including add/remove rows. */
export function buildEventOverrideFormData(
  form: HTMLFormElement,
  existingSheet: JsonObject,
): FormData {
  const fd = new FormData(form);
  const byDate = ((existingSheet.eventsOverrides as JsonObject)?.byDate ?? {}) as Record<
    string,
    JsonObject
  >;
  const dates: string[] = [];
  const remove: string[] = [];
  for (const date of Object.keys(byDate)) {
    const removeEl = form.querySelector<HTMLInputElement>(
      `input[name="eventRemove_${date}"]`,
    );
    if (removeEl?.checked) {
      remove.push(date);
      continue;
    }
    dates.push(date);
  }
  const newDate = String(fd.get("eventOverrideNewDate") ?? "")
    .trim()
    .slice(0, 10);
  if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) dates.push(newDate);
  fd.set("eventOverrideDates", dates.join("\n"));
  fd.set("eventOverrideRemove", remove.join(","));
  return fd;
}

export function buildSheetExtensionFromVenueForms(
  existing: JsonObject,
  forms: {
    guestlist?: FormData | null;
    tickets?: FormData | null;
    tables?: FormData | null;
    events?: FormData | null;
  },
): JsonObject {
  const base = normalizeClubFinancialRuleSheetExtension(existing);
  let patch: JsonObject = {};

  if (forms.guestlist) {
    const fd = forms.guestlist;
    const model = str(fd, "guestlistPaymentModel");
    const guestlist: JsonObject = {
      paymentModel: model || null,
      standardRatePerGuest: num(fd, "standardRatePerGuest"),
      maleFemaleRequiredRatio: str(fd, "maleFemaleRequiredRatio"),
      flatRateGuestAgnostic: num(fd, "flatRateGuestAgnostic"),
      maleBonusRate: num(fd, "maleBonusRate"),
      femaleBonusRate: num(fd, "femaleBonusRate"),
    };
    const bonusType = str(fd, "guestlistBonusType");
    const guestlistBonuses: JsonObject = {
      requiredNumber: num(fd, "guestlistBonusRequired"),
      bonusType: bonusType || "",
      bonusFlatRate: num(fd, "guestlistBonusFlatRate"),
    };
    patch = mergeSheetExtensions(patch, {
      bonusEligibility: str(fd, "bonusEligibility") || null,
      guestlist,
      guestlistBonuses,
    });
  }

  if (forms.tickets) {
    const fd = forms.tickets;
    patch = mergeSheetExtensions(patch, {
      regionalTickets: {
        ticketPrice: num(fd, "ticketPrice"),
        fixedCommissionPerTicket: num(fd, "fixedCommissionPerTicket"),
        volumeBonusThreshold: num(fd, "volumeBonusThreshold"),
        volumeBonusAmount: num(fd, "volumeBonusAmount"),
      },
    });
  }

  if (forms.tables) {
    const fd = forms.tables;
    patch = mergeSheetExtensions(patch, {
      table: {
        tablePrices: str(fd, "tablePrices"),
        deposit: num(fd, "tableDeposit"),
        minBarSpending: num(fd, "minBarSpending"),
        minMaxGuests: str(fd, "minMaxGuests"),
        extrasCommissionRatePerGuest: num(fd, "extrasCommissionRatePerGuest"),
        venueHire: num(fd, "venueHireMinSpend"),
      },
    });
  }

  if (forms.events) {
    const fd = forms.events;
    const byDate: Record<string, JsonObject> = {};
    const dates = parseLines(str(fd, "eventOverrideDates"));
    const newDateKey = str(fd, "eventOverrideNewDate").slice(0, 10);
    const newDateRate = num(fd, "eventOverrideNewRate");
    for (const date of dates) {
      const key = date.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      const rate =
        num(fd, `eventRate_${key}`) ?? (key === newDateKey ? newDateRate : null);
      const patchRow: JsonObject = {};
      if (rate != null) {
        patchRow.baseRate = rate;
        patchRow.guestlist = { standardRatePerGuest: rate };
      }
      const note = str(fd, `eventNote_${key}`);
      if (note) patchRow.note = note;
      if (Object.keys(patchRow).length) byDate[key] = patchRow;
    }
    const events = (base.eventsOverrides ?? {}) as JsonObject;
    patch = mergeSheetExtensions(patch, {
      eventsOverrides: {
        ...events,
        byDate: { ...(events.byDate as Record<string, JsonObject>), ...byDate },
      },
    });
    const removeRaw = str(fd, "eventOverrideRemove");
    if (removeRaw) {
      const removeDates = removeRaw.split(",").map((d) => d.trim().slice(0, 10)).filter(Boolean);
      const merged = { ...((patch.eventsOverrides as JsonObject)?.byDate as Record<string, JsonObject>) };
      for (const d of removeDates) delete merged[d];
      patch = mergeSheetExtensions(patch, { eventsOverrides: { byDate: merged } });
    }
  }

  return normalizeClubFinancialRuleSheetExtension(mergeSheetExtensions(base, patch));
}

function parseLines(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function eventOverrideDatesFromSheet(sheet: JsonObject): string[] {
  const byDate = ((sheet.eventsOverrides as JsonObject)?.byDate ?? {}) as Record<string, JsonObject>;
  return Object.keys(byDate).sort();
}

export function guestlistPaymentModelFromSheet(sheet: JsonObject): GuestlistPaymentModel | null {
  const gl = (sheet.guestlist ?? {}) as JsonObject;
  const m = String(gl.paymentModel ?? "").trim().toLowerCase();
  if (m === "per_guest" || m === "sex_ratio" || m === "flat_rate") return m;
  return null;
}
