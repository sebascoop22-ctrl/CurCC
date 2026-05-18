import type { SupabaseClient } from "@supabase/supabase-js";
import { escAttr, escHtml } from "../../portal/html";
import { renderStatusBadge } from "../../portal/badge";
import {
  issueClubInvite,
  loadClubAccounts,
  loadClubJobs,
  loadClubPromoters,
  setClubPromoterAccess,
  type ClubAccountRow,
  type ClubPromoterAccessRow,
} from "../../admin/clubs";
import {
  listFinancialBookings,
  upsertFinancialClubPaymentRate,
} from "../../admin/financial-tracking";
import type {
  Club,
  FinancialClubPaymentRate,
  FinancialBooking,
  FinancialTransactionRow,
  PromoterJob,
  PromoterProfile,
} from "../../types";
import type { ClubDetailTab } from "./club-catalog-shared";
import { guestlistsText } from "./club-catalog-shared";
import {
  buildEventOverrideFormData,
  buildSheetExtensionFromVenueForms,
  eventOverrideDatesFromSheet,
  guestlistPaymentModelFromSheet,
  pickPrimaryNightlifeRate,
  primaryRateSheet,
  validateVenueMasterForms,
} from "./club-catalog-venue";
import { applyCollapsibleFormSections } from "../../lib/collapsible-form-sections";
import {
  mergeSheetExtensions,
  normalizeClubFinancialRuleSheetExtension,
  type JsonObject,
} from "../../lib/financial/club-financial-sheet-template";

import {
  adminFieldCheckbox,
  adminFieldEmail,
  adminFieldNumber,
  adminFieldSelect,
  adminFieldText,
  adminFieldTextarea,
  adminFieldUrl,
  adminSettingsSection,
} from "./admin-form-fields";
import { attachClubAddressAutocomplete } from "../../admin/places-autocomplete";

export function renderClubTabOverviewHtml(
  club: Club,
  jobsThisMonth: number,
  isActive: boolean,
): string {
  const ops = club.masterVenueType ?? "";
  return `<form id="club-tab-overview-form" class="admin-settings-form admin-club-tab-panel admin-form" data-collapsible="true" data-collapsible-open="2" data-club-tab-panel="overview">
    <h4 class="full">Venue master</h4>
    ${adminFieldText({ name: "slug", label: "URL slug", value: club.slug, required: true, col: "pp-col-4", hint: "Operational club id" })}
    ${adminFieldText({ name: "name", label: "Venue name", value: club.name, required: true, col: "pp-col-8", autocomplete: "organization" })}
    ${adminFieldText({ name: "region", label: "Region", value: club.region ?? club.locationTag ?? "", col: "pp-col-4", required: true, placeholder: "Mayfair" })}
    ${adminFieldSelect({
      name: "masterVenueType",
      label: "Operational venue type",
      col: "pp-col-4",
      required: true,
      options: [
        { value: "", label: "(select)", selected: !ops },
        { value: "high_end", label: "High-end (guestlist + tables)", selected: ops === "high_end" },
        {
          value: "regional_ticket",
          label: "Regional ticket",
          selected: ops === "regional_ticket",
        },
      ],
    })}
    ${adminFieldCheckbox({ name: "catalogIsActive", label: "Active in catalog", checked: isActive, col: "pp-col-4" })}
    <h4 class="full">Quick stats</h4>
    <p class="admin-note full">Jobs this calendar month (all statuses): <strong>${jobsThisMonth}</strong></p>
  </form>`;
}

export function renderClubTabGuestlistHtml(
  club: Club,
  rate: FinancialClubPaymentRate | null,
  sheet: JsonObject,
): string {
  const gl = (sheet.guestlist ?? {}) as JsonObject;
  const gb = (sheet.guestlistBonuses ?? {}) as JsonObject;
  const model = guestlistPaymentModelFromSheet(sheet) ?? "per_guest";
  const bonusElig = String(sheet.bonusEligibility ?? "");
  return `<form id="club-tab-guestlist-form" class="admin-settings-form admin-club-tab-panel admin-form" data-collapsible="true" data-collapsible-open="2" data-club-tab-panel="guestlist">
    <input type="hidden" name="venueRateId" value="${escAttr(rate?.id ?? "")}" />
    <p class="admin-note full">Payment rules for <code>${escHtml(club.slug)}</code>${rate ? ` — rate row ${escHtml(rate.venueOrServiceName)}` : " — a nightlife rate row will be created on save."}</p>
    <h4 class="full">Payment model</h4>
    ${adminFieldSelect({
      name: "guestlistPaymentModel",
      label: "Payment model",
      col: "pp-col-4",
      options: [
        { value: "per_guest", label: "Per guest", selected: model === "per_guest" },
        { value: "sex_ratio", label: "Sex ratio", selected: model === "sex_ratio" },
        { value: "flat_rate", label: "Flat per night", selected: model === "flat_rate" },
      ],
    })}
    ${adminFieldNumber({ name: "standardRatePerGuest", label: "Standard rate / guest (£)", value: Number(gl.standardRatePerGuest ?? rate?.baseRate ?? 0), col: "pp-col-4", step: "0.01", min: 0 })}
    ${adminFieldNumber({ name: "maleBonusRate", label: "Male rate (£)", value: Number(gl.maleBonusRate ?? rate?.maleRate ?? 0), col: "pp-col-4", step: "0.01", min: 0 })}
    ${adminFieldNumber({ name: "femaleBonusRate", label: "Female rate (£)", value: Number(gl.femaleBonusRate ?? rate?.femaleRate ?? 0), col: "pp-col-4", step: "0.01", min: 0 })}
    ${adminFieldNumber({ name: "flatRateGuestAgnostic", label: "Flat rate / night (£)", value: Number(gl.flatRateGuestAgnostic ?? 0), col: "pp-col-4", step: "0.01", min: 0 })}
    ${adminFieldText({ name: "maleFemaleRequiredRatio", label: "Required F:M ratio", value: String(gl.maleFemaleRequiredRatio ?? ""), col: "pp-col-4", placeholder: "2:1 F:M", hint: "Blocks bonus when not met" })}
    <h4 class="full">Bonuses</h4>
    ${adminFieldSelect({
      name: "bonusEligibility",
      label: "Bonus eligibility",
      col: "pp-col-4",
      options: [
        { value: "", label: "(default)", selected: !bonusElig },
        { value: "mixed_group", label: "Mixed group", selected: bonusElig === "mixed_group" },
        { value: "girls_only", label: "Girls only", selected: bonusElig === "girls_only" },
      ],
    })}
    ${adminFieldSelect({
      name: "guestlistBonusType",
      label: "Bonus type",
      col: "pp-col-4",
      options: [
        { value: "", label: "(none)", selected: !gb.bonusType },
        { value: "flat", label: "Flat at threshold", selected: String(gb.bonusType) === "flat" },
        { value: "stacking", label: "Stacking (female blocks)", selected: String(gb.bonusType) === "stacking" },
      ],
    })}
    ${adminFieldNumber({ name: "guestlistBonusRequired", label: "Guest threshold", value: Number(gb.requiredNumber ?? rate?.bonusGoal ?? 0), col: "pp-col-4", step: "1", min: 0 })}
    ${adminFieldNumber({ name: "guestlistBonusFlatRate", label: "Bonus amount (£)", value: Number(gb.bonusFlatRate ?? rate?.bonusAmount ?? 0), col: "pp-col-4", step: "0.01", min: 0 })}
  </form>`;
}

export function renderClubTabTicketsHtml(
  _club: Club,
  rate: FinancialClubPaymentRate | null,
  sheet: JsonObject,
): string {
  const rt = (sheet.regionalTickets ?? {}) as JsonObject;
  return `<form id="club-tab-tickets-form" class="admin-settings-form admin-club-tab-panel admin-form" data-collapsible="true" data-collapsible-open="2" data-club-tab-panel="tickets">
    <input type="hidden" name="venueRateId" value="${escAttr(rate?.id ?? "")}" />
    <p class="admin-note full">Regional ticket economics for <code>${escHtml(_club.slug)}</code>.</p>
    ${adminFieldNumber({ name: "ticketPrice", label: "Ticket price (£)", value: Number(rt.ticketPrice ?? 0), col: "pp-col-4", step: "0.01", min: 0 })}
    ${adminFieldNumber({ name: "fixedCommissionPerTicket", label: "Commission / ticket (£)", value: Number(rt.fixedCommissionPerTicket ?? 0), col: "pp-col-4", step: "0.01", min: 0 })}
    ${adminFieldNumber({ name: "volumeBonusThreshold", label: "Volume bonus threshold (tickets)", value: Number(rt.volumeBonusThreshold ?? 0), col: "pp-col-4", step: "1", min: 0 })}
    ${adminFieldNumber({ name: "volumeBonusAmount", label: "Volume bonus (£)", value: Number(rt.volumeBonusAmount ?? 0), col: "pp-col-4", step: "0.01", min: 0 })}
  </form>`;
}

export function renderClubTabTablesHtml(
  club: Club,
  rate: FinancialClubPaymentRate | null,
  sheet: JsonObject,
): string {
  const tbl = (sheet.table ?? {}) as JsonObject;
  return `<form id="club-tab-tables-form" class="admin-settings-form admin-club-tab-panel admin-form" data-collapsible="true" data-collapsible-open="2" data-club-tab-panel="tables">
    <input type="hidden" name="venueRateId" value="${escAttr(rate?.id ?? "")}" />
    <p class="admin-note full">Table &amp; venue hire for <code>${escHtml(club.slug)}</code>. Concierge commission defaults to 10% of net spend (ex-VAT).</p>
    ${adminFieldTextarea({ name: "tablePrices", label: "Table price notes", value: String(tbl.tablePrices ?? ""), col: "full", rows: 2 })}
    ${adminFieldNumber({ name: "tableDeposit", label: "Deposit (£)", value: Number(tbl.deposit ?? 0), col: "pp-col-4", step: "0.01", min: 0 })}
    ${adminFieldNumber({ name: "minBarSpending", label: "Min bar spend (£)", value: Number(tbl.minBarSpending ?? 0), col: "pp-col-4", step: "0.01", min: 0 })}
    ${adminFieldText({ name: "minMaxGuests", label: "Min / max guests", value: String(tbl.minMaxGuests ?? ""), col: "pp-col-4", placeholder: "6-12" })}
    ${adminFieldNumber({ name: "extrasCommissionRatePerGuest", label: "Extras commission / guest (£)", value: Number(tbl.extrasCommissionRatePerGuest ?? 0), col: "pp-col-4", step: "0.01", min: 0 })}
    ${adminFieldNumber({ name: "venueHireMinSpend", label: "Venue hire min spend (£)", value: Number(tbl.venueHire ?? 0), col: "pp-col-4", step: "0.01", min: 0 })}
  </form>`;
}

export function renderClubTabEventsHtml(
  _club: Club,
  rate: FinancialClubPaymentRate | null,
  sheet: JsonObject,
): string {
  const dates = eventOverrideDatesFromSheet(sheet);
  const byDate = ((sheet.eventsOverrides as JsonObject)?.byDate ?? {}) as Record<string, JsonObject>;
  const rows =
    dates.length === 0
      ? `<tr><td colspan="4" class="admin-note">No date overrides yet.</td></tr>`
      : dates
          .map((date: string) => {
            const row = byDate[date] ?? {};
            const gl = (row.guestlist ?? {}) as JsonObject;
            const rateVal = gl.standardRatePerGuest ?? row.baseRate ?? "";
            return `<tr>
              <td><input type="date" name="eventDate_existing_${escAttr(date)}" value="${escAttr(date)}" readonly /></td>
              <td><input type="number" step="0.01" name="eventRate_${escAttr(date)}" value="${escAttr(String(rateVal))}" placeholder="£/guest" /></td>
              <td><input type="text" name="eventNote_${escAttr(date)}" value="${escAttr(String(row.note ?? ""))}" placeholder="Note" /></td>
              <td><label><input type="checkbox" name="eventRemove_${escAttr(date)}" value="1" /> Remove</label></td>
            </tr>`;
          })
          .join("");
  return `<form id="club-tab-events-form" class="admin-settings-form admin-club-tab-panel admin-form" data-collapsible="true" data-collapsible-open="1" data-club-tab-panel="events">
    <input type="hidden" name="venueRateId" value="${escAttr(rate?.id ?? "")}" />
    <p class="admin-note full">Per-date overrides inherit club standard rates unless set below (used by job resolver).</p>
    <h4 class="full">Existing overrides</h4>
    <div class="admin-table-wrap full"><table class="admin-table"><thead><tr><th>Date</th><th>Guest rate (£)</th><th>Note</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <h4 class="full">Add override</h4>
    ${adminFieldText({ name: "eventOverrideNewDate", label: "Date", value: "", col: "pp-col-4", hint: "YYYY-MM-DD" })}
    ${adminFieldNumber({ name: "eventOverrideNewRate", label: "Guest rate (£)", value: 0, col: "pp-col-4", step: "0.01", min: 0 })}
    ${adminFieldText({ name: "eventOverrideNewNote", label: "Note", value: "", col: "pp-col-4" })}
    <input type="hidden" name="eventOverrideDates" value="${escAttr(dates.join("\n"))}" />
    <input type="hidden" name="eventOverrideRemove" value="" id="club-event-override-remove" />
    <p class="admin-note full">Rate row: ${rate ? escHtml(rate.venueOrServiceName) : "will be created on save"}</p>
  </form>`;
}

export function renderClubTabListingHtml(club: Club): string {
  const profile = adminSettingsSection(
    "Profile",
    "Public listing",
    `${adminFieldText({ name: "slug", label: "URL slug", value: club.slug, required: true, col: "pp-col-4", hint: "e.g. Gallery-Club" })}
     ${adminFieldText({ name: "name", label: "Venue name", value: club.name, required: true, col: "pp-col-8", autocomplete: "organization" })}
     ${adminFieldTextarea({ name: "shortDescription", label: "Short description", value: club.shortDescription, col: "full", rows: 2, maxlength: 280 })}
     ${adminFieldTextarea({ name: "longDescription", label: "Long description", value: club.longDescription, col: "full", rows: 5 })}`,
  );
  const location = adminSettingsSection(
    "Location",
    "Maps & address",
    `${adminFieldText({ name: "locationTag", label: "Area / neighbourhood", value: club.locationTag, col: "pp-col-4", placeholder: "Mayfair" })}
     ${adminFieldText({ name: "address", label: "Street address", value: club.address, col: "full", autocomplete: "street-address", id: "club-detail-address" })}
     ${adminFieldNumber({ name: "lat", label: "Latitude", value: club.lat, col: "pp-col-3", step: "any", min: -90, max: 90 })}
     ${adminFieldNumber({ name: "lng", label: "Longitude", value: club.lng, col: "pp-col-3", step: "any", min: -180, max: 180 })}
     ${adminFieldUrl({ name: "website", label: "Website", value: club.website, col: "pp-col-6" })}`,
  );
  const hours = adminSettingsSection(
    "Hours & card",
    "Listing & homepage",
    `${adminFieldText({ name: "daysOpen", label: "Days open", value: club.daysOpen, col: "pp-col-6", placeholder: "Thu–Sat" })}
     ${adminFieldText({ name: "bestVisitDays", label: "Best visit days", value: club.bestVisitDays.join("|"), col: "pp-col-6", hint: "Use | between days" })}
     ${adminFieldText({ name: "discoveryCardTitle", label: "Card title override", value: club.discoveryCardTitle ?? "", col: "pp-col-6", placeholder: "Optional" })}
     ${adminFieldTextarea({ name: "discoveryCardBlurb", label: "Card blurb override", value: club.discoveryCardBlurb ?? "", col: "full", rows: 2 })}
     ${adminFieldUrl({ name: "discoveryCardImage", label: "Card image URL", value: club.discoveryCardImage ?? "", col: "full" })}`,
  );
  const venue = adminSettingsSection(
    "Venue details",
    "Pricing & type",
    `${adminFieldSelect({
      name: "venueType",
      label: "Venue type",
      col: "pp-col-4",
      options: [
        { value: "lounge", label: "Lounge", selected: club.venueType === "lounge" },
        { value: "club", label: "Club", selected: club.venueType === "club" },
        { value: "dining", label: "Dining", selected: club.venueType === "dining" },
      ],
    })}
     ${adminFieldText({ name: "minSpend", label: "Minimum spend", value: club.minSpend, col: "pp-col-4" })}
     ${adminFieldText({ name: "entryPricingWomen", label: "Entry (women)", value: club.entryPricingWomen, col: "pp-col-4" })}
     ${adminFieldText({ name: "entryPricingMen", label: "Entry (men)", value: club.entryPricingMen, col: "pp-col-4" })}
     ${adminFieldCheckbox({ name: "featured", label: "Featured on homepage", checked: club.featured, col: "pp-col-6" })}
     ${adminFieldText({ name: "featuredDay", label: "Featured day label", value: club.featuredDay, col: "pp-col-6" })}`,
  );
  return `<form id="club-detail-listing-form" class="admin-settings-form admin-club-tab-panel" data-club-tab-panel="listing">
    ${profile}${location}${hours}${venue}
  </form>`;
}

export function wireClubDetailFieldEnhancements(host: HTMLElement): void {
  applyCollapsibleFormSections(host);
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const address = host.querySelector<HTMLInputElement>("#club-detail-address");
  const lat = host.querySelector<HTMLInputElement>('input[name="lat"]');
  const lng = host.querySelector<HTMLInputElement>('input[name="lng"]');
  if (address && lat && lng && mapsKey && !address.dataset.placesBound) {
    address.dataset.placesBound = "1";
    void attachClubAddressAutocomplete({
      addressInput: address,
      latInput: lat,
      lngInput: lng,
      apiKey: mapsKey,
    }).catch(() => undefined);
  }
}

export function renderClubTabFinancialHtml(club: Club): string {
  const bank = adminSettingsSection(
    "Bank & payout",
    "Settlements",
    `${adminFieldText({ name: "paymentMethod", label: "Payment method", value: club.paymentDetails?.method ?? "", col: "pp-col-4", placeholder: "BACS" })}
     ${adminFieldText({ name: "beneficiaryName", label: "Beneficiary name", value: club.paymentDetails?.beneficiaryName ?? "", col: "pp-col-8", autocomplete: "name" })}
     ${adminFieldText({ name: "accountNumber", label: "Account number", value: club.paymentDetails?.accountNumber ?? "", col: "pp-col-4", inputmode: "numeric" })}
     ${adminFieldText({ name: "sortCode", label: "Sort code", value: club.paymentDetails?.sortCode ?? "", col: "pp-col-4", pattern: "[0-9]{2}-?[0-9]{2}-?[0-9]{2}", placeholder: "00-00-00" })}
     ${adminFieldEmail({ name: "payoutEmail", label: "Payout email", value: club.paymentDetails?.payoutEmail ?? "", col: "pp-col-4" })}
     ${adminFieldText({ name: "iban", label: "IBAN", value: club.paymentDetails?.iban ?? "", col: "pp-col-6" })}
     ${adminFieldText({ name: "swiftBic", label: "SWIFT / BIC", value: club.paymentDetails?.swiftBic ?? "", col: "pp-col-6" })}
     ${adminFieldText({ name: "paymentReference", label: "Payment reference", value: club.paymentDetails?.reference ?? "", col: "full" })}`,
  );
  const tax = adminSettingsSection(
    "Tax",
    "Invoicing",
    `${adminFieldText({ name: "taxRegisteredName", label: "Registered name", value: club.taxDetails?.registeredName ?? "", col: "pp-col-6", autocomplete: "organization" })}
     ${adminFieldText({ name: "taxId", label: "Tax ID", value: club.taxDetails?.taxId ?? "", col: "pp-col-3" })}
     ${adminFieldText({ name: "vatNumber", label: "VAT number", value: club.taxDetails?.vatNumber ?? "", col: "pp-col-3" })}
     ${adminFieldText({ name: "taxCountryCode", label: "Country code", value: club.taxDetails?.countryCode ?? "", col: "pp-col-3", maxlength: 2, hint: "e.g. GB" })}
     ${adminFieldSelect({
      name: "isVatRegistered",
      label: "VAT registered",
      col: "pp-col-3",
      options: [
        { value: "true", label: "Yes", selected: club.taxDetails?.isVatRegistered === true },
        { value: "false", label: "No", selected: !club.taxDetails?.isVatRegistered },
      ],
    })}
     ${adminFieldTextarea({ name: "taxNotes", label: "Tax notes", value: club.taxDetails?.notes ?? "", col: "full", rows: 2 })}`,
  );
  return `<form id="club-tab-banking-form" class="admin-settings-form admin-club-tab-panel" data-club-tab-panel="banking">${bank}${tax}</form>`;
}

export function renderClubTabRatesHtml(
  slug: string,
  rates: FinancialClubPaymentRate[],
  editingRate: FinancialClubPaymentRate | null,
): string {
  const clubRates = rates.filter((r) => r.clubSlug === slug);
  const rows =
    clubRates.length === 0
      ? `<tr><td colspan="8" class="admin-note">No rate rows for this club yet.</td></tr>`
      : clubRates
          .map(
            (r) =>
              `<tr><td>${escHtml(r.department)}</td><td>${escHtml(r.venueOrServiceName)}</td><td>${r.maleRate}</td><td>${r.femaleRate}</td><td>${r.baseRate}</td><td>${escHtml(r.bonusType)}</td><td>${r.isActive ? "yes" : "no"}</td><td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-club-rate-edit="${escAttr(r.id)}">Edit</button></td></tr>`,
          )
          .join("");
  const ed = editingRate;
  const form = `
    <form id="club-tab-rates-form" class="admin-form" style="margin-top:0.75rem">
      <input type="hidden" name="rateId" value="${escAttr(ed?.id ?? "")}" />
      <div class="cc-field pp-col-4"><label>Department</label>
        <select name="department">
          <option value="nightlife"${ed?.department === "nightlife" ? " selected" : ""}>Nightlife</option>
          <option value="transport"${ed?.department === "transport" ? " selected" : ""}>Transport</option>
          <option value="protection"${ed?.department === "protection" ? " selected" : ""}>Protection</option>
          <option value="other"${ed?.department === "other" ? " selected" : ""}>Other</option>
        </select>
      </div>
      <div class="cc-field pp-col-8"><label>Venue / service</label><input name="venueOrServiceName" required value="${escAttr(ed?.venueOrServiceName ?? "")}" /></div>
      <div class="cc-field pp-col-2"><label>Male ratio</label><input name="maleRate" type="number" step="0.01" value="${ed?.maleRate ?? 0}" /></div>
      <div class="cc-field pp-col-2"><label>Female ratio</label><input name="femaleRate" type="number" step="0.01" value="${ed?.femaleRate ?? 0}" /></div>
      <div class="cc-field pp-col-2"><label>Base rate</label><input name="baseRate" type="number" step="0.01" value="${ed?.baseRate ?? 0}" /></div>
      <div class="cc-field pp-col-4"><label>Bonus type</label>
        <select name="bonusType">
          <option value="none"${(ed?.bonusType ?? "none") === "none" ? " selected" : ""}>None</option>
          <option value="flat"${ed?.bonusType === "flat" ? " selected" : ""}>Flat</option>
          <option value="stacking"${ed?.bonusType === "stacking" ? " selected" : ""}>Stacking</option>
        </select>
      </div>
      <div class="cc-field pp-col-4"><label>Bonus goal</label><input name="bonusGoal" type="number" step="1" value="${ed?.bonusGoal ?? 0}" /></div>
      <div class="cc-field pp-col-4"><label>Bonus amount</label><input name="bonusAmount" type="number" step="0.01" value="${ed?.bonusAmount ?? 0}" /></div>
      <div class="cc-field pp-col-4"><label>Effective from</label><input name="effectiveFrom" type="date" value="${escAttr((ed?.effectiveFrom ?? new Date().toISOString()).slice(0, 10))}" /></div>
      <div class="cc-field pp-col-4"><label><input type="checkbox" name="isActive" value="true"${ed ? ed.isActive !== false : true ? " checked" : ""} /> Active</label></div>
      <div class="admin-actions full">
        <button type="submit" class="cc-btn cc-btn--gold">${ed ? "Update rate" : "Add rate row"}</button>
        ${ed ? `<button type="button" class="cc-btn cc-btn--ghost" data-club-rate-cancel>Cancel edit</button>` : ""}
      </div>
    </form>`;
  return `
    <div class="admin-club-tab-panel" data-club-tab-panel="rates">
      <p class="admin-note">Guestlist, table, and event payout rates linked to this club slug.</p>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Dept</th><th>Venue</th><th>Male</th><th>Female</th><th>Base</th><th>Bonus</th><th>Active</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${form}
    </div>`;
}

export function renderClubTabMediaHtml(club: Club, heroIndex: number): string {
  const imgs = club.images ?? [];
  const thumbs = imgs
    .map(
      (url, i) =>
        `<label class="admin-media-thumb${i === heroIndex ? " is-hero" : ""}"><input type="radio" name="heroImageIndex" value="${i}"${i === heroIndex ? " checked" : ""} /><img src="${escAttr(url)}" alt="" /></label>`,
    )
    .join("");
  return `
    <form id="club-tab-media-form" class="admin-form admin-club-tab-panel" data-club-tab-panel="media">
      <div class="cc-field full"><label>Images (one URL per line)</label><textarea name="images" id="club-tab-images-text" rows="6">${escHtml(imgs.join("\n"))}</textarea></div>
      <div class="cc-field full admin-upload-row">
        <label for="club-tab-image-file">Upload image</label>
        <input id="club-tab-image-file" type="file" accept="image/*" />
        <button type="button" class="cc-btn cc-btn--ghost" id="club-tab-image-upload">Upload &amp; append URL</button>
      </div>
      <div class="cc-field full"><label>Main image (hero)</label><div class="admin-media-thumbs">${thumbs || '<p class="admin-note">No images yet.</p>'}</div></div>
      <div class="cc-field full"><label>Guestlists (days,recurrence,notes per line)</label><textarea name="guestlists" rows="4">${escHtml(guestlistsText(club.guestlists))}</textarea></div>
    </form>`;
}

export function renderClubTabPaymentsHtml(
  bookings: FinancialBooking[],
  transactions: FinancialTransactionRow[],
): string {
  const bookingRows =
    bookings.length === 0
      ? `<tr><td colspan="6" class="admin-note">No bookings for this club in the current period.</td></tr>`
      : bookings
          .slice(0, 40)
          .map(
            (b) =>
              `<tr><td>${escHtml(b.bookingReference)}</td><td>${escHtml(b.bookingDate.slice(0, 10))}</td><td>${escHtml(b.promoterName || "—")}</td><td>${escHtml(b.venueOrServiceName)}</td><td>${b.totalGuests}</td><td>${escHtml(b.paymentStatus)}</td></tr>`,
          )
          .join("");
  const txRows =
    transactions.length === 0
      ? `<tr><td colspan="5" class="admin-note">No ledger transactions tagged to this club.</td></tr>`
      : transactions
          .slice(0, 40)
          .map(
            (t) =>
              `<tr><td>${escHtml(t.txDate)}</td><td>${escHtml(t.category)}</td><td>${escHtml(t.direction)}</td><td>${escHtml(`${t.currency} ${t.amount.toFixed(2)}`)}</td><td>${escHtml(t.status)}</td></tr>`,
          )
          .join("");
  return `
    <div class="admin-club-tab-panel" data-club-tab-panel="payments">
      <h4>Financial bookings</h4>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Ref</th><th>Date</th><th>Promoter</th><th>Venue</th><th>Guests</th><th>Status</th></tr></thead><tbody>${bookingRows}</tbody></table></div>
      <h4 style="margin-top:1rem">Ledger transactions</h4>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Date</th><th>Category</th><th>Dir</th><th>Amount</th><th>Status</th></tr></thead><tbody>${txRows}</tbody></table></div>
      <p class="admin-note">Read-only snapshot. Use Financials in the sidebar for full editing.</p>
    </div>`;
}

export function renderClubTabJobsHtml(jobs: PromoterJob[], promoters: PromoterProfile[]): string {
  const promoterOpts = promoters
    .map((p) => `<option value="${escAttr(p.id)}">${escHtml(p.displayName || p.id)}</option>`)
    .join("");
  const rows =
    jobs.length === 0
      ? `<tr><td colspan="6" class="admin-note">No jobs for this club.</td></tr>`
      : jobs
          .map(
            (j) =>
              `<tr><td>${escHtml(j.jobDate)}</td><td>${escHtml(j.jobType || j.service)}</td><td>${escHtml(j.status)}</td><td>${j.guestsCount}</td><td>${escHtml(j.clientName || "—")}</td><td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-club-job-open-financial="${escAttr(j.id)}">Ledger</button></td></tr>`,
          )
          .join("");
  return `
    <div class="admin-club-tab-panel" data-club-tab-panel="jobs">
      <form id="club-tab-job-create" class="admin-form" style="margin-bottom:1rem">
        <div class="cc-field pp-col-4"><label>Promoter</label><select name="promoterId" required><option value="">(select)</option>${promoterOpts}</select></div>
        <div class="cc-field pp-col-4"><label>Date</label><input name="jobDate" type="date" required /></div>
        <div class="cc-field pp-col-4"><label>Service</label><select name="service"><option value="guestlist">guestlist</option><option value="private_table">private_table</option><option value="venue_access">venue_access</option></select></div>
        <div class="admin-actions"><button type="submit" class="cc-btn cc-btn--gold">Add job</button></div>
      </form>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Date</th><th>Type</th><th>Status</th><th>Guests</th><th>Client</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
}

export function renderClubTabPromotersHtml(rows: ClubPromoterAccessRow[]): string {
  const body =
    rows.length === 0
      ? `<tr><td colspan="4" class="admin-note">No promoter preference records for this club.</td></tr>`
      : rows
          .map(
            (r) =>
              `<tr data-pref-id="${escAttr(r.preferenceId)}"><td>${escHtml(r.displayName)}</td><td>${renderStatusBadge(r.status)}</td><td>${escHtml(r.weekdays.join(", ") || "—")}</td><td style="white-space:nowrap">
                <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-club-promoter-allow="true">Allow</button>
                <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-club-promoter-allow="false">Revoke</button>
              </td></tr>`,
          )
          .join("");
  return `
    <div class="admin-club-tab-panel" data-club-tab-panel="promoters">
      <div class="cc-field full"><label>Access note</label><textarea id="club-tab-promoter-note" rows="2" placeholder="Optional note when changing access"></textarea></div>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Promoter</th><th>Status</th><th>Weekdays</th><th>Actions</th></tr></thead><tbody>${body}</tbody></table></div>
    </div>`;
}

export function renderClubTabAccountsHtml(accounts: ClubAccountRow[]): string {
  const rows =
    accounts.length === 0
      ? `<tr><td colspan="5" class="admin-note">No club accounts for this venue.</td></tr>`
      : accounts
          .map(
            (a) =>
              `<tr><td>${escHtml(a.invite_email || "—")}</td><td>${escHtml(a.role)}</td><td>${renderStatusBadge(a.status)}</td><td><code>${escHtml(a.invite_code || "—")}</code></td><td>${escHtml(a.notes || "")}</td></tr>`,
          )
          .join("");
  return `
    <div class="admin-club-tab-panel" data-club-tab-panel="accounts">
      <form id="club-tab-account-invite" class="admin-form" style="margin-bottom:1rem">
        <div class="cc-field pp-col-5"><label>Invite email</label><input name="inviteEmail" type="email" required /></div>
        <div class="cc-field pp-col-3"><label>Role</label><select name="role"><option value="owner">owner</option><option value="manager">manager</option><option value="editor">editor</option></select></div>
        <div class="cc-field pp-col-4"><label>Notes</label><input name="notes" /></div>
        <div class="admin-actions"><button type="submit" class="cc-btn cc-btn--gold">Generate invite code</button></div>
      </form>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Code</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
}

function countJobsThisMonth(jobs: PromoterJob[]): number {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return jobs.filter((j) => String(j.jobDate).slice(0, 7) === prefix).length;
}

export function renderClubTabPanelHtml(
  tab: ClubDetailTab,
  club: Club,
  ctx: {
    rates: FinancialClubPaymentRate[];
    editingRateId: string | null;
    heroIndex: number;
    bookings: FinancialBooking[];
    transactions: FinancialTransactionRow[];
    jobs: PromoterJob[];
    promoters: PromoterProfile[];
    clubPromoters: ClubPromoterAccessRow[];
    accounts: ClubAccountRow[];
    isActive: boolean;
  },
): string {
  const primary = pickPrimaryNightlifeRate(club.slug, ctx.rates);
  const sheet = primaryRateSheet(primary);
  switch (tab) {
    case "overview":
      return renderClubTabOverviewHtml(club, countJobsThisMonth(ctx.jobs), ctx.isActive);
    case "guestlist":
      return renderClubTabGuestlistHtml(club, primary, sheet);
    case "tickets":
      return renderClubTabTicketsHtml(club, primary, sheet);
    case "tables":
      return renderClubTabTablesHtml(club, primary, sheet);
    case "events":
      return renderClubTabEventsHtml(club, primary, sheet);
    case "banking":
      return renderClubTabFinancialHtml(club);
    case "listing":
      return renderClubTabListingHtml(club);
    case "media":
      return renderClubTabMediaHtml(club, ctx.heroIndex);
    case "jobs":
      return renderClubTabJobsHtml(ctx.jobs, ctx.promoters);
    case "promoters":
      return `${renderClubTabPromotersHtml(ctx.clubPromoters)}${renderClubTabAccountsHtml(ctx.accounts)}`;
    default:
      return "";
  }
}

export type ClubTabCache = {
  jobs: PromoterJob[];
  clubPromoters: ClubPromoterAccessRow[];
  accounts: ClubAccountRow[];
  bookings: FinancialBooking[];
};

export async function loadClubTabCache(
  supabase: SupabaseClient,
  slug: string,
  financialPeriodFrom: string,
  financialPeriodTo: string,
): Promise<ClubTabCache> {
  const [jobsRes, promRes, acctRes] = await Promise.all([
    loadClubJobs(supabase, slug),
    loadClubPromoters(supabase, slug),
    loadClubAccounts(supabase),
  ]);
  const from = financialPeriodFrom || `${new Date().getFullYear()}-01-01`;
  const to = financialPeriodTo || `${new Date().getFullYear()}-12-31`;
  const bookRes = await listFinancialBookings(supabase, { from, to });
  const bookings = (bookRes.ok ? bookRes.data : []).filter((b) => b.clubSlug === slug);
  const accounts = (acctRes.ok ? acctRes.rows : []).filter((a) => a.club_slug === slug);
  return {
    jobs: jobsRes.ok ? jobsRes.rows : [],
    clubPromoters: promRes.ok ? promRes.rows : [],
    accounts,
    bookings,
  };
}

export async function saveClubVenueMasterFromForms(
  supabase: SupabaseClient,
  slug: string,
  club: Club,
  rates: FinancialClubPaymentRate[],
  forms: {
    overview?: HTMLFormElement | null;
    guestlist?: HTMLFormElement | null;
    tickets?: HTMLFormElement | null;
    tables?: HTMLFormElement | null;
    events?: HTMLFormElement | null;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const primary = pickPrimaryNightlifeRate(slug, rates);
  const existingSheet = primary?.sheetExtension ?? {};
  const eventsFd = forms.events
    ? buildEventOverrideFormData(forms.events, primaryRateSheet(primary))
    : null;
  const venueErrs = validateVenueMasterForms(
    club,
    forms.guestlist ? new FormData(forms.guestlist) : null,
    forms.tickets ? new FormData(forms.tickets) : null,
  );
  if (venueErrs.length) return { ok: false, message: venueErrs.join(" ") };

  const sheetExt = normalizeClubFinancialRuleSheetExtension(
    mergeSheetExtensions(
      buildSheetExtensionFromVenueForms(existingSheet, {
        guestlist: forms.guestlist ? new FormData(forms.guestlist) : null,
        tickets: forms.tickets ? new FormData(forms.tickets) : null,
        tables: forms.tables ? new FormData(forms.tables) : null,
        events: eventsFd,
      }),
      { venueType: club.masterVenueType ?? null },
    ),
  );

  const glFd = forms.guestlist ? new FormData(forms.guestlist) : null;
  const baseRate = glFd ? Number(glFd.get("standardRatePerGuest") || 0) || 0 : primary?.baseRate ?? 0;
  let bonusType = String(glFd?.get("guestlistBonusType") ?? primary?.bonusType ?? "none");
  if (bonusType !== "flat" && bonusType !== "stacking") bonusType = "none";

  const res = await upsertFinancialClubPaymentRate(supabase, {
    id: primary?.id,
    department: "nightlife",
    clubSlug: slug,
    venueOrServiceName: primary?.venueOrServiceName?.trim() || "Guestlist",
    logicType: "flat_fee",
    maleRate: glFd ? Number(glFd.get("maleBonusRate") || 0) || 0 : primary?.maleRate ?? 0,
    femaleRate: glFd ? Number(glFd.get("femaleBonusRate") || 0) || 0 : primary?.femaleRate ?? 0,
    baseRate,
    bonusType: bonusType as "none" | "flat" | "stacking",
    bonusGoal: glFd ? Number(glFd.get("guestlistBonusRequired") || 0) || 0 : primary?.bonusGoal ?? 0,
    bonusAmount: glFd ? Number(glFd.get("guestlistBonusFlatRate") || 0) || 0 : primary?.bonusAmount ?? 0,
    effectiveFrom: primary?.effectiveFrom?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    isActive: true,
    sheetExtension: sheetExt,
  });
  if (!res.ok) return { ok: false, message: res.message };
  return { ok: true };
}

export async function saveClubRateFromForm(
  supabase: SupabaseClient,
  slug: string,
  form: HTMLFormElement,
  existingRates: FinancialClubPaymentRate[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const fd = new FormData(form);
  const id = String(fd.get("rateId") || "").trim();
  const department = String(fd.get("department") || "nightlife").trim() as
    | "nightlife"
    | "transport"
    | "protection"
    | "other";
  let bonusType = String(fd.get("bonusType") || "none").trim();
  if (bonusType !== "flat" && bonusType !== "stacking") bonusType = "none";
  const existing = id ? existingRates.find((r) => r.id === id) : undefined;
  const logicType =
    department === "nightlife" ? "flat_fee" : (existing?.logicType ?? "flat_fee");
  const res = await upsertFinancialClubPaymentRate(supabase, {
    id: id || undefined,
    department,
    clubSlug: slug,
    venueOrServiceName: String(fd.get("venueOrServiceName") || "").trim(),
    logicType,
    maleRate: Number(fd.get("maleRate") || 0) || 0,
    femaleRate: Number(fd.get("femaleRate") || 0) || 0,
    baseRate: Number(fd.get("baseRate") || 0) || 0,
    bonusType: bonusType as "none" | "flat" | "stacking",
    bonusGoal: Number(fd.get("bonusGoal") || 0) || 0,
    bonusAmount: Number(fd.get("bonusAmount") || 0) || 0,
    effectiveFrom: String(fd.get("effectiveFrom") || "").trim().slice(0, 10),
    isActive: fd.get("isActive") != null,
    sheetExtension: existing?.sheetExtension ?? {},
  });
  if (!res.ok) return { ok: false, message: res.message };
  return { ok: true };
}

export async function inviteClubAccountFromForm(
  supabase: SupabaseClient,
  slug: string,
  form: HTMLFormElement,
): Promise<{ ok: true; inviteCode: string } | { ok: false; message: string }> {
  const fd = new FormData(form);
  const role = String(fd.get("role") || "owner").trim() as "owner" | "manager" | "editor";
  const res = await issueClubInvite(supabase, {
    clubSlug: slug,
    inviteEmail: String(fd.get("inviteEmail") || "").trim(),
    role: role === "manager" || role === "editor" ? role : "owner",
    notes: String(fd.get("notes") || "").trim(),
  });
  if (!res.ok) return { ok: false, message: res.message };
  return { ok: true, inviteCode: res.row.inviteCode };
}

export async function setPromoterAccessFromRow(
  supabase: SupabaseClient,
  preferenceId: string,
  allow: boolean,
  note: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return setClubPromoterAccess(supabase, preferenceId, allow, note);
}
