import {
  fetchCars,
  fetchClubFlyersAdmin,
  fetchClubs,
} from "../data/fetch-data";
import { gateAdminUser, signInAdmin, signOutAdmin } from "../admin/auth";
import {
  deleteCarFromDb,
  deleteClubFromDb,
  loadCarsForAdmin,
  loadClubsForAdmin,
  upsertAllCarsOrder,
  upsertAllClubsOrder,
  upsertCarToDb,
  upsertClubToDb,
} from "../admin/catalog";
import {
  createClientsFromEnquiry,
  loadEnquiriesForAdmin,
  loadEnquiryGuests,
  updateEnquiryStatus,
  type EnquiryGuestRow,
  type EnquiryRow,
} from "../admin/enquiries";
import {
  createEmptyClient,
  deleteClientAttendanceForAdmin,
  deleteClientById,
  loadClientAttendancesForAdmin,
  loadClientGuestlistActivityForAdmin,
  loadClientsForAdmin,
  saveClientAttendanceForAdmin,
  updateClientById,
  type ClientAttendanceRow,
  type ClientGuestlistActivityRow,
  type ClientRow,
} from "../admin/clients";
import {
  issueClubInvite,
  loadClubAccounts,
  loadClubEditRevisions,
  loadJobDisputes,
  reviewClubEditRevision,
  reviewJobDispute,
  type ClubAccountRow,
  type ClubEditRevisionRow,
  type JobDisputeRow,
} from "../admin/clubs";
import {
  applyRecurringFinancialTransactions,
  deleteFinancialRecurringTemplate,
  getFinancialPeriodSummary,
  getFinancialReport,
  loadFinancialPayees,
  loadFinancialRecurringTemplates,
  loadFinancialTransactions,
  upsertFinancialPayee,
  upsertFinancialRecurringTemplate,
  upsertFinancialTransaction,
  adminInsertTableSale,
  approvePromoterRevision,
  completePromoterJob,
  createPromoterJob,
  deletePromoterJob,
  generateInvoiceForPromoter,
  loadPendingGuestlistQueueForAdmin,
  loadPendingNightAdjustmentsForAdmin,
  loadPendingTableSalesQueueForAdmin,
  loadPromoterAvailability,
  loadPromoterInvoices,
  loadPromoterJobs,
  loadPromoterJobsCalendar,
  loadPromoterPreferences,
  type PromoterRevisionRow,
  loadPromotersForAdmin,
  loadPromoterRevisionsForAdmin,
  loadPromoterSignupRequestsForAdmin,
  loadTableSalesReportForAdmin,
  reviewGuestlistEntryAsAdmin,
  reviewNightAdjustmentAsAdmin,
  reviewTableSaleAsAdmin,
  setFinancialRecurringTemplateActive,
  updatePromoterJob,
} from "../admin/promoters";
import {
  archiveFinancialBooking,
  archiveFinancialRule,
  getFinancialDashboardSnapshot,
  listFinancialConfigChangeRequests,
  listFinancialBookings,
  listFinancialPromoters,
  listFinancialRules,
  reviewFinancialConfigChangeRequest,
  upsertFinancialPromoter,
  upsertFinancialRule,
  upsertNightlifeFinancialBooking,
  upsertServiceFinancialBooking,
} from "../admin/financial-tracking";
import {
  callPromoterInvoiceEdge,
  downloadPdfFromBase64,
} from "../lib/promoter-invoice-edge";
import { adminPromoterRequestDecision } from "../lib/promoter-request-edge";
import { attachClubAddressAutocomplete } from "../admin/places-autocomplete";
import { mountDataTable } from "../portal/data-table";
import { renderStatusBadge } from "../portal/badge";
import { getSupabaseClient } from "../lib/supabase";
import type {
  FinancialDirection,
  FinancialPeriodSummary,
  FinancialPayee,
  FinancialStatus,
  FinancialRecurringTemplate,
  FinancialTransactionRow,
  FinancialBooking,
  FinancialConfigChangeRequest,
  FinancialDashboardSnapshot,
  FinancialPromoterProfile,
  FinancialRule,
  Car,
  Club,
  ClubFlyer,
  GuestlistRecurrence,
  PromoterAvailabilitySlot,
  PromoterInvoice,
  PromoterGuestlistQueueRow,
  PromoterNightAdjustmentQueueRow,
  PromoterJob,
  PromoterJobAdminRow,
  PromoterProfile,
  PromoterSignupRequest,
  PromoterTableSaleQueueRow,
  PromoterTableSaleReportRow,
} from "../types";
import "../styles/pages/admin.css";

/** Desk = CRM; catalog = clubs, cars, weekly flyers */
type AdminView =
  | "admin_profile"
  | "enquiries"
  | "clients"
  | "promoter_requests"
  | "promoters"
  | "jobs"
  | "guestlist_queue"
  | "night_adjustments"
  | "table_sales"
  | "invoices"
  | "financials"
  | "club_accounts"
  | "club_edits"
  | "job_disputes"
  | "clubs"
  | "cars"
  | "flyers";
type AdminNavSection = "account" | "enquiries" | "promoters" | "clubs" | "website";

const ADMIN_VIEW_HEADINGS: Record<AdminView, { title: string; subtitle: string }> = {
  admin_profile: {
    title: "Profile settings",
    subtitle:
      "Manage admin identity controls (email/username/password) and account access settings.",
  },
  enquiries: {
    title: "Enquiries",
    subtitle: "Review submissions, guest lists, and payload. Update status as you work each lead.",
  },
  clients: {
    title: "Clients",
    subtitle:
      "CRM profiles: edit fields, notes, and spend; guestlist signups append club / night / promoter history.",
  },
  promoter_requests: {
    title: "Promoter requests",
    subtitle: "Access requests from the portal. Approve or deny with clear actions.",
  },
  promoters: {
    title: "Promoter profiles",
    subtitle: "Review profiles and pending revision payloads.",
  },
  jobs: {
    title: "Promoter jobs",
    subtitle:
      "Calendar and list for the visible month. Filter by promoter or club, create jobs, then edit, complete, or delete each row.",
  },
  guestlist_queue: {
    title: "Guestlist review",
    subtitle:
      "Approve or reject names promoters submit for assigned guestlist jobs. Only approved guests update the job total and count toward payout when the job is completed.",
  },
  night_adjustments: {
    title: "Night shift requests",
    subtitle:
      "One-off availability overrides promoters submit for specific dates. Approve or reject with notes.",
  },
  table_sales: {
    title: "Tables sold",
    subtitle:
      "Dual entry: promoters log bookings pending review; office logs approved rows immediately. Use the report for totals by date range and club.",
  },
  invoices: {
    title: "Promoter invoices",
    subtitle:
      "Generate draft statements from earnings, download PDFs, and email them to the promoter’s login address via Resend (configure Edge Function + secrets). Set INVOICE_EMAIL_PROVIDER=disabled to block sends while keeping PDFs.",
  },
  financials: {
    title: "Financials",
    subtitle:
      "Ledger entries, recurring templates, and period summaries from financial_transactions.",
  },
  club_accounts: {
    title: "Club accounts",
    subtitle: "Issue invite-only club logins and manage account ownership/status.",
  },
  club_edits: {
    title: "Club edit moderation",
    subtitle: "Review submitted club/flyer/media edits and approve, reject, or suggest changes.",
  },
  job_disputes: {
    title: "Job disputes",
    subtitle: "Resolve club-raised disputes linked to promoter jobs and related records.",
  },
  clubs: {
    title: "Clubs",
    subtitle: "Nightlife catalog: edit fields and save to the database.",
  },
  cars: {
    title: "Cars",
    subtitle: "Chauffeur fleet tiles: edit fields and save to the database.",
  },
  flyers: {
    title: "Weekly flyers",
    subtitle: "Event flyers per club. Save clubs to the DB before linking.",
  },
};

const FINANCIAL_CATEGORY_PRESETS = [
  "venue_income",
  "concierge_income",
  "promoter_payout",
  "staff_cost",
  "marketing",
  "software",
  "travel",
  "office",
  "tax",
];

type ClubEntry = { dbId: string | null; club: Club };
type CarEntry = { dbId: string | null; car: Car };

/** Public uploads: flyers, club/car catalog images (same bucket, different path prefixes). */
const ADMIN_MEDIA_BUCKET = "club-flyers";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ENQUIRY_STATUSES = ["new", "contacted", "in_progress", "closed", "spam"] as const;

function csvEscape(v: string): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadTextFile(name: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function cloneClub(c?: Partial<Club>): Club {
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

function cloneCar(c?: Partial<Car>): Car {
  return {
    slug: c?.slug ?? "",
    name: c?.name ?? "",
    roleLabel: c?.roleLabel ?? "",
    specsHover: c?.specsHover ?? [],
    gridSize: c?.gridSize ?? "medium",
    order: c?.order ?? 0,
    images: c?.images ?? [],
  };
}

function cloneFlyer(f?: Partial<ClubFlyer>): ClubFlyer {
  return {
    id: f?.id ?? "",
    clubSlug: f?.clubSlug ?? "",
    eventDate: f?.eventDate ?? "",
    title: f?.title ?? "",
    description: f?.description ?? "",
    imagePath: f?.imagePath ?? "",
    imageUrl: f?.imageUrl ?? "",
    isActive: f?.isActive ?? true,
    sortOrder: f?.sortOrder ?? 0,
  };
}

function parseVenueType(raw: string): Club["venueType"] {
  const t = raw.trim().toLowerCase();
  if (t === "dining") return "dining";
  if (t === "club") return "club";
  if (t === "lounge") return "lounge";
  return "lounge";
}

function parseLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseGuestlists(raw: string): Club["guestlists"] {
  const lines = parseLines(raw);
  return lines.map((line) => {
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

function guestlistsText(rows: Club["guestlists"]): string {
  return rows
    .map((g) => `${g.days.join("|")},${g.recurrence},${g.notes ?? ""}`)
    .join("\n");
}

function asClubsCsv(rows: Club[]): string {
  const header = [
    "slug",
    "name",
    "short_description",
    "long_description",
    "location_tag",
    "address",
    "days_open",
    "best_visit_days",
    "featured",
    "featured_day",
    "venue_type",
    "lat",
    "lng",
    "min_spend",
    "website",
    "amenities",
    "known_for",
    "entry_pricing_women",
    "entry_pricing_men",
    "tables_standard",
    "tables_luxury",
    "tables_vip",
  ];
  const lines = [header.join(",")];
  for (const c of rows) {
    const row = [
      c.slug,
      c.name,
      c.shortDescription,
      c.longDescription,
      c.locationTag,
      c.address,
      c.daysOpen,
      c.bestVisitDays.join("|"),
      c.featured ? "TRUE" : "FALSE",
      c.featuredDay,
      c.venueType,
      String(c.lat || 0),
      String(c.lng || 0),
      c.minSpend,
      c.website,
      c.amenities.join("|"),
      c.knownFor.join("; "),
      c.entryPricingWomen,
      c.entryPricingMen,
      c.tablesStandard,
      c.tablesLuxury,
      c.tablesVip,
    ].map(csvEscape);
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

function safeUploadPath(fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${new Date().toISOString().slice(0, 10)}/${Date.now()}_${safe}`;
}

function escapeAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Safe for textarea / raw text nodes (not attribute-quoted). */
function escapeHtmlText(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\u0000/g, "");
}

/** Single-line display text for admin list cells (truncate before escaping). */
function adminDisplayTruncate(s: string, max: number): string {
  const t = String(s).replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

const ADMIN_JOB_SERVICES = [
  "guestlist",
  "private_table",
  "venue_access",
] as const;

function jobServiceSelectHtml(value: string): string {
  return ADMIN_JOB_SERVICES.map(
    (s) =>
      `<option value="${escapeAttr(s)}"${s === value ? " selected" : ""}>${escapeAttr(s)}</option>`,
  ).join("");
}

function isoLocalYmd(y: number, m: number, d: number): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${y}-${p(m + 1)}-${p(d)}`;
}

function buildAdminJobsCalendarHtml(
  year: number,
  month: number,
  rows: PromoterJobAdminRow[],
): string {
  const headers = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byDay = new Map<number, PromoterJobAdminRow[]>();
  for (const j of rows) {
    const parts = j.jobDate.split("-");
    if (parts.length < 3) continue;
    const jy = Number(parts[0]);
    const jm = Number(parts[1]);
    const jd = Number(parts[2]);
    if (jy === year && jm === month + 1) {
      if (!byDay.has(jd)) byDay.set(jd, []);
      byDay.get(jd)!.push(j);
    }
  }
  const firstDow = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isThisMonth =
    today.getFullYear() === year && today.getMonth() === month;
  const todayDay = today.getDate();
  const head = headers
    .map((h) => `<div class="admin-jobs__cal-hd">${escapeAttr(h)}</div>`)
    .join("");
  let cells = "";
  for (let i = 0; i < firstDow; i++) {
    cells += `<div class="admin-jobs__cal-cell admin-jobs__cal-cell--pad" aria-hidden="true"></div>`;
  }
  for (let d = 1; d <= dim; d++) {
    const jobs = byDay.get(d) ?? [];
    const isToday = isThisMonth && d === todayDay;
    const pills = jobs
      .slice(0, 4)
      .map(
        (j) =>
          `<button type="button" class="admin-jobs__cal-pill admin-jobs__cal-pill--${escapeAttr(j.status)}" data-open-job-edit="${escapeAttr(j.id)}" title="${escapeAttr(`${j.promoterDisplayName} · ${j.clubSlug ?? "—"} · ${j.service}`)}">${escapeAttr(adminDisplayTruncate(j.promoterDisplayName, 11))}</button>`,
      )
      .join("");
    const more =
      jobs.length > 4
        ? `<span class="admin-jobs__cal-more">+${jobs.length - 4}</span>`
        : "";
    cells += `<div class="admin-jobs__cal-cell${isToday ? " admin-jobs__cal-cell--today" : ""}">
      <div class="admin-jobs__cal-daynum">${d}</div>
      <div class="admin-jobs__cal-pills">${pills}${more}</div>
    </div>`;
  }
  const totalCells = firstDow + dim;
  const tail = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < tail; i++) {
    cells += `<div class="admin-jobs__cal-cell admin-jobs__cal-cell--pad" aria-hidden="true"></div>`;
  }
  return `<div class="admin-jobs__cal-grid">${head}${cells}</div>`;
}

function adminListTableWrap(tableInner: string): string {
  return `<div class="admin-list-table-wrap"><table class="admin-table admin-list-table">${tableInner}</table></div>`;
}

function bindAdminListRows(
  listEl: Element,
  rowSelector: string,
  handler: (row: HTMLElement) => void,
): void {
  listEl.querySelectorAll<HTMLElement>(rowSelector).forEach((row) => {
    const run = () => handler(row);
    row.addEventListener("click", run);
    row.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        run();
      }
    });
  });
}

function validateClubShape(club: Club): string[] {
  const err: string[] = [];
  const slug = club.slug.trim();
  if (!slug) err.push("Club slug is required.");
  else if (!SLUG_PATTERN.test(slug))
    err.push("Club slug: use lowercase letters, numbers, and hyphens only.");
  if (!club.name.trim()) err.push("Club name is required.");
  const lat = club.lat;
  const lng = club.lng;
  if (lat !== 0 || lng !== 0) {
    if (Number.isNaN(lat) || lat < -90 || lat > 90)
      err.push("Latitude must be between -90 and 90.");
    if (Number.isNaN(lng) || lng < -180 || lng > 180)
      err.push("Longitude must be between -180 and 180.");
  }
  const w = club.website.trim();
  if (w) {
    try {
      const u = w.includes("://") ? w : `https://${w}`;
      new URL(u);
    } catch {
      err.push("Website does not look like a valid URL.");
    }
  }
  const dImg = club.discoveryCardImage?.trim();
  if (
    dImg &&
    !dImg.startsWith("/") &&
    !/^https?:\/\//i.test(dImg)
  ) {
    err.push(
      "Discovery card image must start with / or be a full http(s) URL.",
    );
  }
  return err;
}

function validateCarShape(car: Car): string[] {
  const err: string[] = [];
  const slug = car.slug.trim();
  if (!slug) err.push("Car slug is required.");
  else if (!SLUG_PATTERN.test(slug))
    err.push("Car slug: use lowercase letters, numbers, and hyphens only.");
  if (!car.name.trim()) err.push("Car name is required.");
  const g = car.gridSize;
  if (g !== "large" && g !== "medium" && g !== "feature")
    err.push("Grid size must be large, medium, or feature.");
  return err;
}

function validateFlyerShape(f: ClubFlyer, entries: ClubEntry[]): string[] {
  const err: string[] = [];
  const slug = f.clubSlug.trim();
  if (!slug) err.push("Select a club.");
  else {
    const entry = entries.find((x) => x.club.slug.trim() === slug);
    if (!entry?.dbId)
      err.push(
        "That club is not in the database yet—open Catalog → Clubs and save it first.",
      );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.eventDate.trim()))
    err.push("Event date must be YYYY-MM-DD.");
  if (!f.title.trim()) err.push("Flyer title is required.");
  if (!f.imageUrl.trim() && !f.imagePath.trim())
    err.push("Add a flyer image (upload or paste a public image URL).");
  return err;
}

function flyerClubSelectOptions(
  entries: ClubEntry[],
  selectedSlug: string,
): string {
  if (!entries.length) {
    return `<option value="">No clubs—add one under Catalog → Clubs</option>`;
  }
  const sel = selectedSlug.trim();
  return entries
    .map((entry) => {
      const s = entry.club.slug.trim();
      const label = `${entry.club.name} (${s})`;
      const selected = s === sel ? " selected" : "";
      return `<option value="${escapeAttr(s)}"${selected}>${escapeAttr(label)}</option>`;
    })
    .join("");
}

function renderClientDetail(
  c: ClientRow,
  activity: ClientGuestlistActivityRow[],
  attendances: ClientAttendanceRow[],
  clubs: ClubEntry[],
  promoters: PromoterProfile[],
  selectedAttendanceId: string | null,
): string {
  const spendVal =
    c.typical_spend_gbp != null && Number.isFinite(c.typical_spend_gbp)
      ? String(c.typical_spend_gbp)
      : "";
  const promoOpts = [
    `<option value="">— None —</option>`,
    ...promoters.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === c.preferred_promoter_id ? " selected" : ""}>${escapeAttr(p.displayName || p.userId)}</option>`,
    ),
  ].join("");
  const selectedAttendance =
    (selectedAttendanceId &&
      attendances.find((a) => a.id === selectedAttendanceId)) ||
    null;
  const clubOpts = clubs
    .map(
      (entry) =>
        `<option value="${escapeAttr(entry.club.slug)}"${entry.club.slug === c.preferred_club_slug ? " selected" : ""}>${escapeAttr(entry.club.name)}</option>`,
    )
    .join("");
  const attendanceClubOpts = clubs
    .map(
      (entry) =>
        `<option value="${escapeAttr(entry.club.slug)}"${entry.club.slug === selectedAttendance?.club_slug ? " selected" : ""}>${escapeAttr(entry.club.name)}</option>`,
    )
    .join("");
  const attendancePromoOpts = [
    `<option value="">— None —</option>`,
    ...promoters.map(
      (p) =>
        `<option value="${escapeAttr(p.id)}"${p.id === selectedAttendance?.promoter_id ? " selected" : ""}>${escapeAttr(p.displayName || p.userId)}</option>`,
    ),
  ].join("");
  const activityRows =
    activity.length === 0
      ? "<tr><td colspan='5'>No guestlist visits linked yet (signups append automatically).</td></tr>"
      : activity
          .map((a) => {
            const pr = a.promoter_id
              ? promoters.find((p) => p.id === a.promoter_id)
              : undefined;
            const promo = a.promoter_id
              ? escapeAttr(pr?.displayName || pr?.userId || `${a.promoter_id.slice(0, 8)}…`)
              : "—";
            return `<tr>
            <td>${escapeAttr(a.event_date)}</td>
            <td><code class="admin-list-code">${escapeAttr(a.club_slug)}</code></td>
            <td>${promo}</td>
            <td>${a.enquiry_id ? `<code class="admin-list-code">${escapeAttr(a.enquiry_id.slice(0, 8))}…</code>` : "—"}</td>
            <td>${a.guest_profile_id ? `<code class="admin-list-code">${escapeAttr(a.guest_profile_id.slice(0, 8))}…</code>` : "—"}</td>
          </tr>`;
          })
          .join("");
  const attendanceRows =
    attendances.length === 0
      ? "<tr><td colspan='7'>No attendance history yet. Add past visits below.</td></tr>"
      : attendances
          .map((a) => {
            const pr = a.promoter_id
              ? promoters.find((p) => p.id === a.promoter_id)
              : undefined;
            const isActive = selectedAttendanceId === a.id ? " is-active" : "";
            return `<tr class="admin-list-row${isActive}" data-client-attendance-id="${escapeAttr(a.id)}">
            <td>${escapeAttr(a.event_date)}</td>
            <td><code class="admin-list-code">${escapeAttr(a.club_slug)}</code></td>
            <td>${escapeAttr(pr?.displayName || pr?.userId || "—")}</td>
            <td>£${Number(a.spend_gbp || 0).toFixed(2)}</td>
            <td>${escapeAttr(a.source || "manual")}</td>
            <td>${escapeAttr(a.notes || "—")}</td>
            <td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-client-attendance-delete="${escapeAttr(a.id)}">Delete</button></td>
          </tr>`;
          })
          .join("");
  return `
      <div class="admin-client-detail">
        <h4 class="admin-subhead" style="margin-top: 0">Client record</h4>
        <form class="admin-form" id="admin-client-form" data-collapsible="true">
          <input type="hidden" name="client_id" value="${escapeAttr(c.id)}" />
          <h4 class="full">Contact Details</h4>
          <div class="cc-field"><label for="client-name">Name</label>
            <input id="client-name" name="name" value="${escapeAttr(c.name ?? "")}" /></div>
          <div class="cc-field"><label for="client-email">Email</label>
            <input id="client-email" name="email" type="email" value="${escapeAttr(c.email ?? "")}" /></div>
          <div class="cc-field"><label for="client-phone">Phone</label>
            <input id="client-phone" name="phone" value="${escapeAttr(c.phone ?? "")}" /></div>
          <div class="cc-field"><label for="client-ig">Instagram</label>
            <input id="client-ig" name="instagram" value="${escapeAttr(c.instagram ?? "")}" placeholder="@handle" /></div>
          <h4 class="full">Preferences</h4>
          <div class="cc-field"><label for="client-spend">Typical spend (GBP / night)</label>
            <input id="client-spend" name="typical_spend_gbp" type="number" min="0" step="0.01" placeholder="e.g. 500" value="${escapeAttr(spendVal)}" /></div>
          <div class="cc-field full"><label for="client-nights">Preferred nights</label>
            <input id="client-nights" name="preferred_nights" value="${escapeAttr(c.preferred_nights ?? "")}" placeholder="Fri, Sat" /></div>
          <div class="cc-field full"><label for="client-promoter">Preferred promoter</label>
            <select id="client-promoter" name="preferred_promoter_id">${promoOpts}</select></div>
          <div class="cc-field full"><label for="client-club">Preferred club</label>
            <select id="client-club" name="preferred_club_slug"><option value="">— None —</option>${clubOpts}</select></div>
          <div class="cc-field full"><label for="client-notes">Notes (Internal)</label>
            <textarea id="client-notes" name="notes" rows="4" placeholder="VIP preferences, relationships, spend patterns…">${escapeHtmlText(c.notes ?? "")}</textarea></div>
          <h4 class="full">System Details</h4>
          <div class="cc-field full"><label>Guest profile id</label>
            <input value="${escapeAttr(c.guest_profile_id ?? "—")}" readonly /></div>
          <div class="cc-field full"><label>Added</label>
            <input value="${escapeAttr(c.created_at || "—")}" readonly /></div>
          <div class="admin-actions full">
            <button type="button" class="cc-btn cc-btn--gold" id="admin-client-save">Save Changes</button>
          </div>
        </form>
        <h4 class="admin-subhead">Attendance history (editable)</h4>
        <p class="admin-hint">Client preferences are auto-calculated from this attendance history.</p>
        <div class="full promoter-table-wrap">
          <table class="admin-list-table">
            <thead><tr>
              <th scope="col">Date</th>
              <th scope="col">Club</th>
              <th scope="col">Promoter</th>
              <th scope="col">Spend</th>
              <th scope="col">Source</th>
              <th scope="col">Notes</th>
              <th scope="col">Action</th>
            </tr></thead>
            <tbody>${attendanceRows}</tbody>
          </table>
        </div>
        <form class="admin-form" id="admin-client-attendance-form" data-collapsible="true">
          <input type="hidden" name="attendance_id" value="${escapeAttr(selectedAttendance?.id || "")}" />
          <h4 class="full">Visit Details</h4>
          <div class="cc-field"><label>Date</label><input name="event_date" type="date" required value="${escapeAttr(selectedAttendance?.event_date || new Date().toISOString().slice(0, 10))}" /></div>
          <div class="cc-field"><label>Club</label><select name="club_slug" required>${attendanceClubOpts}</select></div>
          <div class="cc-field"><label>Promoter</label><select name="promoter_id">${attendancePromoOpts}</select></div>
          <div class="cc-field"><label>Spend (GBP)</label><input name="spend_gbp" type="number" min="0" step="0.01" value="${escapeAttr(String(selectedAttendance?.spend_gbp ?? 0))}" /></div>
          <div class="cc-field"><label>Source</label><input name="source" value="${escapeAttr(selectedAttendance?.source || "manual")}" /></div>
          <div class="cc-field full"><label>Details</label><textarea name="attendance_notes" rows="2">${escapeHtmlText(selectedAttendance?.notes || "")}</textarea></div>
          <div class="admin-actions full">
            <button type="button" class="cc-btn cc-btn--gold" id="admin-client-attendance-save">${selectedAttendance ? "Save Changes" : "Create Visit"}</button>
            ${
              selectedAttendance
                ? `<button type="button" class="cc-btn cc-btn--ghost" id="admin-client-attendance-new">Create New</button>`
                : ""
            }
          </div>
        </form>
        <h4 class="admin-subhead">Guestlist history</h4>
        <p class="admin-hint">Clubs and nights captured when this person (or party) signs up on the site; promoter comes from the guestlist event if set.</p>
        <div class="full promoter-table-wrap">
          <table class="admin-list-table">
            <thead><tr>
              <th scope="col">Night</th>
              <th scope="col">Club</th>
              <th scope="col">Promoter (event)</th>
              <th scope="col">Enquiry</th>
              <th scope="col">Guest profile</th>
            </tr></thead>
            <tbody>${activityRows}</tbody>
          </table>
        </div>
      </div>`;
}

export async function initAdminPortal(): Promise<void> {
  const adminRootEl = document.getElementById("admin-root");
  if (!adminRootEl) return;

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    adminRootEl.innerHTML = `
      <div class="admin-card">
        <h3>Supabase not configured</h3>
        <p class="admin-note">Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>, then restart the dev server.</p>
      </div>`;
    return;
  }
  const adminRoot = adminRootEl;
  const supabase = supabaseClient;

  let view: AdminView = "enquiries";
  let adminNavExpanded: AdminNavSection = "enquiries";
  let selectedClub = 0;
  let selectedCar = 0;
  let selectedFlyer = 0;
  let selectedEnquiry: string | null = null;
  let selectedClientId: string | null = null;
  let selectedPromoterId: string | null = null;
  let selectedRevisionId: string | null = null;
  let clubEntries: ClubEntry[] = [];
  let carEntries: CarEntry[] = [];
  let flyers: ClubFlyer[] = [];
  let enquiries: EnquiryRow[] = [];
  let enquiryGuests: EnquiryGuestRow[] = [];
  let clients: ClientRow[] = [];
  let clientGuestlistActivity: ClientGuestlistActivityRow[] = [];
  let clientAttendances: ClientAttendanceRow[] = [];
  let selectedClientAttendanceId: string | null = null;
  let promoterSignupRequests: PromoterSignupRequest[] = [];
  let selectedPromoterRequestId: string | null = null;
  let promoters: PromoterProfile[] = [];
  let promoterRevisions: PromoterRevisionRow[] = [];
  let _promoterAvailability: PromoterAvailabilitySlot[] = [];
  let _promoterPreferences: Array<{ clubSlug: string; weekdays: string[]; status: string }> = [];
  let promoterJobs: PromoterJob[] = [];
  let jobsCalendarYear = new Date().getFullYear();
  let jobsCalendarMonth = new Date().getMonth();
  let jobsCalendarRows: PromoterJobAdminRow[] = [];
  let jobsFilterPromoterId = "";
  let jobsFilterClubSlug = "";
  let editingJobId: string | null = null;
  let jobsCreateOpen = false;
  let jobsCalendarOpen = false;
  let adminProfileFormOpen = false;
  let clubFormOpen = false;
  let carFormOpen = false;
  let flyerFormOpen = false;
  let invoiceFormOpen = false;
  let clubAccountsFormOpen = false;
  let promoterInvoices: PromoterInvoice[] = [];
  let _financialRows: Array<{ period_label: string; income: number; expense: number; net: number }> = [];
  let financialPeriodFrom = "";
  let financialPeriodTo = "";
  let financialCalendarYear = new Date().getFullYear();
  let financialCalendarMonth = new Date().getMonth();
  let financialViewMode: "calendar" | "table" = "table";
  let financialFilterDirection: "" | "income" | "expense" = "";
  let financialFilterStatus: "" | FinancialStatus = "";
  let financialFilterTag = "";
  let financialFilterPayeeId = "";
  let financialScopePaymentStatus: "" | "expected" | "attended" | "paid_final" = "";
  let financialScopePromoterId = "";
  let financialScopeSearch = "";
  let financialSummary: FinancialPeriodSummary = {
    income: 0,
    expense: 0,
    net: 0,
    txCount: 0,
  };
  let financialTransactions: FinancialTransactionRow[] = [];
  let financialRecurringTemplates: FinancialRecurringTemplate[] = [];
  let financialPayees: FinancialPayee[] = [];
  let nativeFinancialRules: FinancialRule[] = [];
  let nativeFinancialPromoters: FinancialPromoterProfile[] = [];
  let nativeFinancialBookings: FinancialBooking[] = [];
  let financialChangeRequests: FinancialConfigChangeRequest[] = [];
  let nativeFinancialSnapshot: FinancialDashboardSnapshot = {
    totalRealizedProfit: 0,
    nightlifeRealizedProfit: 0,
    transportRealizedProfit: 0,
    protectionRealizedProfit: 0,
    otherRealizedProfit: 0,
    totalNightlifeGuests: 0,
    avgNightlifeProfitPerGuest: 0,
    outstandingProjectedProfit: 0,
    realizedProjectedProfit: 0,
    topPromoterName: null,
    topPromoterRealizedProfit: 0,
  };
  let financialEditingTemplateId: string | null = null;
  let financialEditingTxId: string | null = null;
  let financialBulkStatus: FinancialStatus = "paid";
  let financialEntryOpen = false;
  let financialEntryMode: "one_off" | "recurring" = "one_off";
  let financialPayeeOpen = false;
  let financialEditingPayeeId: string | null = null;
  let financialRuleEditorOpen = false;
  let financialEditingRuleId: string | null = null;
  let financialPromoterEditorOpen = false;
  let financialBookingEditorOpen = false;
  let financialEditingBookingId: string | null = null;
  let financialDeleteConfirmOpen = false;
  let financialDeleteConfirmType: "rule" | "booking" | null = null;
  let financialDeleteConfirmId: string | null = null;
  let financialDelegationBound = false;
  let guestlistQueueRows: PromoterGuestlistQueueRow[] = [];
  let guestlistQueueDelegationBound = false;
  let nightAdjQueueRows: PromoterNightAdjustmentQueueRow[] = [];
  let tableSalesQueueRows: PromoterTableSaleQueueRow[] = [];
  let tableSalesReportRows: PromoterTableSaleReportRow[] = [];
  let tableSalesReportFrom = "";
  let listSearch = "";
  let listViewMode: "table" | "grid" | "calendar" = "table";
  let tableSalesReportTo = "";
  let tableSalesReportClub = "";
  let clubAccounts: ClubAccountRow[] = [];
  let selectedClubAccountId: string | null = null;
  let clubEditRevisions: ClubEditRevisionRow[] = [];
  let selectedClubRevisionId: string | null = null;
  let clubJobDisputes: JobDisputeRow[] = [];
  let selectedClubDisputeId: string | null = null;
  let tableSaleQueueDelegationBound = false;
  let tableSaleFormDelegationBound = false;
  let invoiceEdgeActionsBound = false;
  let nightAdjDelegationBound = false;
  let loginError = "";
  let createJobClients: Array<{
    mode: "existing" | "blank" | "new";
    clientId?: string;
    name: string;
    contact: string;
    newEmail?: string;
    newPhone?: string;
  }> = [];
  let adminProfile = {
    userId: "",
    email: "",
    username: "",
  };
  let promoterAccountSeedRows: PromoterProfile[] = [];
  void [_promoterAvailability, _promoterPreferences, _financialRows];

  async function loadClubEntries(): Promise<ClubEntry[]> {
    const db = await loadClubsForAdmin(supabase);
    if (db.ok && db.rows.length > 0) {
      return db.rows.map((r) => ({
        dbId: r.id,
        club: cloneClub(r.payload),
      }));
    }
    const staticClubs = await fetchClubs().catch(() => [] as Club[]);
    return staticClubs.map((c) => ({ dbId: null, club: cloneClub(c) }));
  }

  async function loadCarEntries(): Promise<CarEntry[]> {
    const db = await loadCarsForAdmin(supabase);
    if (db.ok && db.rows.length > 0) {
      return db.rows.map((r) => ({
        dbId: r.id,
        car: cloneCar(r.payload),
      }));
    }
    const staticCars = await fetchCars().catch(() => [] as Car[]);
    return staticCars.map((c) => ({ dbId: null, car: cloneCar(c) }));
  }

  async function syncClubIdsFromDb(): Promise<void> {
    const db = await loadClubsForAdmin(supabase);
    if (!db.ok) return;
    const bySlug = new Map(db.rows.map((r) => [r.slug, r.id]));
    clubEntries = clubEntries.map((e) => ({
      ...e,
      dbId: bySlug.get(e.club.slug.trim()) ?? e.dbId,
    }));
  }

  async function syncCarIdsFromDb(): Promise<void> {
    const db = await loadCarsForAdmin(supabase);
    if (!db.ok) return;
    const bySlug = new Map(db.rows.map((r) => [r.slug, r.id]));
    carEntries = carEntries.map((e) => ({
      ...e,
      dbId: bySlug.get(e.car.slug.trim()) ?? e.dbId,
    }));
  }

  async function reloadFlyers(): Promise<void> {
    flyers = (await fetchClubFlyersAdmin(supabase)).map((f) => cloneFlyer(f));
    selectedFlyer = Math.min(selectedFlyer, Math.max(0, flyers.length - 1));
  }

  async function reloadEnquiries(): Promise<void> {
    const r = await loadEnquiriesForAdmin(supabase);
    if (r.ok) enquiries = r.rows;
    if (selectedEnquiry && !enquiries.some((e) => e.id === selectedEnquiry)) {
      selectedEnquiry = enquiries[0]?.id ?? null;
    }
    if (selectedEnquiry) {
      const g = await loadEnquiryGuests(supabase, selectedEnquiry);
      enquiryGuests = g.ok ? g.rows : [];
    } else {
      enquiryGuests = [];
    }
  }

  async function reloadClients(): Promise<void> {
    const r = await loadClientsForAdmin(supabase);
    if (r.ok) clients = r.rows;
    if (selectedClientId && !clients.some((c) => c.id === selectedClientId)) {
      selectedClientId = clients[0]?.id ?? null;
    }
    if (!selectedClientId && clients[0]) selectedClientId = clients[0].id;
    clientGuestlistActivity = [];
    clientAttendances = [];
    selectedClientAttendanceId = null;
    if (selectedClientId) {
      const [a, at] = await Promise.all([
        loadClientGuestlistActivityForAdmin(supabase, selectedClientId),
        loadClientAttendancesForAdmin(supabase, selectedClientId),
      ]);
      clientGuestlistActivity = a.ok ? a.rows : [];
      clientAttendances = at.ok ? at.rows : [];
    }
  }

  async function reloadPromoterSignupRequests(): Promise<void> {
    const r = await loadPromoterSignupRequestsForAdmin(supabase);
    if (r.ok) promoterSignupRequests = r.rows;
    if (
      !selectedPromoterRequestId ||
      !promoterSignupRequests.some((x) => x.id === selectedPromoterRequestId)
    ) {
      selectedPromoterRequestId = promoterSignupRequests[0]?.id ?? null;
    }
  }

  async function reloadPromoters(): Promise<void> {
    const r = await loadPromotersForAdmin(supabase);
    if (r.ok) promoters = r.rows;
    if (!selectedPromoterId || !promoters.some((p) => p.id === selectedPromoterId)) {
      selectedPromoterId = promoters[0]?.id ?? null;
    }
    const rev = await loadPromoterRevisionsForAdmin(supabase, selectedPromoterId ?? undefined);
    promoterRevisions = rev.ok ? rev.rows : [];
    if (!selectedRevisionId || !promoterRevisions.some((x) => x.id === selectedRevisionId)) {
      selectedRevisionId = promoterRevisions[0]?.id ?? null;
    }
    if (selectedPromoterId) {
      const [a, pref, j, inv] = await Promise.all([
        loadPromoterAvailability(supabase, selectedPromoterId),
        loadPromoterPreferences(supabase, selectedPromoterId),
        loadPromoterJobs(supabase, selectedPromoterId),
        loadPromoterInvoices(supabase, selectedPromoterId),
      ]);
      _promoterAvailability = a.ok ? a.rows : [];
      _promoterPreferences = (pref.ok ? pref.rows : []).map((x) => ({
        clubSlug: x.clubSlug,
        weekdays: x.weekdays,
        status: x.status,
      }));
      promoterJobs = j.ok ? j.rows : [];
      promoterInvoices = inv.ok ? inv.rows : [];
    } else {
      _promoterAvailability = [];
      _promoterPreferences = [];
      promoterJobs = [];
      promoterInvoices = [];
    }
  }

  async function reloadJobsCalendar(): Promise<void> {
    const from = isoLocalYmd(jobsCalendarYear, jobsCalendarMonth, 1);
    const lastD = new Date(jobsCalendarYear, jobsCalendarMonth + 1, 0).getDate();
    const to = isoLocalYmd(jobsCalendarYear, jobsCalendarMonth, lastD);
    const r = await loadPromoterJobsCalendar(supabase, {
      from,
      to,
      promoterId: jobsFilterPromoterId.trim() || undefined,
      clubSlug: jobsFilterClubSlug.trim() || undefined,
    });
    jobsCalendarRows = r.ok ? r.rows : [];
    if (editingJobId && !jobsCalendarRows.some((j) => j.id === editingJobId)) {
      editingJobId = null;
    }
  }

  async function reloadFinancialReport(): Promise<void> {
    const now = new Date();
    if (!financialPeriodFrom.trim()) {
      financialPeriodFrom = `${now.getFullYear()}-01-01`;
    }
    if (!financialPeriodTo.trim()) {
      financialPeriodTo = `${now.getFullYear()}-12-31`;
    }
    {
      const p = financialPeriodFrom.trim().split("-");
      const y = Number(p[0]);
      const m = Number(p[1]);
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
        financialCalendarYear = y;
        financialCalendarMonth = m - 1;
      }
    }
    const from = financialPeriodFrom;
    const to = financialPeriodTo;
    const filters = {
      direction: financialFilterDirection || undefined,
      status: financialFilterStatus || undefined,
      paymentTag: financialFilterTag.trim() || undefined,
      payeeId: financialFilterPayeeId.trim() || undefined,
    };
    const [r, summary, txRows, recurring] = await Promise.all([
      getFinancialReport(supabase, "month", from, to, filters),
      getFinancialPeriodSummary(supabase, from, to, filters),
      loadFinancialTransactions(supabase, { from, to, ...filters }),
      loadFinancialRecurringTemplates(supabase),
    ]);
    _financialRows = r.ok ? r.rows : [];
    financialSummary = summary.ok
      ? summary.row
      : { income: 0, expense: 0, net: 0, txCount: 0 };
    financialTransactions = txRows.ok ? txRows.rows : [];
    financialRecurringTemplates = recurring.ok ? recurring.rows : [];
    const payees = await loadFinancialPayees(supabase);
    financialPayees = payees.ok ? payees.rows : [];
    const [rulesRes, promotersRes, bookingsRes, snapshotRes] = await Promise.all([
      listFinancialRules(supabase),
      listFinancialPromoters(supabase),
      listFinancialBookings(supabase, {
        from,
        to,
      }),
      getFinancialDashboardSnapshot(supabase, from, to),
    ]);
    nativeFinancialRules = rulesRes.ok ? rulesRes.data : [];
    nativeFinancialPromoters = promotersRes.ok ? promotersRes.data : [];
    nativeFinancialBookings = bookingsRes.ok ? bookingsRes.data : [];
    const promoterSeedRes = await loadPromotersForAdmin(supabase);
    promoterAccountSeedRows = promoterSeedRes.ok ? promoterSeedRes.rows : [];
    const reqRes = await listFinancialConfigChangeRequests(supabase, { status: "pending" });
    financialChangeRequests = reqRes.ok ? reqRes.data : [];
    nativeFinancialSnapshot = snapshotRes.ok
      ? snapshotRes.data
      : {
          totalRealizedProfit: 0,
          nightlifeRealizedProfit: 0,
          transportRealizedProfit: 0,
          protectionRealizedProfit: 0,
          otherRealizedProfit: 0,
          totalNightlifeGuests: 0,
          avgNightlifeProfitPerGuest: 0,
          outstandingProjectedProfit: 0,
          realizedProjectedProfit: 0,
          topPromoterName: null,
          topPromoterRealizedProfit: 0,
        };
  }

  async function saveFinancialTxPatch(
    txId: string,
    patch: Partial<{
      txDate: string;
      status: FinancialStatus;
    }>,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const base = financialTransactions.find((x) => x.id === txId);
    if (!base) return { ok: false, message: "Transaction not found in current period." };
    return upsertFinancialTransaction(supabase, {
      id: base.id,
      txDate: patch.txDate ?? base.txDate,
      category: base.category,
      direction: base.direction,
      status: patch.status ?? base.status,
      paymentTag: base.paymentTag,
      amount: base.amount,
      currency: base.currency,
      convertForeign: base.convertForeign,
      payeeId: base.payeeId,
      payeeLabel: base.payeeLabel,
      notes: base.notes,
    });
  }

  async function reloadGuestlistQueue(): Promise<void> {
    const r = await loadPendingGuestlistQueueForAdmin(supabase);
    guestlistQueueRows = r.ok ? r.rows : [];
    if (!r.ok) {
      flash(`Guestlist queue: ${r.message}`, "error");
    }
  }

  async function reloadNightAdjQueue(): Promise<void> {
    const r = await loadPendingNightAdjustmentsForAdmin(supabase);
    nightAdjQueueRows = r.ok ? r.rows : [];
    if (!r.ok) {
      flash(`Night requests: ${r.message}`, "error");
    }
  }

  async function reloadTableSalesQueue(): Promise<void> {
    const r = await loadPendingTableSalesQueueForAdmin(supabase);
    tableSalesQueueRows = r.ok ? r.rows : [];
    if (!r.ok) {
      flash(`Table sales queue: ${r.message}`, "error");
    }
  }

  async function reloadTableSalesReport(): Promise<void> {
    const now = new Date();
    if (!tableSalesReportFrom.trim()) {
      tableSalesReportFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }
    if (!tableSalesReportTo.trim()) {
      tableSalesReportTo = now.toISOString().slice(0, 10);
    }
    const r = await loadTableSalesReportForAdmin(supabase, {
      from: tableSalesReportFrom,
      to: tableSalesReportTo,
      clubSlug: tableSalesReportClub.trim() || undefined,
    });
    tableSalesReportRows = r.ok ? r.rows : [];
    if (!r.ok) {
      flash(`Table sales report: ${r.message}`, "error");
    }
  }

  async function reloadClubAccounts(): Promise<void> {
    const r = await loadClubAccounts(supabase);
    clubAccounts = r.ok ? r.rows : [];
    if (!selectedClubAccountId || !clubAccounts.some((x) => x.id === selectedClubAccountId)) {
      selectedClubAccountId = clubAccounts[0]?.id ?? null;
    }
  }

  async function reloadClubRevisions(): Promise<void> {
    const r = await loadClubEditRevisions(supabase);
    clubEditRevisions = r.ok ? r.rows : [];
    if (!selectedClubRevisionId || !clubEditRevisions.some((x) => x.id === selectedClubRevisionId)) {
      selectedClubRevisionId = clubEditRevisions[0]?.id ?? null;
    }
  }

  async function reloadClubDisputes(): Promise<void> {
    const r = await loadJobDisputes(supabase);
    clubJobDisputes = r.ok ? r.rows : [];
    if (!selectedClubDisputeId || !clubJobDisputes.some((x) => x.id === selectedClubDisputeId)) {
      selectedClubDisputeId = clubJobDisputes[0]?.id ?? null;
    }
  }

  async function reloadAllFromDb(): Promise<void> {
    clubEntries = await loadClubEntries();
    carEntries = await loadCarEntries();
    await reloadFlyers();
    await reloadEnquiries();
    await reloadClients();
    await reloadPromoterSignupRequests();
    await reloadPromoters();
    await reloadFinancialReport();
    if (view === "jobs") await reloadJobsCalendar();
    if (view === "guestlist_queue") await reloadGuestlistQueue();
    if (view === "night_adjustments") await reloadNightAdjQueue();
    if (view === "table_sales") {
      await reloadTableSalesQueue();
      await reloadTableSalesReport();
    }
    if (view === "club_accounts") await reloadClubAccounts();
    if (view === "club_edits") await reloadClubRevisions();
    if (view === "job_disputes") await reloadClubDisputes();
    selectedClub = Math.min(selectedClub, Math.max(0, clubEntries.length - 1));
    selectedCar = Math.min(selectedCar, Math.max(0, carEntries.length - 1));
  }

  function flash(msg: string, tone: "ok" | "error" = "ok"): void {
    const el = adminRoot.querySelector("#admin-flash");
    if (el) {
      el.textContent = msg;
      el.classList.toggle("admin-flash--error", tone === "error");
      setTimeout(() => {
        if (el.textContent === msg) {
          el.textContent = "";
          el.classList.remove("admin-flash--error");
        }
      }, 4200);
    }
  }

  function flashAfterJobDelete(res: {
    clearedFinancialTx: number;
    clearedEarnings: number;
  }): void {
    const parts: string[] = [];
    if (res.clearedFinancialTx > 0) {
      parts.push(
        `${res.clearedFinancialTx} payout expense line(s) from completing this job`,
      );
    }
    if (res.clearedEarnings > 0) {
      parts.push(`${res.clearedEarnings} linked earning row(s)`);
    }
    flash(
      parts.length
        ? `Job deleted. Also removed ${parts.join(" and ")}. Guestlist rows on this job were removed.`
        : "Job deleted. Guestlist rows on this job were removed.",
    );
  }

  function renderLogin(): void {
    adminRoot.innerHTML = `
      <div class="admin-card admin-login-card">
        <h3>Admin sign in</h3>
        <p class="admin-note">Use a Supabase Auth account whose row in <code>public.profiles</code> has <code>role = 'admin'</code>.</p>
        ${
          loginError
            ? `<div class="admin-flash admin-flash--error" id="admin-login-error">${escapeAttr(loginError)}</div>`
            : ""
        }
        <form class="admin-login-form" id="admin-login-form">
          <div class="cc-field">
            <label for="admin-email">Email</label>
            <input id="admin-email" name="email" type="email" autocomplete="username" required />
          </div>
          <div class="cc-field">
            <label for="admin-password">Password</label>
            <input id="admin-password" name="password" type="password" autocomplete="current-password" required />
          </div>
          <button class="cc-btn cc-btn--gold" type="submit">Sign in</button>
        </form>
        <div class="admin-flash" id="admin-flash"></div>
      </div>`;
    loginError = "";
    adminRoot.querySelector("#admin-login-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const fd = new FormData(form);
      const email = String(fd.get("email") || "").trim();
      const password = String(fd.get("password") || "");
      void (async () => {
        const res = await signInAdmin(supabase, email, password);
        if (!res.ok) {
          loginError = res.message;
          renderLogin();
          return;
        }
        adminRoot.innerHTML = `<div class="admin-card"><p class="admin-note">Loading admin…</p></div>`;
        await loadAdminDashboard();
      })();
    });
  }

  function renderEnquiryDetail(e: EnquiryRow): string {
    const payloadPretty = JSON.stringify(e.payload, null, 2);
    const guestsHtml =
      enquiryGuests.length === 0
        ? "<p class=\"admin-hint\">No structured guest rows (or not a guestlist enquiry).</p>"
        : `<ul class="admin-guest-list">${enquiryGuests
            .map(
              (g) =>
                `<li><strong>${escapeAttr(g.guest_name)}</strong> — ${escapeAttr(g.guest_contact)}</li>`,
            )
            .join("")}</ul>`;
    const statusOpts = ENQUIRY_STATUSES.map(
      (s) =>
        `<option value="${s}" ${e.status === s ? "selected" : ""}>${escapeAttr(s)}</option>`,
    ).join("");
    return `
      <div class="admin-enquiry-detail">
        <div class="admin-toolbar" style="margin-top:0">
          <label class="admin-inline-label">Status
            <select id="enquiry-status-select" data-enquiry-id="${escapeAttr(e.id)}">${statusOpts}</select>
          </label>
          <button type="button" class="cc-btn cc-btn--gold" id="enquiry-status-save">Update status</button>
          <button type="button" class="cc-btn cc-btn--ghost" id="enquiry-create-clients" data-enquiry-id="${escapeAttr(e.id)}">Create clients from names</button>
        </div>
        <dl class="admin-enquiry-meta">
          <div><dt>Form</dt><dd>${escapeAttr(e.form_label)}</dd></div>
          <div><dt>Service</dt><dd>${escapeAttr(e.service)}</dd></div>
          <div><dt>Submitted</dt><dd>${escapeAttr(e.submitted_at || e.created_at)}</dd></div>
          <div><dt>Name</dt><dd>${escapeAttr(e.name ?? "—")}</dd></div>
          <div><dt>Email</dt><dd>${escapeAttr(e.email ?? "—")}</dd></div>
          <div><dt>Phone</dt><dd>${escapeAttr(e.phone ?? "—")}</dd></div>
        </dl>
        <h4 class="admin-subhead">Guest list (booker first, then party)</h4>
        ${guestsHtml}
        <h4 class="admin-subhead">Payload (JSON)</h4>
        <pre class="admin-json">${escapeAttr(payloadPretty)}</pre>
      </div>`;
  }

  function renderGuestlistQueueDetailHtml(): string {
    if (!guestlistQueueRows.length) {
      return `<div class="admin-form">
        <p class="admin-note full">No pending guestlist names. Promoters add guests from assigned guestlist jobs in their portal.</p>
        <div class="admin-actions"><button type="button" class="cc-btn cc-btn--ghost" data-gl-refresh>Refresh queue</button></div>
      </div>`;
    }
    const rows = guestlistQueueRows
      .map(
        (q) => `<tr data-gl-row data-entry-id="${escapeAttr(q.id)}">
      <td>${escapeAttr(q.createdAt.slice(0, 16).replace("T", " "))}</td>
      <td>${escapeAttr(q.promoterDisplayName)}</td>
      <td>${escapeAttr(q.jobDate)}</td>
      <td><code class="admin-list-code">${escapeAttr(q.clubSlug ?? "—")}</code></td>
      <td class="admin-list-col--wide"><strong>${escapeAttr(q.guestName)}</strong><br /><span class="admin-note">${escapeAttr(q.guestContact || "—")}</span></td>
      <td style="white-space:nowrap">
        <input type="text" data-gl-notes placeholder="Notes" style="max-width:9rem;margin-right:0.35rem" />
        <button type="button" class="cc-btn cc-btn--gold" data-gl-approve data-entry-id="${escapeAttr(q.id)}">Approve</button>
        <button type="button" class="cc-btn cc-btn--ghost" data-gl-reject data-entry-id="${escapeAttr(q.id)}">Reject</button>
      </td>
    </tr>`,
      )
      .join("");
    return `<div class="admin-form">
      <p class="admin-note full">Approved names update the job guest total. When the job is marked complete, payout uses approved guests only (if the promoter added any names in the system; otherwise the manual guest count on the job still applies).</p>
      <div class="admin-actions full" style="margin-bottom:0.75rem">
        <button type="button" class="cc-btn cc-btn--ghost" data-gl-refresh>Refresh queue</button>
      </div>
      <div class="promoter-table-wrap full">
        <table>
          <thead><tr><th>Submitted</th><th>Promoter</th><th>Job date</th><th>Club</th><th>Guest</th><th>Review</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }

  function renderNightAdjustmentQueueDetailHtml(): string {
    if (!nightAdjQueueRows.length) {
      return `<div class="admin-form">
        <p class="admin-note full">No pending night requests.</p>
        <div class="admin-actions"><button type="button" class="cc-btn cc-btn--ghost" data-pna-refresh>Refresh queue</button></div>
      </div>`;
    }
    const rows = nightAdjQueueRows
      .map(
        (q) => `<tr data-pna-row data-pna-id="${escapeAttr(q.id)}">
      <td>${escapeAttr(q.promoterDisplayName)}</td>
      <td>${escapeAttr(q.nightDate)}</td>
      <td>${q.availableOverride ? "Available" : "Unavailable"}</td>
      <td>${escapeAttr(q.startTime ?? "—")}</td>
      <td>${escapeAttr(q.endTime ?? "—")}</td>
      <td class="admin-list-col--wide">${escapeAttr(q.notes || "—")}</td>
      <td style="white-space:nowrap">
        <input type="text" data-pna-notes placeholder="Notes" style="max-width:9rem;margin-right:0.35rem" />
        <button type="button" class="cc-btn cc-btn--gold" data-pna-approve data-pna-id="${escapeAttr(q.id)}">Approve</button>
        <button type="button" class="cc-btn cc-btn--ghost" data-pna-reject data-pna-id="${escapeAttr(q.id)}">Reject</button>
      </td>
    </tr>`,
      )
      .join("");
    return `<div class="admin-form">
      <p class="admin-note full">Approved overrides are the record for that calendar night alongside weekly availability.</p>
      <div class="admin-actions full" style="margin-bottom:0.75rem">
        <button type="button" class="cc-btn cc-btn--ghost" data-pna-refresh>Refresh queue</button>
      </div>
      <div class="promoter-table-wrap full">
        <table>
          <thead><tr><th>Promoter</th><th>Night</th><th>Override</th><th>From</th><th>To</th><th>Notes</th><th>Review</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }

  function renderTableSalesViewHtml(): string {
    const approvedRows = tableSalesReportRows.filter((r) => r.approvalStatus === "approved");
    const sumTables = approvedRows.reduce((a, r) => a + r.tableCount, 0);
    const sumSpend = approvedRows.reduce((a, r) => a + r.totalMinSpend, 0);
    const clubFilterOpts = `<option value="">${escapeAttr("(all clubs)")}</option>${clubEntries
      .map(
        (e) =>
          `<option value="${escapeAttr(e.club.slug)}"${tableSalesReportClub === e.club.slug ? " selected" : ""}>${escapeAttr(e.club.name)}</option>`,
      )
      .join("")}`;
    const promoterOpts = promoters
      .map(
        (p) =>
          `<option value="${escapeAttr(p.id)}"${p.id === selectedPromoterId ? " selected" : ""}>${escapeAttr(p.displayName || p.userId)}</option>`,
      )
      .join("");
    const jobOpts = `<option value="">${escapeAttr("— None —")}</option>${promoterJobs
      .filter((j) => j.status === "assigned" || j.status === "completed")
      .map(
        (j) =>
          `<option value="${escapeAttr(j.id)}">${escapeAttr(`${j.jobDate} · ${j.clubSlug ?? "—"} · ${j.service}`)}</option>`,
      )
      .join("")}`;
    const tierOpts = ["standard", "luxury", "vip", "other"]
      .map((t) => `<option value="${escapeAttr(t)}">${escapeAttr(t)}</option>`)
      .join("");
    const today = new Date().toISOString().slice(0, 10);

    const queueBlock =
      tableSalesQueueRows.length === 0
        ? `<div class="admin-form">
        <p class="admin-note full">No pending table submissions.</p>
        <div class="admin-actions"><button type="button" class="cc-btn cc-btn--ghost" data-ts-refresh>Refresh queue</button></div>
      </div>`
        : `<div class="admin-form">
      <p class="admin-note full">Promoter-submitted rows stay pending until you approve or reject.</p>
      <div class="admin-actions full" style="margin-bottom:0.75rem">
        <button type="button" class="cc-btn cc-btn--ghost" data-ts-refresh>Refresh queue</button>
      </div>
      <div class="promoter-table-wrap full">
        <table>
          <thead><tr><th>Submitted</th><th>Promoter</th><th>Date</th><th>Club</th><th>Tier</th><th>Tables</th><th>Min spend</th><th>Notes</th><th>Review</th></tr></thead>
          <tbody>${tableSalesQueueRows
            .map(
              (q) => `<tr data-ts-row data-entry-id="${escapeAttr(q.id)}">
      <td>${escapeAttr(q.createdAt.slice(0, 16).replace("T", " "))}</td>
      <td>${escapeAttr(q.promoterDisplayName)}</td>
      <td>${escapeAttr(q.saleDate)}</td>
      <td><code class="admin-list-code">${escapeAttr(q.clubSlug)}</code></td>
      <td>${escapeAttr(q.tier)}</td>
      <td>${q.tableCount}</td>
      <td>${escapeAttr(`£${q.totalMinSpend.toFixed(2)}`)}</td>
      <td class="admin-list-col--wide">${escapeAttr(q.notes || "—")}</td>
      <td style="white-space:nowrap">
        <input type="text" data-ts-notes placeholder="Notes" style="max-width:9rem;margin-right:0.35rem" />
        <button type="button" class="cc-btn cc-btn--gold" data-ts-approve data-entry-id="${escapeAttr(q.id)}">Approve</button>
        <button type="button" class="cc-btn cc-btn--ghost" data-ts-reject data-entry-id="${escapeAttr(q.id)}">Reject</button>
      </td>
    </tr>`,
            )
            .join("")}</tbody>
        </table>
      </div>
    </div>`;

    const reportRows =
      tableSalesReportRows.length === 0
        ? `<tr><td colspan="10" class="admin-note">No rows in this range (or adjust filters).</td></tr>`
        : tableSalesReportRows
            .map(
              (r) =>
                `<tr>
              <td>${escapeAttr(r.saleDate)}</td>
              <td>${escapeAttr(adminDisplayTruncate(r.promoterDisplayName, 20))}</td>
              <td><code class="admin-list-code">${escapeAttr(r.clubSlug)}</code></td>
              <td>${escapeAttr(r.entryChannel)}</td>
              <td>${escapeAttr(r.tier)}</td>
              <td>${r.tableCount}</td>
              <td>${escapeAttr(`£${r.totalMinSpend.toFixed(2)}`)}</td>
              <td><span class="admin-list-badge admin-list-badge--${escapeAttr(r.approvalStatus)}">${escapeAttr(r.approvalStatus)}</span></td>
              <td class="admin-list-col--wide">${escapeAttr(adminDisplayTruncate(r.notes, 40))}</td>
              <td>${escapeAttr(r.createdAt.slice(0, 10))}</td>
            </tr>`,
            )
            .join("");

    return `${queueBlock}
      <div class="admin-form" style="margin-top:1.5rem">
        <h4 class="full">Office entry (approved immediately)</h4>
        <p class="admin-note full">Logs the admin channel for the same reporting pipeline. Changing the promoter reloads their job list for the optional link field.</p>
        <form id="admin-ts-insert-form" class="full" style="margin-top:0.5rem">
          <div class="cc-field"><label for="admin-ts-promoter">Promoter</label>
            <select name="promoterId" id="admin-ts-promoter" required>${promoterOpts || `<option value="">${escapeAttr("(no promoters)")}</option>`}</select>
          </div>
          <div class="cc-field"><label>Date</label><input name="saleDate" type="date" required value="${escapeAttr(today)}" /></div>
          <div class="cc-field"><label>Club</label>
            <select name="clubSlug" required>${clubEntries.map((e) => `<option value="${escapeAttr(e.club.slug)}">${escapeAttr(e.club.name)}</option>`).join("")}</select>
          </div>
          <div class="cc-field full"><label>Link job (optional)</label>
            <select name="promoterJobId">${jobOpts}</select>
          </div>
          <div class="cc-field"><label>Tier</label><select name="tier">${tierOpts}</select></div>
          <div class="cc-field"><label>Table count</label><input name="tableCount" type="number" min="1" max="99" value="1" required /></div>
          <div class="cc-field"><label>Total min spend (£)</label><input name="totalMinSpend" type="number" min="0" step="0.01" value="0" /></div>
          <div class="cc-field full"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
          <div class="admin-actions full">
            <button type="submit" class="cc-btn cc-btn--gold">Save office entry</button>
          </div>
        </form>
      </div>
      <div class="admin-form" style="margin-top:1.5rem">
        <h4 class="full">Report</h4>
        <p class="admin-note full">Totals below count <strong>approved</strong> rows only (both channels). Detail lists every row in range.</p>
        <p class="admin-note full">Approved in range: <strong>${sumTables}</strong> tables · <strong>${escapeAttr(`£${sumSpend.toFixed(2)}`)}</strong> reported min spend · <strong>${tableSalesQueueRows.length}</strong> pending in queue.</p>
        <form id="admin-ts-report-filters" class="full">
          <div class="cc-field"><label>From</label><input name="from" type="date" value="${escapeAttr(tableSalesReportFrom)}" /></div>
          <div class="cc-field"><label>To</label><input name="to" type="date" value="${escapeAttr(tableSalesReportTo)}" /></div>
          <div class="cc-field"><label>Club</label><select name="clubFilter">${clubFilterOpts}</select></div>
          <div class="admin-actions full">
            <button type="button" class="cc-btn cc-btn--ghost" data-ts-report-apply>Apply filters</button>
          </div>
        </form>
        <div class="promoter-table-wrap full" style="margin-top:0.75rem">
          <table>
            <thead><tr><th>Date</th><th>Promoter</th><th>Club</th><th>Channel</th><th>Tier</th><th>Tables</th><th>Min spend</th><th>Status</th><th>Notes</th><th>Logged</th></tr></thead>
            <tbody>${reportRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderJobsViewHtml(): string {
    const monthLabel = new Date(
      jobsCalendarYear,
      jobsCalendarMonth,
      1,
    ).toLocaleString("en-GB", { month: "long", year: "numeric" });
    const sortedJobs = [...jobsCalendarRows].sort((a, b) => {
      const d = a.jobDate.localeCompare(b.jobDate);
      if (d !== 0) return d;
      return a.promoterDisplayName.localeCompare(b.promoterDisplayName);
    });
    const editJob = editingJobId
      ? jobsCalendarRows.find((j) => j.id === editingJobId)
      : undefined;
    const calHtml = buildAdminJobsCalendarHtml(
      jobsCalendarYear,
      jobsCalendarMonth,
      jobsCalendarRows,
    );
    const tableRows =
      sortedJobs.length === 0
        ? `<tr><td colspan="10" class="admin-note">No jobs in this month for the current filters.</td></tr>`
        : sortedJobs
            .map((j) => {
              const completeBtn =
                j.status === "assigned"
                  ? `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-job-complete="${escapeAttr(j.id)}">Complete</button>`
                  : "";
              const editingCls = editingJobId === j.id ? " is-editing" : "";
              return `<tr class="cc-row-editing${editingCls}">
              <td>${escapeAttr(j.jobDate)}</td>
              <td>${escapeAttr(adminDisplayTruncate(j.promoterDisplayName, 22))}</td>
              <td>${escapeAttr(j.clubSlug ?? "—")}</td>
              <td>${escapeAttr(j.service)}</td>
              <td><span class="admin-list-badge admin-list-badge--${escapeAttr(j.status)}">${escapeAttr(j.status)}</span></td>
              <td>${j.guestsCount}</td>
              <td>${escapeAttr(`£${j.shiftFee.toFixed(2)}`)}</td>
              <td>${escapeAttr(`£${j.guestlistFee.toFixed(2)}`)}</td>
              <td class="admin-list-col--wide">${escapeAttr(adminDisplayTruncate(j.notes, 36))}</td>
              <td class="admin-jobs__row-actions">
                <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-open-job-edit="${escapeAttr(j.id)}">Edit</button>
                ${completeBtn}
                <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-job-delete="${escapeAttr(j.id)}">Delete</button>
              </td>
            </tr>`;
            })
            .join("");

    const clubOptsFor = (slug: string | null) =>
      `<option value="">${escapeAttr("(none)")}</option>${clubEntries
        .map(
          (c) =>
            `<option value="${escapeAttr(c.club.slug)}"${(slug ?? "") === c.club.slug ? " selected" : ""}>${escapeAttr(c.club.name)}</option>`,
        )
        .join("")}`;

    let editDialogHtml = "";
    if (editJob) {
      const readOnly = editJob.status === "completed";
      if (readOnly) {
        editDialogHtml = `<dialog class="admin-job-dialog" id="admin-job-edit-dialog">
          <div class="admin-job-dialog__inner">
            <h3 class="admin-job-dialog__title">Completed job</h3>
            <p class="admin-note">${escapeAttr(editJob.promoterDisplayName)} · ${escapeAttr(editJob.jobDate)} · ${escapeAttr(editJob.clubSlug ?? "—")}</p>
            <p class="admin-note">Recorded when marked complete. Delete only if you must undo (may fail if earnings are linked).</p>
            <input type="hidden" id="admin-job-edit-id" value="${escapeAttr(editJob.id)}" />
            <div class="admin-actions">
              <button type="button" class="cc-btn cc-btn--ghost" id="admin-job-edit-delete">Delete job</button>
              <button type="button" class="cc-btn cc-btn--gold" id="admin-job-edit-dismiss">Close</button>
            </div>
          </div>
        </dialog>`;
      } else {
        editDialogHtml = `<dialog class="admin-job-dialog" id="admin-job-edit-dialog">
          <form class="admin-job-dialog__inner" id="admin-job-edit-form">
            <h3 class="admin-job-dialog__title">Edit job</h3>
            <p class="admin-note">${escapeAttr(editJob.promoterDisplayName)}</p>
            <input type="hidden" name="jobId" value="${escapeAttr(editJob.id)}" />
            <div class="cc-field"><label>Club</label><select name="clubSlug">${clubOptsFor(editJob.clubSlug)}</select></div>
            <div class="cc-field"><label>Service</label><select name="service">${jobServiceSelectHtml(editJob.service)}</select></div>
            <div class="cc-field"><label>Date</label><input name="jobDate" type="date" value="${escapeAttr(editJob.jobDate)}" required /></div>
            <div class="cc-field"><label>Status</label>
              <select name="status">
                <option value="assigned"${editJob.status === "assigned" ? " selected" : ""}>assigned</option>
                <option value="cancelled"${editJob.status === "cancelled" ? " selected" : ""}>cancelled</option>
              </select>
            </div>
            <div class="cc-field"><label>Shift fee (£)</label><input name="shiftFee" type="number" step="0.01" value="${editJob.shiftFee}" /></div>
            <div class="cc-field"><label>Guestlist fee / guest (£)</label><input name="guestFee" type="number" step="0.01" value="${editJob.guestlistFee}" /></div>
            <div class="cc-field"><label>Guests count</label><input name="guestCount" type="number" step="1" value="${editJob.guestsCount}" /></div>
            <p class="admin-note full">If this promoter added guestlist names in the portal, <strong>approved</strong> rows set this count automatically. Manual count still applies when there are no submitted names.</p>
            <div class="cc-field full"><label>Notes</label><textarea name="notes">${escapeHtmlText(editJob.notes)}</textarea></div>
            <div class="admin-actions">
              <button type="button" class="cc-btn cc-btn--gold" id="admin-job-edit-save">Save changes</button>
              ${
                editJob.status === "assigned"
                  ? `<button type="button" class="cc-btn cc-btn--ghost" id="admin-job-edit-complete">Mark completed</button>`
                  : ""
              }
              <button type="button" class="cc-btn cc-btn--ghost" id="admin-job-edit-delete">Delete</button>
              <button type="button" class="cc-btn cc-btn--ghost" id="admin-job-edit-dismiss">Close</button>
            </div>
          </form>
        </dialog>`;
      }
    }

    return `
            <div class="admin-jobs">
              <div class="admin-jobs__top">
                ${
                  jobsCalendarOpen
                    ? `<section class="admin-jobs__calendar" aria-label="Job calendar">
                  <div class="admin-jobs__cal-toolbar">
                    <button type="button" class="cc-btn cc-btn--ghost" id="jobs-cal-prev" aria-label="Previous month">←</button>
                    <h4 class="admin-jobs__cal-title">${escapeAttr(monthLabel)}</h4>
                    <button type="button" class="cc-btn cc-btn--ghost" id="jobs-cal-next" aria-label="Next month">→</button>
                  </div>
                  ${calHtml}
                  <form class="admin-jobs__filters admin-form" id="jobs-calendar-filters">
                    <div class="cc-field"><label for="jobs-filter-promoter">Promoter</label>
                      <select id="jobs-filter-promoter" name="jobsFilterPromoter">
                        <option value="">${escapeAttr("All promoters")}</option>
                        ${promoters.map((p) => `<option value="${escapeAttr(p.id)}"${p.id === jobsFilterPromoterId ? " selected" : ""}>${escapeAttr(p.displayName || p.userId)}</option>`).join("")}
                      </select>
                    </div>
                    <div class="cc-field"><label for="jobs-filter-club">Club</label>
                      <select id="jobs-filter-club" name="jobsFilterClub">
                        <option value="">${escapeAttr("All clubs")}</option>
                        ${clubEntries.map((c) => `<option value="${escapeAttr(c.club.slug)}"${c.club.slug === jobsFilterClubSlug ? " selected" : ""}>${escapeAttr(c.club.name)}</option>`).join("")}
                      </select>
                    </div>
                    <div class="admin-actions admin-jobs__filter-actions">
                      <button type="button" class="cc-btn cc-btn--gold" id="jobs-filter-apply">Apply filters</button>
                      <button type="button" class="cc-btn cc-btn--ghost" id="jobs-filter-reset">Reset</button>
                    </div>
                  </form>
                </section>`
                    : ""
                }
                ${
                  jobsCreateOpen
                    ? `<section class="admin-jobs__create" aria-label="Create job">
                  <h4 class="admin-jobs__create-title">Create job</h4>
                  <form class="admin-form admin-jobs__create-form" id="promoter-job-form">
                    <div class="cc-field"><label>Promoter</label>
                      <select name="promoterId">
                        ${promoters.map((p) => `<option value="${escapeAttr(p.id)}"${p.id === selectedPromoterId ? " selected" : ""}>${escapeAttr(p.displayName || p.userId)}</option>`).join("")}
                      </select>
                    </div>
                    <div class="cc-field"><label>Club</label>
                      <select name="clubSlug">
                        <option value="">(none)</option>
                        ${clubEntries.map((c) => `<option value="${escapeAttr(c.club.slug)}">${escapeAttr(c.club.name)}</option>`).join("")}
                      </select>
                    </div>
                    <div class="cc-field"><label>Date</label><input name="jobDate" type="date" value="${escapeAttr(new Date().toISOString().slice(0, 10))}" required /></div>
                    <div class="cc-field"><label>Service</label>
                      <select name="service">${jobServiceSelectHtml("guestlist")}</select>
                    </div>
                    <div class="cc-field"><label>Status</label>
                      <select name="status">
                        <option value="assigned">assigned (upcoming)</option>
                        <option value="completed">completed (already happened)</option>
                      </select>
                    </div>
                    <div class="cc-field"><label>Client mode</label>
                      <select name="clientMode">
                        <option value="existing">Find client</option>
                        <option value="blank">Create blank client</option>
                        <option value="new">Create new client profile</option>
                      </select>
                    </div>
                    <div class="cc-field full" id="admin-job-find-client-block"><label>Find client</label>
                      <input name="clientSearch" type="text" placeholder="Type client name/email/phone" />
                      <select name="existingClientId" style="margin-top:0.4rem">
                        <option value="">(none)</option>
                        ${clients.map((c) => `<option value="${escapeAttr(c.id)}">${escapeAttr(c.name || c.email || c.phone || c.id.slice(0, 8))}</option>`).join("")}
                      </select>
                    </div>
                    <div class="cc-field" id="admin-job-new-client-name" hidden><label>New client name</label><input name="newClientName" placeholder="Client full name" /></div>
                    <div class="cc-field" id="admin-job-new-client-email" hidden><label>New client email</label><input name="newClientEmail" type="email" placeholder="client@example.com" /></div>
                    <div class="cc-field" id="admin-job-new-client-phone" hidden><label>New client phone</label><input name="newClientPhone" placeholder="+44…" /></div>
                    <div class="admin-actions full">
                      <button class="cc-btn cc-btn--ghost" type="button" id="admin-job-add-client">+ Add client</button>
                    </div>
                    <div class="full promoter-table-wrap">
                      <table>
                        <thead><tr><th>Type</th><th>Name</th><th>Contact</th><th>Remove</th></tr></thead>
                        <tbody id="admin-job-clients-body">${
                          createJobClients.length
                            ? createJobClients
                                .map(
                                  (c, idx) =>
                                    `<tr><td>${escapeAttr(c.mode === "existing" ? "existing" : c.mode === "blank" ? "blank" : "new profile")}</td><td>${escapeAttr(c.name || "New client")}</td><td>${escapeAttr(c.contact || "—")}</td><td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-job-remove-client="${idx}">Remove</button></td></tr>`,
                                )
                                .join("")
                            : "<tr><td colspan='4'>No clients added yet.</td></tr>"
                        }</tbody>
                      </table>
                    </div>
                    <div class="cc-field"><label>Shift fee (£)</label><input name="shiftFee" type="number" step="0.01" value="0" /></div>
                    <div class="cc-field"><label>Guestlist fee / guest (£)</label><input name="guestFee" type="number" step="0.01" value="0" /></div>
                    <div class="cc-field"><label>Guests count</label><input name="guestCount" type="number" step="1" value="0" /></div>
                    <p class="admin-note full">Promoters can submit names in their portal; <strong>approved</strong> rows replace this count for billing when the job is completed. If they never use the portal, this number still applies.</p>
                    <div class="cc-field full"><label>Notes</label><textarea name="notes" rows="3" placeholder="Optional internal notes"></textarea></div>
                    <div class="admin-actions">
                      <button class="cc-btn cc-btn--gold" type="button" id="promoter-job-create">Create job</button>
                    </div>
                  </form>
                </section>`
                    : ""
                }
              </div>
              <section class="admin-jobs__table-block" aria-label="Jobs this month">
                <h4 class="admin-jobs__table-title">Jobs this month</h4>
                <div class="promoter-table-wrap">
                  <table class="admin-table">
                    <thead><tr>
                      <th>Date</th><th>Promoter</th><th>Club</th><th>Service</th><th>Status</th><th>Guests</th><th>Shift</th><th>Per guest</th><th>Notes</th><th>Actions</th>
                    </tr></thead>
                    <tbody>${tableRows}</tbody>
                  </table>
                </div>
              </section>
              ${editDialogHtml}
            </div>`;
  }

  function renderFinancialsViewHtml(): string {
    const presetOpts = FINANCIAL_CATEGORY_PRESETS.map((x) => `<option value="${escapeAttr(x)}"></option>`).join("");
    const payeeOptionsFor = (selected: string | null | undefined) =>
      `<option value="">(none / one-off)</option>${financialPayees
        .map(
          (p) =>
            `<option value="${escapeAttr(p.id)}"${selected && selected === p.id ? " selected" : ""}>${escapeAttr(p.name)}</option>`,
        )
        .join("")}`;
    const y = financialCalendarYear;
    const m = financialCalendarMonth;
    const monthTitle = new Date(y, m, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    const first = new Date(y, m, 1);
    const firstDow = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const byDate = new Map<string, FinancialTransactionRow[]>();
    for (const tx of financialTransactions) {
      if (!byDate.has(tx.txDate)) byDate.set(tx.txDate, []);
      byDate.get(tx.txDate)!.push(tx);
    }
    const toneFor = (tx: FinancialTransactionRow): string => {
      if (tx.status === "paid") return tx.direction === "income" ? "fin-chip--income-paid" : "fin-chip--expense-paid";
      if (tx.status === "pending") return tx.direction === "income" ? "fin-chip--income-pending" : "fin-chip--expense-pending";
      return "fin-chip--other";
    };
    const headers = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const calendarCells: string[] = [];
    const calendarHead = headers
      .map((h) => `<div class="admin-jobs__cal-hd">${escapeAttr(h)}</div>`)
      .join("");
    for (let i = 0; i < firstDow; i++) {
      calendarCells.push(`<div class="admin-jobs__cal-cell admin-jobs__cal-cell--pad" aria-hidden="true"></div>`);
    }
    const today = new Date();
    const isThisMonth = today.getFullYear() === y && today.getMonth() === m;
    const todayDay = today.getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = isoLocalYmd(y, m, d);
      const rows = byDate.get(ymd) ?? [];
      const isToday = isThisMonth && d === todayDay;
      const chips = rows
        .slice(0, 4)
        .map(
          (tx) =>
            `<button type="button" class="admin-jobs__cal-pill fin-chip ${toneFor(tx)}" data-fin-edit-tx="${escapeAttr(tx.id)}" data-fin-drag-tx="${escapeAttr(tx.id)}" draggable="true" title="${escapeAttr(`${tx.category || tx.paymentTag || tx.direction} · ${tx.currency} ${tx.amount.toFixed(2)} · ${tx.status}`)}">${escapeAttr(adminDisplayTruncate(tx.category || tx.paymentTag || tx.direction, 18))}</button>`,
        )
        .join("");
      calendarCells.push(
        `<div class="admin-jobs__cal-cell${isToday ? " admin-jobs__cal-cell--today" : ""}" data-fin-drop-date="${escapeAttr(ymd)}"><div class="admin-jobs__cal-daynum">${d}</div><div class="admin-jobs__cal-pills">${chips}${rows.length > 4 ? `<span class="admin-jobs__cal-more">+${rows.length - 4}</span>` : ""}</div></div>`,
      );
    }
    const totalCells = firstDow + daysInMonth;
    const tail = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < tail; i++) {
      calendarCells.push(`<div class="admin-jobs__cal-cell admin-jobs__cal-cell--pad" aria-hidden="true"></div>`);
    }

    const txRows =
      financialTransactions.length === 0
        ? "<tr><td colspan='11' class='admin-note'>No ledger rows in the selected period.</td></tr>"
        : financialTransactions
            .map((r) => {
              const payee = r.payeeLabel || financialPayees.find((p) => p.id === r.payeeId)?.name || "—";
              return `<tr class="cc-row-editing${financialEditingTxId === r.id ? " is-editing" : ""}">
                <td><input type="checkbox" name="finTxSelect" value="${escapeAttr(r.id)}" /></td>
                <td>${escapeAttr(r.txDate)}</td>
                <td>${escapeAttr(r.category)}</td>
                <td>${escapeAttr(r.paymentTag || "—")}</td>
                <td>${escapeAttr(r.direction)}</td>
                <td>${escapeAttr(r.status)}</td>
                <td>${escapeAttr(`${r.currency} ${r.amount.toFixed(2)}`)}</td>
                <td>${escapeAttr(payee)}</td>
                <td>${escapeAttr(r.sourceType || "manual")}</td>
                <td class="admin-list-col--wide">${escapeAttr(adminDisplayTruncate(r.notes, 34))}</td>
                <td>${escapeAttr(r.createdAt.slice(0, 10))}</td>
                <td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-edit-tx="${escapeAttr(r.id)}">Edit</button></td>
              </tr>`;
            })
            .join("");

    const recurringRows =
      financialRecurringTemplates.length === 0
        ? "<tr><td colspan='11' class='admin-note'>No recurring templates yet.</td></tr>"
        : financialRecurringTemplates
            .map((t) => {
              const recurrenceLabel =
                t.recurrenceUnit === "custom_days"
                  ? `${t.intervalDays} day(s)`
                  : `${t.recurrenceEvery} ${t.recurrenceUnit}`;
              const payee = t.payeeLabel || financialPayees.find((p) => p.id === t.payeeId)?.name || "—";
              return `<tr class="cc-row-editing${financialEditingTemplateId === t.id ? " is-editing" : ""}">
                <td>${escapeAttr(t.label)}</td>
                <td>${escapeAttr(t.category)}</td>
                <td>${escapeAttr(t.paymentTag || "—")}</td>
                <td>${escapeAttr(t.direction)}</td>
                <td>${escapeAttr(t.defaultStatus)}</td>
                <td>${escapeAttr(`${t.currency} ${t.amount.toFixed(2)}`)}</td>
                <td>${escapeAttr(recurrenceLabel)}</td>
                <td>${escapeAttr(t.nextDueDate)}</td>
                <td>${escapeAttr(payee)}</td>
                <td>${t.isActive ? "yes" : "no"}</td>
                <td style="white-space:nowrap">
                  <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-template-edit data-template-id="${escapeAttr(t.id)}">Edit</button>
                  <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-template-toggle data-template-id="${escapeAttr(t.id)}" data-active="${t.isActive ? "true" : "false"}">${t.isActive ? "Deactivate" : "Activate"}</button>
                  <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-template-delete data-template-id="${escapeAttr(t.id)}">Delete</button>
                </td>
              </tr>`;
            })
            .join("");

    const payeeRows =
      financialPayees.length === 0
        ? "<tr><td colspan='5' class='admin-note'>No payees yet.</td></tr>"
        : financialPayees
            .map(
              (p) =>
                `<tr><td>${escapeAttr(p.name)}</td><td>${escapeAttr(p.defaultPaymentTag || "—")}</td><td>${escapeAttr(p.defaultCurrency)}</td><td>${p.isActive ? "yes" : "no"}</td><td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-payee-edit="${escapeAttr(p.id)}">Edit</button></td></tr>`,
            )
            .join("");

    const payeeFilterOptions = `<option value="">All payees</option>${financialPayees
      .map((p) => `<option value="${escapeAttr(p.id)}"${financialFilterPayeeId === p.id ? " selected" : ""}>${escapeAttr(p.name)}</option>`)
      .join("")}`;
    const ruleOptions = nativeFinancialRules
      .filter((r) => r.isActive)
      .map(
        (r) =>
          `<option value="${escapeAttr(r.id)}" data-male-rate="${r.maleRate}" data-female-rate="${r.femaleRate}" data-bonus-goal="${r.bonusGoal}" data-bonus-type="${escapeAttr(r.bonusType)}" data-bonus-amount="${r.bonusAmount}">${escapeAttr(`${r.department} · ${r.venueOrServiceName}`)}</option>`,
      )
      .join("");
    const promoterOptions = nativeFinancialPromoters
      .filter((p) => p.isActive)
      .map((p) => `<option value="${escapeAttr(p.id)}">${escapeAttr(p.name)}</option>`)
      .join("");
    const promoterAccountOptions = promoterAccountSeedRows
      .map(
        (p) =>
          `<option value="${escapeAttr(p.userId)}">${escapeAttr(`${p.displayName} (${p.userId.slice(0, 8)}…)`)}</option>`,
      )
      .join("");
    const clubOptions = clubEntries
      .filter((c) => c.club.slug.trim())
      .map((c) => `<option value="${escapeAttr(c.club.slug)}">${escapeAttr(c.club.name || c.club.slug)}</option>`)
      .join("");
    const pendingApprovalRows =
      financialChangeRequests.length === 0
        ? "<tr><td colspan='9' class='admin-note'>No pending approvals.</td></tr>"
        : financialChangeRequests
            .map(
              (r) =>
                `<tr><td>${escapeAttr(r.targetType)}</td><td><code>${escapeAttr(r.targetId.slice(0, 8))}…</code></td><td>${escapeAttr(r.clubName || r.clubSlug || "—")}</td><td>${escapeAttr(r.requestedByLabel || "—")}</td><td>${escapeAttr(r.createdAt.slice(0, 10))}</td><td class="admin-list-col--wide"><code>${escapeAttr(JSON.stringify(r.payload).slice(0, 90))}</code></td><td>${renderStatusBadge(r.status)}</td><td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-approval="${escapeAttr(r.id)}" data-approve="true">Approve</button> <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-approval="${escapeAttr(r.id)}" data-approve="false">Reject</button></td></tr>`,
            )
            .join("");
    const nightlifeRows = nativeFinancialBookings
      .filter((b) => b.department === "nightlife")
      .slice(0, 30)
      .map((b) => {
        const statusLabel =
          b.paymentStatus === "paid_final"
            ? "Paid & Final"
            : b.paymentStatus === "attended"
              ? "Attended"
              : "Expected";
        const nearMiss = b.nearMissBonusGoal;
        return `<tr>
          <td>${escapeAttr(b.bookingReference)}</td>
          <td>${escapeAttr(b.bookingDate)}</td>
          <td>${escapeAttr(b.promoterName || "—")}</td>
          <td>${escapeAttr(adminDisplayTruncate(b.venueOrServiceName, 24))}</td>
          <td>${b.maleGuests}</td>
          <td>${b.femaleGuests}</td>
          <td>${b.totalGuests}</td>
          <td>${escapeAttr(`£${b.totalRevenue.toFixed(2)}`)}</td>
          <td>${escapeAttr(`£${b.bonus.toFixed(2)}`)}${nearMiss ? ` <span class="pp-badge pp-badge--warning"><span class="pp-badge__dot"></span><span class="pp-badge__text">near miss</span></span>` : ""}</td>
          <td>${escapeAttr(`£${b.projectedAgencyProfit.toFixed(2)}`)}</td>
          <td>${escapeAttr(`£${b.realizedAgencyProfit.toFixed(2)}`)}</td>
          <td>${renderStatusBadge(statusLabel)}</td>
        </tr>`;
      })
      .join("");
    const serviceRows = nativeFinancialBookings
      .filter((b) => b.department === "transport" || b.department === "protection")
      .slice(0, 30)
      .map((b) => {
        const statusLabel =
          b.paymentStatus === "paid_final"
            ? "Paid & Final"
            : b.paymentStatus === "attended"
              ? "Attended"
              : "Expected";
        return `<tr>
          <td>${escapeAttr(b.bookingReference)}</td>
          <td>${escapeAttr(b.bookingDate)}</td>
          <td>${escapeAttr(b.department)}</td>
          <td>${escapeAttr(adminDisplayTruncate(b.venueOrServiceName, 28))}</td>
          <td>${escapeAttr(b.clientName || "—")}</td>
          <td>${escapeAttr(`£${b.totalSpend.toFixed(2)}`)}</td>
          <td>${escapeAttr(`£${b.projectedAgencyProfit.toFixed(2)}`)}</td>
          <td>${escapeAttr(`£${b.realizedAgencyProfit.toFixed(2)}`)}</td>
          <td>${renderStatusBadge(statusLabel)}</td>
        </tr>`;
      })
      .join("");
    const promoterLeaderboard = Object.values(
      nativeFinancialBookings.reduce<Record<string, { name: string; profit: number; guests: number; bookings: number }>>(
        (acc, row) => {
          const key = row.promoterId || row.promoterName || "unassigned";
          if (!acc[key]) {
            acc[key] = { name: row.promoterName || "Unassigned", profit: 0, guests: 0, bookings: 0 };
          }
          acc[key].profit += row.realizedAgencyProfit;
          acc[key].guests += row.totalGuests;
          acc[key].bookings += 1;
          return acc;
        },
        {},
      ),
    )
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10)
      .map(
        (r) =>
          `<tr><td>${escapeAttr(r.name)}</td><td>${escapeAttr(`£${r.profit.toFixed(2)}`)}</td><td>${r.guests}</td><td>${r.bookings}</td><td>${r.bookings ? escapeAttr(`£${(r.profit / r.bookings).toFixed(2)}`) : "£0.00"}</td></tr>`,
      )
      .join("");
    const activePortalView = new URLSearchParams(window.location.search).get("view") || "";
    const financeScope =
      activePortalView.startsWith("admin.financial_") ? activePortalView : "admin.financial_dashboard";
    if (financeScope === "admin.financial_rules") {
      const rulesRows =
        nativeFinancialRules.length === 0
          ? "<tr><td colspan='12' class='admin-note'>No financial rules yet.</td></tr>"
          : nativeFinancialRules
              .map(
                (r) =>
                  `<tr>
                    <td>${escapeAttr(r.department)}</td>
                    <td>${escapeAttr(r.clubSlug || "—")}</td>
                    <td>${escapeAttr(r.venueOrServiceName)}</td>
                    <td>${escapeAttr(r.logicType)}</td>
                    <td>${escapeAttr(r.maleRate.toFixed(2))}</td>
                    <td>${escapeAttr(r.femaleRate.toFixed(2))}</td>
                    <td>${escapeAttr(`£${r.baseRate.toFixed(2)}`)}</td>
                    <td>${escapeAttr(r.bonusType)}</td>
                    <td>${r.bonusGoal}</td>
                    <td>${escapeAttr(`£${r.bonusAmount.toFixed(2)}`)}</td>
                    <td>${renderStatusBadge(r.isActive ? "active" : "inactive")}</td>
                    <td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-edit-rule="${escapeAttr(r.id)}">Edit</button> <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-delete-rule="${escapeAttr(r.id)}">Delete</button></td>
                  </tr>`,
              )
              .join("");
      return `
        <div class="admin-form finx-card">
          <h4 class="full">Financial Rules</h4>
          <p class="admin-note full">Dedicated rules workspace. Create rules here and verify they persist immediately in the table.</p>
          <div class="admin-actions full">
            <button type="button" class="cc-btn cc-btn--gold" data-fin-open-rule-editor="open">Create new rule</button>
            <button type="button" class="cc-btn cc-btn--ghost" data-fin-refresh>Refresh period</button>
          </div>
          <div class="promoter-table-wrap full">
            <table>
              <thead><tr><th>Department</th><th>Club</th><th>Venue/Service</th><th>Logic</th><th>Male ratio</th><th>Female ratio</th><th>Base</th><th>Bonus</th><th>Goal</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>${rulesRows}</tbody>
            </table>
          </div>
        </div>
        ${
          financialRuleEditorOpen
            ? `<div class="pp-modal-host finx-modal-host"><div class="pp-modal__overlay"><div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="Create financial rule"><div class="pp-modal__header"><h4 class="pp-modal__title">Create new financial rule</h4><button type="button" class="pp-modal__close" data-fin-close-rule-editor aria-label="Close">×</button></div><div class="pp-modal__body"><form id="financial-rule-form" class="admin-form"><div class="cc-field"><label>Department</label><select name="department"><option value="nightlife">Nightlife</option><option value="transport">Transport</option><option value="protection">Protection</option><option value="other">Other</option></select></div><div class="cc-field"><label>Club link</label><select name="clubSlug"><option value="">(none)</option>${clubOptions}</select></div><div class="cc-field"><label>Venue/Service</label><input name="venueOrServiceName" /></div><div class="cc-field"><label>Logic</label><select name="logicType"><option value="headcount_pay">Headcount Pay</option><option value="commission_percent">Commission %</option><option value="flat_fee">Flat Fee</option></select></div><div class="cc-field"><label>Male rate</label><input name="maleRate" type="number" step="0.01" value="0" /></div><div class="cc-field"><label>Female rate</label><input name="femaleRate" type="number" step="0.01" value="0" /></div><div class="cc-field"><label>Base rate</label><input name="baseRate" type="number" step="0.01" value="0" /></div><div class="cc-field"><label>Bonus type</label><select name="bonusType"><option value="none">None</option><option value="flat">Flat</option><option value="stacking">Stacking</option></select></div><div class="cc-field"><label>Bonus goal</label><input name="bonusGoal" type="number" step="1" value="0" /></div><div class="cc-field"><label>Bonus amount</label><input name="bonusAmount" type="number" step="0.01" value="0" /></div><div class="cc-field"><label>Effective from</label><input name="effectiveFrom" type="date" value="${escapeAttr(new Date().toISOString().slice(0, 10))}" /></div><div class="admin-actions full"><button type="submit" class="cc-btn cc-btn--gold">Save rule</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-close-rule-editor>Cancel</button></div></form></div></div></div></div>`
            : ""
        }
        ${
          financialDeleteConfirmOpen && financialDeleteConfirmType && financialDeleteConfirmId
            ? `<div class="pp-modal-host finx-modal-host"><div class="pp-modal__overlay"><div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="Confirm delete"><div class="pp-modal__header"><h4 class="pp-modal__title">Confirm delete</h4><button type="button" class="pp-modal__close" data-fin-delete-cancel aria-label="Close">×</button></div><div class="pp-modal__body"><p class="admin-note">Are you sure you want to delete this ${escapeAttr(financialDeleteConfirmType === "rule" ? "rule" : "financial job")}? This action archives it from active views.</p><div class="admin-actions"><button type="button" class="cc-btn cc-btn--gold" data-fin-delete-confirm>Yes, delete</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-delete-cancel>Cancel</button></div></div></div></div></div>`
            : ""
        }
      `;
    }
    if (financeScope === "admin.financial_nightlife") {
      const nightlifeFiltered = nativeFinancialBookings.filter((b) => {
        if (b.department !== "nightlife") return false;
        if (financialScopePaymentStatus && b.paymentStatus !== financialScopePaymentStatus) return false;
        if (financialScopePromoterId && (b.promoterId || "") !== financialScopePromoterId) return false;
        if (financialScopeSearch) {
          const q = financialScopeSearch.toLowerCase();
          const hay = `${b.bookingReference} ${b.venueOrServiceName} ${b.promoterName || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      const nightlifeRowsScoped = nightlifeFiltered
        .slice(0, 50)
        .map((b) => {
          const statusLabel =
            b.paymentStatus === "paid_final"
              ? "Paid & Final"
              : b.paymentStatus === "attended"
                ? "Attended"
                : "Expected";
          const nearMiss = b.nearMissBonusGoal;
          return `<tr>
            <td>${escapeAttr(b.bookingReference)}</td>
            <td>${escapeAttr(b.bookingDate)}</td>
            <td>${escapeAttr(b.promoterName || "—")}</td>
            <td>${escapeAttr(adminDisplayTruncate(b.venueOrServiceName, 24))}</td>
            <td>${b.maleGuests}</td>
            <td>${b.femaleGuests}</td>
            <td>${b.totalGuests}</td>
            <td>${escapeAttr(`£${b.totalRevenue.toFixed(2)}`)}</td>
            <td>${escapeAttr(`£${b.bonus.toFixed(2)}`)}${nearMiss ? ` <span class="pp-badge pp-badge--warning"><span class="pp-badge__dot"></span><span class="pp-badge__text">near miss</span></span>` : ""}</td>
            <td>${escapeAttr(`£${b.projectedAgencyProfit.toFixed(2)}`)}</td>
            <td>${escapeAttr(`£${b.realizedAgencyProfit.toFixed(2)}`)}</td>
            <td>${renderStatusBadge(statusLabel)}</td>
            <td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-edit-booking="${escapeAttr(b.id)}">Edit</button> <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-delete-booking="${escapeAttr(b.id)}">Delete</button></td>
          </tr>`;
        })
        .join("");
      const promoterScopeOptions = `<option value="">All promoters</option>${nativeFinancialPromoters
        .map((p) => `<option value="${escapeAttr(p.id)}"${financialScopePromoterId === p.id ? " selected" : ""}>${escapeAttr(p.name)}</option>`)
        .join("")}`;
      return `
        <div class="admin-form finx-card">
          <h4 class="full">Nightlife Tracking</h4>
          <p class="admin-note full">Nightlife-only financial bookings with guest and bonus visibility.</p>
          <form id="financial-scope-form" class="full">
            <div class="cc-field"><label>Status</label><select name="scopePaymentStatus"><option value=""${financialScopePaymentStatus === "" ? " selected" : ""}>All</option><option value="expected"${financialScopePaymentStatus === "expected" ? " selected" : ""}>Expected</option><option value="attended"${financialScopePaymentStatus === "attended" ? " selected" : ""}>Attended</option><option value="paid_final"${financialScopePaymentStatus === "paid_final" ? " selected" : ""}>Paid & Final</option></select></div>
            <div class="cc-field"><label>Promoter</label><select name="scopePromoterId">${promoterScopeOptions}</select></div>
            <div class="cc-field"><label>Search</label><input name="scopeSearch" value="${escapeAttr(financialScopeSearch)}" placeholder="ref / venue / promoter" /></div>
            <div class="admin-actions full"><button type="button" class="cc-btn cc-btn--gold" data-fin-scope-apply>Apply filters</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-scope-reset>Reset</button></div>
          </form>
          <div class="admin-actions full">
            <button type="button" class="cc-btn cc-btn--gold" data-fin-open-booking-editor="open">Create new booking</button>
            <button type="button" class="cc-btn cc-btn--ghost" data-fin-refresh>Refresh period</button>
          </div>
          <div class="promoter-table-wrap full">
            <table>
              <thead><tr><th>Ref</th><th>Date</th><th>Promoter</th><th>Venue</th><th>Male</th><th>Female</th><th>Guests</th><th>Revenue</th><th>Bonus</th><th>Projected</th><th>Realized</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>${nightlifeRowsScoped || "<tr><td colspan='13' class='admin-note'>No nightlife bookings in period.</td></tr>"}</tbody>
            </table>
          </div>
        </div>
        ${
          financialBookingEditorOpen
            ? `<div class="pp-modal-host finx-modal-host"><div class="pp-modal__overlay"><div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="Create financial booking"><div class="pp-modal__header"><h4 class="pp-modal__title">Create new financial booking</h4><button type="button" class="pp-modal__close" data-fin-close-booking-editor aria-label="Close">×</button></div><div class="pp-modal__body"><form id="financial-booking-form" class="admin-form"><div class="cc-field"><label>Department</label><select name="department"><option value="nightlife">Nightlife</option><option value="transport">Transport</option><option value="protection">Protection</option><option value="other">Other</option></select></div><div class="cc-field"><label>Club</label><select name="clubSlug"><option value="">(none)</option>${clubOptions}</select></div><div class="cc-field"><label>Booking reference</label><input name="bookingReference" /></div><div class="cc-field"><label>Date</label><input name="bookingDate" type="date" value="${escapeAttr(new Date().toISOString().slice(0, 10))}" /></div><div class="cc-field"><label>Promoter</label><select name="promoterId"><option value="">(none)</option>${promoterOptions}</select></div><div class="cc-field"><label>Rule (nightlife)</label><select name="ruleId"><option value="">(none)</option>${ruleOptions}</select></div><div class="cc-field"><label>Venue/Service</label><input name="venueOrServiceName" /></div><div class="cc-field"><label>Male guests</label><input name="maleGuests" type="number" min="0" step="1" value="0" data-fin-calc /></div><div class="cc-field"><label>Female guests</label><input name="femaleGuests" type="number" min="0" step="1" value="0" data-fin-calc /></div><div class="cc-field"><label>Other costs</label><input name="otherCosts" type="number" min="0" step="0.01" value="0" data-fin-calc /></div><div class="cc-field"><label>Total spend (transport/protection)</label><input name="totalSpend" type="number" min="0" step="0.01" value="0" /></div><div class="cc-field"><label>Commission % (transport/protection)</label><input name="commissionPercentage" type="number" min="0" max="100" step="0.01" value="10" /></div><div class="cc-field"><label>Status</label><select name="paymentStatus"><option value="expected">Expected</option><option value="attended">Attended</option><option value="paid_final">Paid & Final</option></select></div><p class="admin-note full" id="fin-booking-preview">Projected rate auto-calculates from male/female and selected rule.</p><div class="admin-actions full"><button type="submit" class="cc-btn cc-btn--gold">Save booking</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-close-booking-editor>Cancel</button></div></form></div></div></div></div>`
            : ""
        }
        ${
          financialDeleteConfirmOpen && financialDeleteConfirmType && financialDeleteConfirmId
            ? `<div class="pp-modal-host finx-modal-host"><div class="pp-modal__overlay"><div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="Confirm delete"><div class="pp-modal__header"><h4 class="pp-modal__title">Confirm delete</h4><button type="button" class="pp-modal__close" data-fin-delete-cancel aria-label="Close">×</button></div><div class="pp-modal__body"><p class="admin-note">Are you sure you want to delete this ${escapeAttr(financialDeleteConfirmType === "rule" ? "rule" : "financial job")}? This action archives it from active views.</p><div class="admin-actions"><button type="button" class="cc-btn cc-btn--gold" data-fin-delete-confirm>Yes, delete</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-delete-cancel>Cancel</button></div></div></div></div></div>`
            : ""
        }
      `;
    }
    if (financeScope === "admin.financial_transport" || financeScope === "admin.financial_protection") {
      const dept = financeScope === "admin.financial_transport" ? "transport" : "protection";
      const deptRows = nativeFinancialBookings
        .filter((b) => {
          if (b.department !== dept) return false;
          if (financialScopePaymentStatus && b.paymentStatus !== financialScopePaymentStatus) return false;
          if (financialScopeSearch) {
            const q = financialScopeSearch.toLowerCase();
            const hay = `${b.bookingReference} ${b.venueOrServiceName} ${b.clientName || ""}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        })
        .slice(0, 40)
        .map((b) => {
          const statusLabel =
            b.paymentStatus === "paid_final"
              ? "Paid & Final"
              : b.paymentStatus === "attended"
                ? "Attended"
                : "Expected";
          return `<tr>
            <td>${escapeAttr(b.bookingReference)}</td>
            <td>${escapeAttr(b.bookingDate)}</td>
            <td>${escapeAttr(adminDisplayTruncate(b.venueOrServiceName, 28))}</td>
            <td>${escapeAttr(b.clientName || "—")}</td>
            <td>${escapeAttr(`£${b.totalSpend.toFixed(2)}`)}</td>
            <td>${escapeAttr(`£${b.projectedAgencyProfit.toFixed(2)}`)}</td>
            <td>${escapeAttr(`£${b.realizedAgencyProfit.toFixed(2)}`)}</td>
            <td>${renderStatusBadge(statusLabel)}</td>
            <td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-edit-booking="${escapeAttr(b.id)}">Edit</button> <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-delete-booking="${escapeAttr(b.id)}">Delete</button></td>
          </tr>`;
        })
        .join("");
      return `
        <div class="admin-form finx-card">
          <h4 class="full">${dept === "transport" ? "Transport" : "Protection"} Tracking</h4>
          <p class="admin-note full">${dept === "transport" ? "Transport" : "Protection"}-only financial rows.</p>
          <form id="financial-scope-form" class="full">
            <div class="cc-field"><label>Status</label><select name="scopePaymentStatus"><option value=""${financialScopePaymentStatus === "" ? " selected" : ""}>All</option><option value="expected"${financialScopePaymentStatus === "expected" ? " selected" : ""}>Expected</option><option value="attended"${financialScopePaymentStatus === "attended" ? " selected" : ""}>Attended</option><option value="paid_final"${financialScopePaymentStatus === "paid_final" ? " selected" : ""}>Paid & Final</option></select></div>
            <div class="cc-field"><label>Search</label><input name="scopeSearch" value="${escapeAttr(financialScopeSearch)}" placeholder="ref / service / client" /></div>
            <div class="admin-actions full"><button type="button" class="cc-btn cc-btn--gold" data-fin-scope-apply>Apply filters</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-scope-reset>Reset</button></div>
          </form>
          <div class="admin-actions full">
            <button type="button" class="cc-btn cc-btn--gold" data-fin-open-booking-editor="open">Create new booking</button>
            <button type="button" class="cc-btn cc-btn--ghost" data-fin-refresh>Refresh period</button>
          </div>
          <div class="promoter-table-wrap full">
            <table>
              <thead><tr><th>Ref</th><th>Date</th><th>Service</th><th>Client</th><th>Total spend</th><th>Projected</th><th>Realized</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>${deptRows || "<tr><td colspan='9' class='admin-note'>No rows in period.</td></tr>"}</tbody>
            </table>
          </div>
        </div>
        ${
          financialBookingEditorOpen
            ? `<div class="pp-modal-host finx-modal-host"><div class="pp-modal__overlay"><div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="Create financial booking"><div class="pp-modal__header"><h4 class="pp-modal__title">Create new financial booking</h4><button type="button" class="pp-modal__close" data-fin-close-booking-editor aria-label="Close">×</button></div><div class="pp-modal__body"><form id="financial-booking-form" class="admin-form"><div class="cc-field"><label>Department</label><select name="department"><option value="nightlife">Nightlife</option><option value="transport">Transport</option><option value="protection">Protection</option><option value="other">Other</option></select></div><div class="cc-field"><label>Club</label><select name="clubSlug"><option value="">(none)</option>${clubOptions}</select></div><div class="cc-field"><label>Booking reference</label><input name="bookingReference" /></div><div class="cc-field"><label>Date</label><input name="bookingDate" type="date" value="${escapeAttr(new Date().toISOString().slice(0, 10))}" /></div><div class="cc-field"><label>Promoter</label><select name="promoterId"><option value="">(none)</option>${promoterOptions}</select></div><div class="cc-field"><label>Rule (nightlife)</label><select name="ruleId"><option value="">(none)</option>${ruleOptions}</select></div><div class="cc-field"><label>Venue/Service</label><input name="venueOrServiceName" /></div><div class="cc-field"><label>Male guests</label><input name="maleGuests" type="number" min="0" step="1" value="0" data-fin-calc /></div><div class="cc-field"><label>Female guests</label><input name="femaleGuests" type="number" min="0" step="1" value="0" data-fin-calc /></div><div class="cc-field"><label>Other costs</label><input name="otherCosts" type="number" min="0" step="0.01" value="0" data-fin-calc /></div><div class="cc-field"><label>Total spend (transport/protection)</label><input name="totalSpend" type="number" min="0" step="0.01" value="0" /></div><div class="cc-field"><label>Commission % (transport/protection)</label><input name="commissionPercentage" type="number" min="0" max="100" step="0.01" value="10" /></div><div class="cc-field"><label>Status</label><select name="paymentStatus"><option value="expected">Expected</option><option value="attended">Attended</option><option value="paid_final">Paid & Final</option></select></div><p class="admin-note full" id="fin-booking-preview">Projected rate auto-calculates from male/female and selected rule.</p><div class="admin-actions full"><button type="submit" class="cc-btn cc-btn--gold">Save booking</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-close-booking-editor>Cancel</button></div></form></div></div></div></div>`
            : ""
        }
        ${
          financialDeleteConfirmOpen && financialDeleteConfirmType && financialDeleteConfirmId
            ? `<div class="pp-modal-host finx-modal-host"><div class="pp-modal__overlay"><div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="Confirm delete"><div class="pp-modal__header"><h4 class="pp-modal__title">Confirm delete</h4><button type="button" class="pp-modal__close" data-fin-delete-cancel aria-label="Close">×</button></div><div class="pp-modal__body"><p class="admin-note">Are you sure you want to delete this ${escapeAttr(financialDeleteConfirmType === "rule" ? "rule" : "financial job")}? This action archives it from active views.</p><div class="admin-actions"><button type="button" class="cc-btn cc-btn--gold" data-fin-delete-confirm>Yes, delete</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-delete-cancel>Cancel</button></div></div></div></div></div>`
            : ""
        }
      `;
    }
    if (financeScope === "admin.financial_promoters") {
      const promoterLeaderboardScoped = Object.values(
        nativeFinancialBookings.reduce<Record<string, { name: string; profit: number; guests: number; bookings: number }>>(
          (acc, row) => {
            if (financialScopeSearch) {
              const q = financialScopeSearch.toLowerCase();
              const name = String(row.promoterName || "").toLowerCase();
              if (!name.includes(q)) return acc;
            }
            const key = row.promoterId || row.promoterName || "unassigned";
            if (!acc[key]) {
              acc[key] = { name: row.promoterName || "Unassigned", profit: 0, guests: 0, bookings: 0 };
            }
            acc[key].profit += row.realizedAgencyProfit;
            acc[key].guests += row.totalGuests;
            acc[key].bookings += 1;
            return acc;
          },
          {},
        ),
      )
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 20)
        .map(
          (r) =>
            `<tr><td>${escapeAttr(r.name)}</td><td>${escapeAttr(`£${r.profit.toFixed(2)}`)}</td><td>${r.guests}</td><td>${r.bookings}</td><td>${r.bookings ? escapeAttr(`£${(r.profit / r.bookings).toFixed(2)}`) : "£0.00"}</td></tr>`,
        )
        .join("");
      return `
        <div class="admin-form finx-card">
          <h4 class="full">Promoter Hub</h4>
          <p class="admin-note full">Commission and performance leaderboard from paid-final realized agency profit.</p>
          <form id="financial-scope-form" class="full">
            <div class="cc-field"><label>Search promoter</label><input name="scopeSearch" value="${escapeAttr(financialScopeSearch)}" placeholder="promoter name" /></div>
            <div class="admin-actions full"><button type="button" class="cc-btn cc-btn--gold" data-fin-scope-apply>Apply filters</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-scope-reset>Reset</button></div>
          </form>
          <div class="admin-actions full">
            <button type="button" class="cc-btn cc-btn--gold" data-fin-open-promoter-editor="open">Create new promoter</button>
            <button type="button" class="cc-btn cc-btn--ghost" data-fin-refresh>Refresh period</button>
          </div>
          <div class="promoter-table-wrap full">
            <table>
              <thead><tr><th>Promoter</th><th>Paid-final profit</th><th>Guests</th><th>Bookings</th><th>Avg profit/booking</th></tr></thead>
              <tbody>${promoterLeaderboardScoped || "<tr><td colspan='5' class='admin-note'>No promoter data in period.</td></tr>"}</tbody>
            </table>
          </div>
        </div>
        ${
          financialPromoterEditorOpen
            ? `<div class="pp-modal-host finx-modal-host"><div class="pp-modal__overlay"><div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="Create financial promoter"><div class="pp-modal__header"><h4 class="pp-modal__title">Create new financial promoter</h4><button type="button" class="pp-modal__close" data-fin-close-promoter-editor aria-label="Close">×</button></div><div class="pp-modal__body"><form id="financial-promoter-form" class="admin-form"><div class="cc-field"><label>Promoter account</label><select name="userId"><option value="">(select account)</option>${promoterAccountOptions}</select></div><div class="cc-field"><label>Name</label><input name="name" /></div><div class="cc-field"><label>Commission % (admin only)</label><input name="commissionPercentage" type="number" min="0" max="100" step="0.01" value="0" /></div><div class="cc-field"><label>Contact</label><input name="contact" /></div><div class="cc-field full"><label>Notes</label><textarea name="notes" rows="2"></textarea></div><div class="admin-actions full"><button type="submit" class="cc-btn cc-btn--gold">Save promoter</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-close-promoter-editor>Cancel</button></div></form></div></div></div></div>`
            : ""
        }
      `;
    }

    return `
      <div class="admin-form">
        <h4 class="full">Period summary</h4>
        <form id="financial-period-form" class="full">
          <div class="cc-field"><label>From</label><input name="from" type="date" value="${escapeAttr(financialPeriodFrom)}" /></div>
          <div class="cc-field"><label>To</label><input name="to" type="date" value="${escapeAttr(financialPeriodTo)}" /></div>
          <div class="cc-field"><label>Direction</label><select name="direction"><option value=""${financialFilterDirection === "" ? " selected" : ""}>All</option><option value="income"${financialFilterDirection === "income" ? " selected" : ""}>income</option><option value="expense"${financialFilterDirection === "expense" ? " selected" : ""}>expense</option></select></div>
          <div class="cc-field"><label>Status</label><select name="status"><option value=""${financialFilterStatus === "" ? " selected" : ""}>All</option><option value="pending"${financialFilterStatus === "pending" ? " selected" : ""}>pending</option><option value="paid"${financialFilterStatus === "paid" ? " selected" : ""}>paid</option><option value="cancelled"${financialFilterStatus === "cancelled" ? " selected" : ""}>cancelled</option><option value="failed"${financialFilterStatus === "failed" ? " selected" : ""}>failed</option></select></div>
          <div class="cc-field"><label>Payment tag</label><input name="paymentTag" list="financial-category-presets" value="${escapeAttr(financialFilterTag)}" placeholder="promoter_payout / club_receives" /></div>
          <div class="cc-field"><label>Payee</label><select name="payeeId">${payeeFilterOptions}</select></div>
          <div class="admin-actions full">
            <button type="button" class="cc-btn cc-btn--gold" data-fin-refresh>Refresh period</button>
            <button type="button" class="cc-btn cc-btn--ghost" data-fin-export-csv>Export period CSV</button>
            <button type="button" class="cc-btn cc-btn--ghost" data-fin-view-mode="${financialViewMode === "calendar" ? "table" : "calendar"}">Switch to ${financialViewMode === "calendar" ? "table" : "calendar"} view</button>
            <button type="button" class="cc-btn cc-btn--ghost" data-fin-open-entry="one_off">New one-off</button>
            <button type="button" class="cc-btn cc-btn--ghost" data-fin-open-entry="recurring">New recurring</button>
            <button type="button" class="cc-btn cc-btn--ghost" data-fin-open-payee>Manage payees</button>
            <button type="button" class="cc-btn cc-btn--ghost" data-fin-open-rule-editor="open">Create new rule</button>
            <button type="button" class="cc-btn cc-btn--ghost" data-fin-open-promoter-editor="open">Create new promoter</button>
            <button type="button" class="cc-btn cc-btn--ghost" data-fin-open-booking-editor="open">Create new booking</button>
          </div>
        </form>
        <p class="admin-note full">View inspired by modern finance dashboards: high-level KPI first, then action queues and detailed ledgers.</p>
        <p class="admin-note full"><strong>Ledger period:</strong> Income ${escapeAttr(`£${financialSummary.income.toFixed(2)}`)} · Expense ${escapeAttr(`£${financialSummary.expense.toFixed(2)}`)} · Net ${escapeAttr(`£${financialSummary.net.toFixed(2)}`)} · ${financialSummary.txCount} transactions</p>
        <div class="finx-kpi-grid full">
          <article class="finx-kpi"><p class="finx-kpi__label">Realized agency profit</p><p class="finx-kpi__value">${escapeAttr(`£${nativeFinancialSnapshot.totalRealizedProfit.toFixed(2)}`)}</p></article>
          <article class="finx-kpi"><p class="finx-kpi__label">Outstanding projected</p><p class="finx-kpi__value">${escapeAttr(`£${nativeFinancialSnapshot.outstandingProjectedProfit.toFixed(2)}`)}</p></article>
          <article class="finx-kpi"><p class="finx-kpi__label">Nightlife guests</p><p class="finx-kpi__value">${nativeFinancialSnapshot.totalNightlifeGuests}</p></article>
          <article class="finx-kpi"><p class="finx-kpi__label">Top promoter</p><p class="finx-kpi__value finx-kpi__value--sm">${escapeAttr(nativeFinancialSnapshot.topPromoterName || "—")}</p><p class="finx-kpi__hint">${escapeAttr(`£${nativeFinancialSnapshot.topPromoterRealizedProfit.toFixed(2)} paid-final`)}</p></article>
        </div>
        <div class="finx-subkpi full">
          <span>Nightlife ${escapeAttr(`£${nativeFinancialSnapshot.nightlifeRealizedProfit.toFixed(2)}`)}</span>
          <span>Transport ${escapeAttr(`£${nativeFinancialSnapshot.transportRealizedProfit.toFixed(2)}`)}</span>
          <span>Protection ${escapeAttr(`£${nativeFinancialSnapshot.protectionRealizedProfit.toFixed(2)}`)}</span>
          <span>Other ${escapeAttr(`£${nativeFinancialSnapshot.otherRealizedProfit.toFixed(2)}`)}</span>
          <span>${nativeFinancialRules.filter((x) => x.isActive).length} active rules</span>
          <span>${nativeFinancialPromoters.length} promoter profiles</span>
          <span>${nativeFinancialBookings.length} financial bookings</span>
        </div>
        <p class="admin-note full fin-legend">
          <span class="fin-legend__item"><span class="admin-jobs__cal-pill fin-chip fin-chip--income-paid">income paid</span></span>
          <span class="fin-legend__item"><span class="admin-jobs__cal-pill fin-chip fin-chip--income-pending">income pending</span></span>
          <span class="fin-legend__item"><span class="admin-jobs__cal-pill fin-chip fin-chip--expense-paid">expense paid</span></span>
          <span class="fin-legend__item"><span class="admin-jobs__cal-pill fin-chip fin-chip--expense-pending">expense pending</span></span>
          <span class="fin-legend__item"><span class="admin-jobs__cal-pill fin-chip fin-chip--other">cancelled / failed</span></span>
        </p>
      </div>
      ${
        financialRuleEditorOpen
          ? `<div class="pp-modal-host finx-modal-host"><div class="pp-modal__overlay"><div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="Create financial rule"><div class="pp-modal__header"><h4 class="pp-modal__title">Create new financial rule</h4><button type="button" class="pp-modal__close" data-fin-close-rule-editor aria-label="Close">×</button></div><div class="pp-modal__body"><form id="financial-rule-form" class="admin-form"><div class="cc-field"><label>Department</label><select name="department"><option value="nightlife">Nightlife</option><option value="transport">Transport</option><option value="protection">Protection</option><option value="other">Other</option></select></div><div class="cc-field"><label>Club link</label><select name="clubSlug"><option value="">(none)</option>${clubOptions}</select></div><div class="cc-field"><label>Venue/Service</label><input name="venueOrServiceName" /></div><div class="cc-field"><label>Logic</label><select name="logicType"><option value="headcount_pay">Headcount Pay</option><option value="commission_percent">Commission %</option><option value="flat_fee">Flat Fee</option></select></div><div class="cc-field"><label>Male rate</label><input name="maleRate" type="number" step="0.01" value="0" /></div><div class="cc-field"><label>Female rate</label><input name="femaleRate" type="number" step="0.01" value="0" /></div><div class="cc-field"><label>Base rate</label><input name="baseRate" type="number" step="0.01" value="0" /></div><div class="cc-field"><label>Bonus type</label><select name="bonusType"><option value="none">None</option><option value="flat">Flat</option><option value="stacking">Stacking</option></select></div><div class="cc-field"><label>Bonus goal</label><input name="bonusGoal" type="number" step="1" value="0" /></div><div class="cc-field"><label>Bonus amount</label><input name="bonusAmount" type="number" step="0.01" value="0" /></div><div class="cc-field"><label>Effective from</label><input name="effectiveFrom" type="date" value="${escapeAttr(new Date().toISOString().slice(0, 10))}" /></div><div class="admin-actions full"><button type="submit" class="cc-btn cc-btn--gold">Save rule</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-close-rule-editor>Cancel</button></div></form></div></div></div></div>`
          : ""
      }
      ${
        financialPromoterEditorOpen
          ? `<div class="pp-modal-host finx-modal-host"><div class="pp-modal__overlay"><div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="Create financial promoter"><div class="pp-modal__header"><h4 class="pp-modal__title">Create new financial promoter</h4><button type="button" class="pp-modal__close" data-fin-close-promoter-editor aria-label="Close">×</button></div><div class="pp-modal__body"><form id="financial-promoter-form" class="admin-form"><div class="cc-field"><label>Promoter account</label><select name="userId"><option value="">(select account)</option>${promoterAccountOptions}</select></div><div class="cc-field"><label>Name</label><input name="name" /></div><div class="cc-field"><label>Commission % (admin only)</label><input name="commissionPercentage" type="number" min="0" max="100" step="0.01" value="0" /></div><div class="cc-field"><label>Contact</label><input name="contact" /></div><div class="cc-field full"><label>Notes</label><textarea name="notes" rows="2"></textarea></div><div class="admin-actions full"><button type="submit" class="cc-btn cc-btn--gold">Save promoter</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-close-promoter-editor>Cancel</button></div></form></div></div></div></div>`
          : ""
      }
      ${
        financialBookingEditorOpen
          ? `<div class="pp-modal-host finx-modal-host"><div class="pp-modal__overlay"><div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="Create financial booking"><div class="pp-modal__header"><h4 class="pp-modal__title">Create new financial booking</h4><button type="button" class="pp-modal__close" data-fin-close-booking-editor aria-label="Close">×</button></div><div class="pp-modal__body"><form id="financial-booking-form" class="admin-form"><div class="cc-field"><label>Department</label><select name="department"><option value="nightlife">Nightlife</option><option value="transport">Transport</option><option value="protection">Protection</option><option value="other">Other</option></select></div><div class="cc-field"><label>Club</label><select name="clubSlug"><option value="">(none)</option>${clubOptions}</select></div><div class="cc-field"><label>Booking reference</label><input name="bookingReference" /></div><div class="cc-field"><label>Date</label><input name="bookingDate" type="date" value="${escapeAttr(new Date().toISOString().slice(0, 10))}" /></div><div class="cc-field"><label>Promoter</label><select name="promoterId"><option value="">(none)</option>${promoterOptions}</select></div><div class="cc-field"><label>Rule (nightlife)</label><select name="ruleId"><option value="">(none)</option>${ruleOptions}</select></div><div class="cc-field"><label>Venue/Service</label><input name="venueOrServiceName" /></div><div class="cc-field"><label>Male guests</label><input name="maleGuests" type="number" min="0" step="1" value="0" data-fin-calc /></div><div class="cc-field"><label>Female guests</label><input name="femaleGuests" type="number" min="0" step="1" value="0" data-fin-calc /></div><div class="cc-field"><label>Other costs</label><input name="otherCosts" type="number" min="0" step="0.01" value="0" data-fin-calc /></div><div class="cc-field"><label>Total spend (transport/protection)</label><input name="totalSpend" type="number" min="0" step="0.01" value="0" /></div><div class="cc-field"><label>Commission % (transport/protection)</label><input name="commissionPercentage" type="number" min="0" max="100" step="0.01" value="10" /></div><div class="cc-field"><label>Status</label><select name="paymentStatus"><option value="expected">Expected</option><option value="attended">Attended</option><option value="paid_final">Paid & Final</option></select></div><p class="admin-note full" id="fin-booking-preview">Projected rate auto-calculates from male/female and selected rule.</p><div class="admin-actions full"><button type="submit" class="cc-btn cc-btn--gold">Save booking</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-close-booking-editor>Cancel</button></div></form></div></div></div></div>`
          : ""
      }
      ${
        financialDeleteConfirmOpen && financialDeleteConfirmType && financialDeleteConfirmId
          ? `<div class="pp-modal-host finx-modal-host"><div class="pp-modal__overlay"><div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="Confirm delete"><div class="pp-modal__header"><h4 class="pp-modal__title">Confirm delete</h4><button type="button" class="pp-modal__close" data-fin-delete-cancel aria-label="Close">×</button></div><div class="pp-modal__body"><p class="admin-note">Are you sure you want to delete this ${escapeAttr(financialDeleteConfirmType === "rule" ? "rule" : "financial job")}? This action archives it from active views.</p><div class="admin-actions"><button type="button" class="cc-btn cc-btn--gold" data-fin-delete-confirm>Yes, delete</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-delete-cancel>Cancel</button></div></div></div></div></div>`
          : ""
      }
      <div class="admin-form finx-card" style="margin-top:1rem">
        <h4 class="full">Pending approvals</h4>
        <div class="promoter-table-wrap full"><table><thead><tr><th>Type</th><th>Target</th><th>Club</th><th>Requested by</th><th>Requested</th><th>Payload preview</th><th>Status</th><th>Actions</th></tr></thead><tbody>${pendingApprovalRows}</tbody></table></div>
      </div>
      ${
        financialViewMode === "calendar"
          ? `<div class="admin-form fin-cal finx-card" style="margin-top:1rem"><div class="admin-jobs__cal-toolbar full"><h4 class="admin-jobs__cal-title">Calendar · ${escapeAttr(monthTitle)}</h4><div class="admin-actions"><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-cal-nav="prev-year">-1y</button><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-cal-nav="prev-month">Prev</button><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-cal-nav="today">Today</button><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-cal-nav="next-month">Next</button><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-fin-cal-nav="next-year">+1y</button></div></div><p class="admin-note full">Drag a transaction chip to a different day to reschedule.</p><div class="admin-jobs__cal-grid fin-cal-grid">${calendarHead}${calendarCells.join("")}</div></div>`
          : `<div class="admin-form finx-card" style="margin-top:1rem"><h4 class="full">Ledger table</h4><div class="admin-actions full" style="margin-bottom:0.65rem"><label class="admin-note" style="display:flex;align-items:center;gap:0.35rem"><input type="checkbox" id="fin-select-all-tx" /> Select all</label><select id="fin-bulk-status"><option value="pending"${financialBulkStatus === "pending" ? " selected" : ""}>pending</option><option value="paid"${financialBulkStatus === "paid" ? " selected" : ""}>paid</option><option value="cancelled"${financialBulkStatus === "cancelled" ? " selected" : ""}>cancelled</option><option value="failed"${financialBulkStatus === "failed" ? " selected" : ""}>failed</option></select><button type="button" class="cc-btn cc-btn--ghost" data-fin-bulk-apply>Apply status to selected</button></div><div class="promoter-table-wrap full"><table><thead><tr><th></th><th>Date</th><th>Category</th><th>Tag</th><th>Dir</th><th>Status</th><th>Amount</th><th>Payee</th><th>Source</th><th>Notes</th><th>Logged</th><th>Action</th></tr></thead><tbody>${txRows}</tbody></table></div></div>`
      }
      <div class="admin-form finx-card" style="margin-top:1rem">
        <h4 class="full">Recurring templates</h4>
        <div class="admin-actions full" style="margin-bottom:0.75rem"><button type="button" class="cc-btn cc-btn--gold" data-fin-apply-recurring>Apply recurring through period end</button></div>
        <div class="promoter-table-wrap full"><table><thead><tr><th>Label</th><th>Category</th><th>Tag</th><th>Dir</th><th>Status</th><th>Amount</th><th>Recurrence</th><th>Next due</th><th>Payee</th><th>Active</th><th>Actions</th></tr></thead><tbody>${recurringRows}</tbody></table></div>
      </div>
      <div class="admin-form finx-card" style="margin-top:1rem">
        <h4 class="full">Payees</h4>
        <div class="promoter-table-wrap full"><table><thead><tr><th>Name</th><th>Default tag</th><th>Default currency</th><th>Active</th><th>Action</th></tr></thead><tbody>${payeeRows}</tbody></table></div>
      </div>
      <div class="admin-form finx-card" style="margin-top:1rem">
        <h4 class="full">Bookings requiring action</h4>
        <div class="promoter-table-wrap full">
          <table>
            <thead><tr><th>Ref</th><th>Date</th><th>Dept</th><th>Venue/Service</th><th>Status</th><th>Projected</th><th>Realized</th></tr></thead>
            <tbody>${
              nativeFinancialBookings
                .filter((b) => b.paymentStatus !== "paid_final")
                .slice(0, 12)
                .map(
                  (b) =>
                    `<tr><td>${escapeAttr(b.bookingReference)}</td><td>${escapeAttr(b.bookingDate)}</td><td>${escapeAttr(b.department)}</td><td>${escapeAttr(adminDisplayTruncate(b.venueOrServiceName, 30))}</td><td>${renderStatusBadge(b.paymentStatus === "expected" ? "Expected" : "Attended")}</td><td>${escapeAttr(`£${b.projectedAgencyProfit.toFixed(2)}`)}</td><td>${escapeAttr(`£${b.realizedAgencyProfit.toFixed(2)}`)}</td></tr>`,
                )
                .join("") || "<tr><td colspan='7' class='admin-note'>No outstanding bookings in this period.</td></tr>"
            }</tbody>
          </table>
        </div>
      </div>
      <div class="admin-form finx-card" style="margin-top:1rem">
        <h4 class="full">Nightlife financial tracking</h4>
        <div class="promoter-table-wrap full"><table><thead><tr><th>Ref</th><th>Date</th><th>Promoter</th><th>Venue</th><th>Male</th><th>Female</th><th>Guests</th><th>Revenue</th><th>Bonus</th><th>Projected</th><th>Realized</th><th>Status</th></tr></thead><tbody>${nightlifeRows || "<tr><td colspan='12' class='admin-note'>No nightlife bookings in period.</td></tr>"}</tbody></table></div>
      </div>
      <div class="admin-form finx-card" style="margin-top:1rem">
        <h4 class="full">Transport & Protection tracking</h4>
        <div class="promoter-table-wrap full"><table><thead><tr><th>Ref</th><th>Date</th><th>Dept</th><th>Service</th><th>Client</th><th>Total spend</th><th>Projected</th><th>Realized</th><th>Status</th></tr></thead><tbody>${serviceRows || "<tr><td colspan='9' class='admin-note'>No transport/protection bookings in period.</td></tr>"}</tbody></table></div>
      </div>
      <div class="admin-form finx-card" style="margin-top:1rem">
        <h4 class="full">Promoter & commission hub</h4>
        <p class="admin-note full">Leaderboard ranked by paid-final realized profit in the selected date range.</p>
        <div class="promoter-table-wrap full"><table><thead><tr><th>Promoter</th><th>Paid-final profit</th><th>Total guests</th><th>Bookings</th><th>Avg profit/booking</th></tr></thead><tbody>${promoterLeaderboard || "<tr><td colspan='5' class='admin-note'>No promoter financial activity in period.</td></tr>"}</tbody></table></div>
      </div>
      ${
        financialEntryOpen
          ? (() => {
              const tx = financialEditingTxId
                ? financialTransactions.find((x) => x.id === financialEditingTxId) ?? null
                : null;
              const tpl = financialEditingTemplateId
                ? financialRecurringTemplates.find((x) => x.id === financialEditingTemplateId) ?? null
                : null;
              const editingMode = tx ? "one_off" : tpl ? "recurring" : financialEntryMode;
              const recurringEvery = tpl?.recurrenceEvery ?? 1;
              const recurringUnit = tpl?.recurrenceUnit ?? "monthly";
              return `<div class="pp-modal-host finx-modal-host">
                <div class="pp-modal__overlay">
                  <div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="Financial entry editor">
                    <div class="pp-modal__header">
                      <h4 class="pp-modal__title">${tx || tpl ? "Edit" : "Create"} ${editingMode === "one_off" ? "ledger entry" : "recurring template"}</h4>
                      <button type="button" class="pp-modal__close" data-fin-close-entry aria-label="Close">×</button>
                    </div>
                    <div class="pp-modal__body">
                <form id="financial-entry-form" class="admin-form">
                  <input type="hidden" name="entryType" value="${editingMode}" />
                  <input type="hidden" name="txId" value="${escapeAttr(tx?.id ?? "")}" />
                  <input type="hidden" name="templateId" value="${escapeAttr(tpl?.id ?? "")}" />
                  <div class="cc-field"><label>Date</label><input name="txDate" type="date" value="${escapeAttr(tx?.txDate ?? tpl?.nextDueDate ?? new Date().toISOString().slice(0, 10))}" /></div>
                  <div class="cc-field"><label>Category</label><input name="category" list="financial-category-presets" value="${escapeAttr(tx?.category ?? tpl?.category ?? "")}" /></div>
                  <div class="cc-field"><label>Payment tag</label><input name="paymentTag" list="financial-category-presets" value="${escapeAttr(tx?.paymentTag ?? tpl?.paymentTag ?? "")}" /></div>
                  <div class="cc-field"><label>Direction</label><select name="direction"><option value="income"${(tx?.direction ?? tpl?.direction ?? "expense") === "income" ? " selected" : ""}>income</option><option value="expense"${(tx?.direction ?? tpl?.direction ?? "expense") === "expense" ? " selected" : ""}>expense</option></select></div>
                  <div class="cc-field"><label>Status</label><select name="status"><option value="pending"${(tx?.status ?? tpl?.defaultStatus ?? "pending") === "pending" ? " selected" : ""}>pending</option><option value="paid"${(tx?.status ?? tpl?.defaultStatus ?? "pending") === "paid" ? " selected" : ""}>paid</option><option value="cancelled"${(tx?.status ?? tpl?.defaultStatus ?? "pending") === "cancelled" ? " selected" : ""}>cancelled</option><option value="failed"${(tx?.status ?? tpl?.defaultStatus ?? "pending") === "failed" ? " selected" : ""}>failed</option></select></div>
                  <div class="cc-field"><label>Amount</label><input name="amount" type="number" min="0" step="0.01" value="${escapeAttr(String(tx?.amount ?? tpl?.amount ?? 0))}" /></div>
                  <div class="cc-field"><label>Currency</label><input name="currency" value="${escapeAttr(tx?.currency ?? tpl?.currency ?? "GBP")}" maxlength="8" /></div>
                  <div class="cc-field"><label>Currency mode</label><select name="convertForeign"><option value="false"${!(tx?.convertForeign ?? tpl?.convertForeign ?? false) ? " selected" : ""}>store foreign only</option><option value="true"${tx?.convertForeign ?? tpl?.convertForeign ? " selected" : ""}>convert (mark intent)</option></select></div>
                  <div class="cc-field"><label>Payee</label><select name="payeeId">${payeeOptionsFor(tx?.payeeId ?? tpl?.payeeId)}</select></div>
                  <div class="cc-field"><label>One-off payee</label><input name="payeeLabel" value="${escapeAttr(tx?.payeeLabel ?? tpl?.payeeLabel ?? "")}" placeholder="Only if payee not listed" /></div>
                  ${editingMode === "recurring" ? `<div class="cc-field"><label>Recurrence</label><select name="recurrenceUnit"><option value="monthly"${recurringUnit === "monthly" ? " selected" : ""}>monthly</option><option value="quarterly"${recurringUnit === "quarterly" ? " selected" : ""}>quarterly</option><option value="annual"${recurringUnit === "annual" ? " selected" : ""}>annual</option><option value="custom_days"${recurringUnit === "custom_days" ? " selected" : ""}>custom_days</option></select></div><div class="cc-field"><label>Every</label><input name="recurrenceEvery" type="number" min="1" max="24" value="${escapeAttr(String(recurringEvery))}" /></div><div class="cc-field"><label>Custom days</label><input name="intervalDays" type="number" min="1" value="${escapeAttr(String(tpl?.intervalDays ?? 30))}" /></div><div class="cc-field"><label>Active</label><select name="isActive"><option value="true"${tpl?.isActive !== false ? " selected" : ""}>yes</option><option value="false"${tpl?.isActive === false ? " selected" : ""}>no</option></select></div>` : ""}
                  <div class="cc-field full"><label>Notes</label><textarea name="notes" rows="2">${escapeAttr(tx?.notes ?? tpl?.notes ?? "")}</textarea></div>
                  <div class="admin-actions full"><button type="submit" class="cc-btn cc-btn--gold">${tx || tpl ? "Save changes" : "Create"}</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-close-entry>Close</button></div>
                </form>
                    </div>
                  </div>
                </div>
              </div>`;
            })()
          : ""
      }
      ${
        financialPayeeOpen
          ? (() => {
              const p = financialEditingPayeeId
                ? financialPayees.find((x) => x.id === financialEditingPayeeId) ?? null
                : null;
              return `<div class="admin-form" style="margin-top:1rem">
                <h4 class="full">${p ? "Edit payee" : "Create payee"}</h4>
                <form id="financial-payee-form" class="full">
                  <input type="hidden" name="payeeId" value="${escapeAttr(p?.id ?? "")}" />
                  <div class="cc-field"><label>Name</label><input name="name" value="${escapeAttr(p?.name ?? "")}" /></div>
                  <div class="cc-field"><label>Default tag</label><input name="defaultPaymentTag" list="financial-category-presets" value="${escapeAttr(p?.defaultPaymentTag ?? "")}" /></div>
                  <div class="cc-field"><label>Default currency</label><input name="defaultCurrency" value="${escapeAttr(p?.defaultCurrency ?? "GBP")}" maxlength="8" /></div>
                  <div class="cc-field"><label>Payment method</label><input name="paymentMethod" value="${escapeAttr(p?.paymentDetails.method ?? "")}" /></div>
                  <div class="cc-field"><label>Beneficiary</label><input name="beneficiaryName" value="${escapeAttr(p?.paymentDetails.beneficiaryName ?? "")}" /></div>
                  <div class="cc-field"><label>Account no</label><input name="accountNumber" value="${escapeAttr(p?.paymentDetails.accountNumber ?? "")}" /></div>
                  <div class="cc-field"><label>Sort code</label><input name="sortCode" value="${escapeAttr(p?.paymentDetails.sortCode ?? "")}" /></div>
                  <div class="cc-field"><label>IBAN</label><input name="iban" value="${escapeAttr(p?.paymentDetails.iban ?? "")}" /></div>
                  <div class="cc-field"><label>SWIFT/BIC</label><input name="swiftBic" value="${escapeAttr(p?.paymentDetails.swiftBic ?? "")}" /></div>
                  <div class="cc-field"><label>Payment ref</label><input name="paymentReference" value="${escapeAttr(p?.paymentDetails.reference ?? "")}" /></div>
                  <div class="cc-field"><label>Payout email</label><input name="payoutEmail" value="${escapeAttr(p?.paymentDetails.payoutEmail ?? "")}" /></div>
                  <div class="cc-field"><label>Tax registered name</label><input name="taxRegisteredName" value="${escapeAttr(p?.taxDetails.registeredName ?? "")}" /></div>
                  <div class="cc-field"><label>Tax ID</label><input name="taxId" value="${escapeAttr(p?.taxDetails.taxId ?? "")}" /></div>
                  <div class="cc-field"><label>VAT no.</label><input name="vatNumber" value="${escapeAttr(p?.taxDetails.vatNumber ?? "")}" /></div>
                  <div class="cc-field"><label>Tax country</label><input name="taxCountryCode" value="${escapeAttr(p?.taxDetails.countryCode ?? "")}" maxlength="8" /></div>
                  <div class="cc-field"><label>VAT registered</label><select name="isVatRegistered"><option value="true"${p?.taxDetails.isVatRegistered ? " selected" : ""}>yes</option><option value="false"${!p?.taxDetails.isVatRegistered ? " selected" : ""}>no</option></select></div>
                  <div class="cc-field full"><label>Tax notes</label><textarea name="taxNotes" rows="2">${escapeAttr(p?.taxDetails.notes ?? "")}</textarea></div>
                  <div class="cc-field"><label>Active</label><select name="isActive"><option value="true"${p?.isActive !== false ? " selected" : ""}>yes</option><option value="false"${p?.isActive === false ? " selected" : ""}>no</option></select></div>
                  <div class="cc-field full"><label>Notes</label><textarea name="notes" rows="2">${escapeAttr(p?.notes ?? "")}</textarea></div>
                  <div class="admin-actions full"><button type="submit" class="cc-btn cc-btn--gold">${p ? "Update payee" : "Create payee"}</button><button type="button" class="cc-btn cc-btn--ghost" data-fin-close-payee>Close</button></div>
                </form>
              </div>`;
            })()
          : ""
      }
      <datalist id="financial-category-presets">${presetOpts}</datalist>`;
  }

  function listSupportsCalendar(v: AdminView): boolean {
    return (
      v === "enquiries" ||
      v === "promoter_requests" ||
      v === "club_edits" ||
      v === "job_disputes" ||
      v === "flyers"
    );
  }

  function listSupportsGrid(v: AdminView): boolean {
    return (
      v === "enquiries" ||
      v === "clients" ||
      v === "promoter_requests" ||
      v === "promoters" ||
      v === "club_accounts" ||
      v === "club_edits" ||
      v === "job_disputes" ||
      v === "flyers" ||
      v === "clubs" ||
      v === "cars"
    );
  }

  function renderDashboard(): void {
    if (listViewMode === "calendar" && !listSupportsCalendar(view)) listViewMode = "table";
    if (listViewMode === "grid" && !listSupportsGrid(view)) listViewMode = "table";
    const club = clubEntries[selectedClub]?.club ?? cloneClub();
    const car = carEntries[selectedCar]?.car ?? cloneCar();
    const flyer = flyers[selectedFlyer] ?? cloneFlyer();
    const enquiry = selectedEnquiry
      ? enquiries.find((x) => x.id === selectedEnquiry)
      : enquiries[0];
    if (!selectedEnquiry && enquiry) selectedEnquiry = enquiry.id;

    if (view === "clients") {
      if (!clients.length) selectedClientId = null;
      else if (
        !selectedClientId ||
        !clients.some((c) => c.id === selectedClientId)
      ) {
        selectedClientId = clients[0].id;
      }
    }
    const clientRow =
      view === "clients" && selectedClientId
        ? clients.find((c) => c.id === selectedClientId)
        : undefined;

    const vt = club.venueType;
    const gs = car.gridSize;
    const vh = ADMIN_VIEW_HEADINGS[view];
    const adminNavSection = (
      section: AdminNavSection,
      label: string,
      body: string,
    ): string => {
      const open = adminNavExpanded === section;
      return `<div class="admin-nav-block ${open ? "is-open" : ""}">
        <button type="button" class="admin-nav-heading admin-nav-heading--toggle" data-admin-nav-toggle="${section}" aria-expanded="${open ? "true" : "false"}">${escapeAttr(label)}</button>
        <div class="admin-nav-items"${open ? "" : " hidden"}>
          ${body}
        </div>
      </div>`;
    };

    adminRoot.innerHTML = `
      <div class="admin-shell">
        <aside class="admin-sidebar" aria-label="Admin sections">
          <div class="admin-sidebar__brand">
            <p class="admin-sidebar__eyebrow">Cooper Concierge</p>
            <p class="admin-sidebar__title">Admin</p>
          </div>
          <nav class="admin-sidebar__nav">
            ${adminNavSection("account", "Account", `<button type="button" class="admin-view-tab ${view === "admin_profile" ? "is-active" : ""}" data-view="admin_profile">Profile settings</button>`)}
            ${adminNavSection("enquiries", "Enquiries", `<button type="button" class="admin-view-tab ${view === "enquiries" ? "is-active" : ""}" data-view="enquiries">Enquiries</button><button type="button" class="admin-view-tab ${view === "clients" ? "is-active" : ""}" data-view="clients">Clients</button>`)}
            ${adminNavSection("promoters", "Promoters", `<button type="button" class="admin-view-tab ${view === "promoter_requests" ? "is-active" : ""}" data-view="promoter_requests">Requests</button><button type="button" class="admin-view-tab ${view === "promoters" ? "is-active" : ""}" data-view="promoters">Profiles</button><button type="button" class="admin-view-tab ${view === "jobs" ? "is-active" : ""}" data-view="jobs">Jobs</button><button type="button" class="admin-view-tab ${view === "guestlist_queue" ? "is-active" : ""}" data-view="guestlist_queue">Guestlist</button><button type="button" class="admin-view-tab ${view === "night_adjustments" ? "is-active" : ""}" data-view="night_adjustments">Nights</button><button type="button" class="admin-view-tab ${view === "table_sales" ? "is-active" : ""}" data-view="table_sales">Tables</button><button type="button" class="admin-view-tab ${view === "invoices" ? "is-active" : ""}" data-view="invoices">Invoices</button><button type="button" class="admin-view-tab ${view === "financials" ? "is-active" : ""}" data-view="financials">Financials</button>`)}
            ${adminNavSection("clubs", "Club accounts", `<button type="button" class="admin-view-tab ${view === "club_accounts" ? "is-active" : ""}" data-view="club_accounts">Accounts</button><button type="button" class="admin-view-tab ${view === "club_edits" ? "is-active" : ""}" data-view="club_edits">Edit queue</button><button type="button" class="admin-view-tab ${view === "job_disputes" ? "is-active" : ""}" data-view="job_disputes">Disputes</button>`)}
            ${adminNavSection("website", "Website", `<button type="button" class="admin-view-tab ${view === "clubs" ? "is-active" : ""}" data-view="clubs">Clubs</button><button type="button" class="admin-view-tab ${view === "cars" ? "is-active" : ""}" data-view="cars">Cars</button><button type="button" class="admin-view-tab ${view === "flyers" ? "is-active" : ""}" data-view="flyers">Flyers</button>`)}
          </nav>
          <div class="admin-sidebar__footer">
            <a class="admin-sidebar__link" href="/workspace">Open workspace</a>
            <button type="button" class="admin-sidebar__btn" id="admin-logout">Sign out</button>
            <button type="button" class="admin-sidebar__btn" id="admin-reload-db">Reload from database</button>
          </div>
        </aside>
        <div class="admin-main">
          <header class="admin-main__header">
            <div class="admin-main__intro">
              <h2 class="admin-main__title">${escapeAttr(vh.title)}</h2>
              <p class="admin-main__subtitle">${escapeAttr(vh.subtitle)}</p>
            </div>
            <div class="admin-main__actions">
              <div class="admin-toolbar admin-toolbar--main">
                <button class="cc-btn cc-btn--ghost" id="admin-export-json" type="button">Export JSON</button>
                <button class="cc-btn cc-btn--ghost" id="admin-export-clubs-csv" type="button">Export clubs.csv</button>
                ${
                  view === "clubs"
                    ? `<button class="cc-btn cc-btn--gold" id="admin-save-club" type="button">Save club to DB</button>
                 <button class="cc-btn cc-btn--ghost" id="admin-save-all-clubs" type="button">Save all clubs</button>`
                    : ""
                }
                ${
                  view === "cars"
                    ? `<button class="cc-btn cc-btn--gold" id="admin-save-car" type="button">Save car to DB</button>
                 <button class="cc-btn cc-btn--ghost" id="admin-save-all-cars" type="button">Save all cars</button>`
                    : ""
                }
              </div>
              <div class="admin-account">
                <button type="button" class="admin-account__btn" id="admin-account-btn" aria-haspopup="menu" aria-expanded="false">Account</button>
                <div class="admin-account__menu" id="admin-account-menu" role="menu" hidden>
                  <button type="button" class="admin-account__item" role="menuitem" data-admin-menu-view="admin_profile">Open Profile Settings</button>
                  <button type="button" class="admin-account__item" role="menuitem" data-admin-menu-view="promoters">Open Promoters</button>
                  <button type="button" class="admin-account__item" role="menuitem" data-admin-menu-view="clients">Open Clients</button>
                  <button type="button" class="admin-account__item" role="menuitem" data-admin-menu-view="jobs">Open Jobs</button>
                  <button type="button" class="admin-account__item" role="menuitem" data-admin-menu-view="financials">Open Financials</button>
                  <button type="button" class="admin-account__item" role="menuitem" data-admin-menu-view="club_accounts">Open Club Accounts</button>
                  <button type="button" class="admin-account__item" role="menuitem" data-admin-menu-view="club_edits">Open Club Edit Queue</button>
                  <button type="button" class="admin-account__item" role="menuitem" data-admin-menu-view="job_disputes">Open Job Disputes</button>
                  <button type="button" class="admin-account__item" role="menuitem" data-admin-menu-view="clubs">Open Clubs</button>
                  <button type="button" class="admin-account__item" role="menuitem" data-admin-menu-view="cars">Open Cars</button>
                  <button type="button" class="admin-account__item" role="menuitem" data-admin-menu-view="flyers">Open Flyers</button>
                  <button type="button" class="admin-account__item admin-account__item--danger" role="menuitem" id="admin-account-signout">Sign out</button>
                </div>
              </div>
            </div>
          </header>
          <div class="admin-workspace">
            <div class="admin-grid">
              <aside class="admin-list-panel">
                <h3 class="admin-list-panel__title">List</h3>
                <p class="admin-list-panel__hint">${
                  view === "admin_profile"
                    ? "Admin account credentials and profile settings."
                    : view === "enquiries"
                    ? "Select an enquiry to open details and update status."
                    : view === "clients"
                      ? "Client records from enquiries and imports."
                      : view === "promoter_requests"
                        ? "Pending rows first. Use the detail panel to approve or deny."
                        : view === "promoters"
                          ? "Choose a promoter for profile and revisions."
                          : view === "jobs"
                            ? "Choose a promoter to attach jobs and history."
                            : view === "guestlist_queue"
                              ? "Pending promoter-submitted names are listed in the detail panel."
                              : view === "night_adjustments"
                                ? "Pending one-off night availability requests appear in the detail panel."
                                : view === "table_sales"
                                  ? "Pending table submissions count here; open Tables for the queue, office entry, and report."
                                  : view === "invoices"
                                    ? "Choose a promoter for invoice tools."
                                    : view === "financials"
                                      ? "Reporting uses financial_transactions."
                                      : view === "club_accounts"
                                        ? "Invite-only club users mapped by club slug."
                                        : view === "club_edits"
                                          ? "Pending and reviewed club edit submissions."
                                          : view === "job_disputes"
                                            ? "Open and resolved disputes raised by club accounts."
                                      : "Choose an item to edit in the panel."
                }</p>
                <div class="pp-filterbar" id="admin-list-toolbar">
                  <div class="pp-filterbar__left">
                    <div class="pp-filterbar__search">
                      <span class="pp-filterbar__search-icon" aria-hidden="true">⌕</span>
                      <input type="search" class="pp-input pp-filterbar__search-input" id="admin-list-search" placeholder="Search rows..." value="${escapeAttr(listSearch)}" />
                    </div>
                  </div>
                  <div class="pp-filterbar__right">
                    ${
                      view === "clubs" || view === "cars" || view === "flyers"
                        ? `<button class="pp-btn pp-btn--primary" type="button" id="admin-add-top">Add new</button>`
                        : view === "clients"
                          ? `<button class="pp-btn pp-btn--primary" type="button" id="admin-add-client-top">Add new</button>`
                          : view === "jobs"
                            ? `<button class="pp-btn ${jobsCreateOpen ? "pp-btn--primary" : "pp-btn--ghost"}" type="button" id="jobs-create-toggle">Add new</button>
                               <button class="pp-btn ${jobsCalendarOpen ? "pp-btn--primary" : "pp-btn--ghost"}" type="button" id="jobs-calendar-toggle">Calendar</button>
                               <button class="pp-btn pp-btn--ghost" type="button" id="jobs-open-financial">Financial jobs</button>`
                          : ""
                    }
                    <button class="pp-btn ${listViewMode === "table" ? "pp-btn--primary" : "pp-btn--ghost"}" type="button" data-admin-list-view="table">Table</button>
                    ${
                      listSupportsGrid(view)
                        ? `<button class="pp-btn ${listViewMode === "grid" ? "pp-btn--primary" : "pp-btn--ghost"}" type="button" data-admin-list-view="grid">Grid</button>`
                        : ""
                    }
                    ${
                      listSupportsCalendar(view)
                        ? `<button class="pp-btn ${listViewMode === "calendar" ? "pp-btn--primary" : "pp-btn--ghost"}" type="button" data-admin-list-view="calendar">Calendar</button>`
                        : ""
                    }
                  </div>
                </div>
                <div class="admin-list" id="admin-list"></div>
                <div class="admin-actions">
                  ${
                    view === "clubs" || view === "cars" || view === "flyers" || view === "jobs"
                      ? `<button class="cc-btn cc-btn--ghost" type="button" id="admin-add">Add new</button>
                     <button class="cc-btn cc-btn--ghost" type="button" id="admin-delete">Delete selected</button>`
                      : view === "clients"
                        ? `<button class="cc-btn cc-btn--ghost" type="button" id="admin-add-client">Add client</button>
                     <button class="cc-btn cc-btn--ghost" type="button" id="admin-delete-client">Delete selected</button>`
                        : ""
                  }
                </div>
              </aside>
              <section class="admin-detail-panel" id="admin-form-wrap">
            ${
              view === "admin_profile"
                ? `
            ${
              adminProfileFormOpen
                ? `<form class="admin-form" id="admin-profile-form" data-collapsible="true">
              <h4 class="full">Account & Security</h4>
              <div class="cc-field"><label>Email</label><input name="email" type="email" autocomplete="email" value="${escapeAttr(adminProfile.email)}" placeholder="admin@cooperconcierge.co.uk" /></div>
              <div class="cc-field"><label>Username</label><input name="username" value="${escapeAttr(adminProfile.username)}" placeholder="Admin username" /></div>
              <div class="cc-field"><label>New password</label><input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="••••••••" /></div>
              <div class="cc-field"><label>Confirm new password</label><input name="passwordConfirm" type="password" minlength="8" autocomplete="new-password" placeholder="••••••••" /></div>
              <div class="admin-actions full">
                <button class="cc-btn cc-btn--gold" type="submit" id="admin-save-profile-settings">Save profile settings</button>
              </div>
            </form>`
                : `<p class="admin-note">Profile form hidden. Click to open.</p><button class="pp-btn pp-btn--primary" type="button" id="open-admin-profile-form">Open Form</button>`
            }
            `
                : view === "clubs"
                ? `
            ${
              clubFormOpen
                ? `<form class="admin-form" id="club-form" data-collapsible="true">
              <h4 class="full">Core Details</h4>
              <div class="cc-field pp-col-4"><label for="club-slug">Slug</label><input id="club-slug" name="slug" required value="${escapeAttr(club.slug)}" /></div>
              <div class="cc-field pp-col-8"><label for="club-name">Name</label><input id="club-name" name="name" required value="${escapeAttr(club.name)}" /></div>
              <div class="cc-field full"><label>Short description</label><textarea name="shortDescription">${escapeAttr(club.shortDescription)}</textarea></div>
              <p class="admin-maps-hint" style="margin:0 0 0.75rem">Nightlife discovery cards (carousel + all venues): optional overrides. Leave blank to use name, short description, and the first image URL in the list below.</p>
              <h4 class="full">Discovery Card</h4>
              <div class="cc-field pp-col-4"><label>Card title override</label><input name="discoveryCardTitle" value="${escapeAttr(club.discoveryCardTitle ?? "")}" placeholder="Defaults to name" /></div>
              <div class="cc-field full"><label>Card blurb override</label><textarea name="discoveryCardBlurb" placeholder="Defaults to short description">${escapeAttr(club.discoveryCardBlurb ?? "")}</textarea></div>
              <div class="cc-field full"><label>Card image URL override</label><input name="discoveryCardImage" value="${escapeAttr(club.discoveryCardImage ?? "")}" placeholder="/clubs/… or https://…" /></div>
              <div class="cc-field full"><label>Long description</label><textarea name="longDescription">${escapeAttr(club.longDescription)}</textarea></div>
              <h4 class="full">Location & Schedule</h4>
              <div class="cc-field pp-col-4"><label>Location tag</label><input name="locationTag" value="${escapeAttr(club.locationTag)}" /></div>
              <div class="cc-field full">
                <label for="club-address-input">Address</label>
                <input id="club-address-input" name="address" autocomplete="off" value="${escapeAttr(club.address)}" />
                <p class="admin-maps-hint" id="club-address-maps-hint"></p>
              </div>
              <div class="cc-field pp-col-4"><label>Days Open</label><input name="daysOpen" value="${escapeAttr(club.daysOpen)}" /></div>
              <div class="cc-field pp-col-4"><label>Best Visit Days (| separated)</label><input name="bestVisitDays" value="${escapeAttr(club.bestVisitDays.join("|"))}" /></div>
              <div class="cc-field pp-col-4"><label>Featured Day</label><input name="featuredDay" value="${escapeAttr(club.featuredDay)}" /></div>
              <div class="cc-field pp-col-3"><label>Venue type</label>
                <select name="venueType">
                  <option value="lounge" ${vt === "lounge" ? "selected" : ""}>Lounge</option>
                  <option value="club" ${vt === "club" ? "selected" : ""}>Club</option>
                  <option value="dining" ${vt === "dining" ? "selected" : ""}>Dining</option>
                </select>
              </div>
              <div class="cc-field pp-col-3"><label>Lat</label><input name="lat" type="number" step="any" value="${club.lat}" /></div>
              <div class="cc-field pp-col-3"><label>Lng</label><input name="lng" type="number" step="any" value="${club.lng}" /></div>
              <div class="cc-field pp-col-6"><label>Website</label><input name="website" placeholder="https://…" value="${escapeAttr(club.website)}" /></div>
              <h4 class="full">Pricing & Positioning</h4>
              <div class="cc-field pp-col-3"><label>Min spend</label><input name="minSpend" value="${escapeAttr(club.minSpend)}" /></div>
              <div class="cc-field pp-col-3"><label>Entry (women)</label><input name="entryPricingWomen" value="${escapeAttr(club.entryPricingWomen)}" /></div>
              <div class="cc-field pp-col-3"><label>Entry (men)</label><input name="entryPricingMen" value="${escapeAttr(club.entryPricingMen)}" /></div>
              <div class="cc-field pp-col-3"><label>Featured on site</label>
                <select name="featured">
                  <option value="true" ${club.featured ? "selected" : ""}>Yes</option>
                  <option value="false" ${!club.featured ? "selected" : ""}>No</option>
                </select>
              </div>
              <div class="cc-field pp-col-4"><label>Tables standard</label><input name="tablesStandard" value="${escapeAttr(club.tablesStandard)}" /></div>
              <div class="cc-field pp-col-4"><label>Tables luxury</label><input name="tablesLuxury" value="${escapeAttr(club.tablesLuxury)}" /></div>
              <div class="cc-field pp-col-4"><label>Tables VIP</label><input name="tablesVip" value="${escapeAttr(club.tablesVip)}" /></div>
              <div class="cc-field full"><label>Known for (one per line)</label><textarea name="knownFor">${escapeAttr(club.knownFor.join("\n"))}</textarea></div>
              <div class="cc-field full"><label>Amenities (one per line)</label><textarea name="amenities">${escapeAttr(club.amenities.join("\n"))}</textarea></div>
              <h4 class="full">Media</h4>
              <div class="cc-field full"><label>Images (one URL per line)</label><textarea name="images" id="club-images-text">${escapeAttr(club.images.join("\n"))}</textarea></div>
              <div class="cc-field full admin-upload-row">
                <label for="club-image-file">Upload image</label>
                <input id="club-image-file" type="file" accept="image/*" />
                <button type="button" class="cc-btn cc-btn--ghost" id="club-image-upload">Upload to storage &amp; append URL</button>
              </div>
              <h4 class="full">Payment Details</h4>
              <div class="cc-field pp-col-4"><label>Method</label><input name="paymentMethod" value="${escapeAttr(club.paymentDetails?.method ?? "")}" /></div>
              <div class="cc-field pp-col-8"><label>Beneficiary</label><input name="beneficiaryName" value="${escapeAttr(club.paymentDetails?.beneficiaryName ?? "")}" /></div>
              <div class="cc-field pp-col-4"><label>Account no</label><input name="accountNumber" value="${escapeAttr(club.paymentDetails?.accountNumber ?? "")}" /></div>
              <div class="cc-field pp-col-4"><label>Sort code</label><input name="sortCode" value="${escapeAttr(club.paymentDetails?.sortCode ?? "")}" /></div>
              <div class="cc-field pp-col-4"><label>Payout Email</label><input name="payoutEmail" value="${escapeAttr(club.paymentDetails?.payoutEmail ?? "")}" /></div>
              <div class="cc-field pp-col-6"><label>IBAN</label><input name="iban" value="${escapeAttr(club.paymentDetails?.iban ?? "")}" /></div>
              <div class="cc-field pp-col-6"><label>SWIFT/BIC</label><input name="swiftBic" value="${escapeAttr(club.paymentDetails?.swiftBic ?? "")}" /></div>
              <div class="cc-field full"><label>Reference</label><input name="paymentReference" value="${escapeAttr(club.paymentDetails?.reference ?? "")}" /></div>
              <h4 class="full">Tax Details</h4>
              <div class="cc-field pp-col-6"><label>Registered name</label><input name="taxRegisteredName" value="${escapeAttr(club.taxDetails?.registeredName ?? "")}" /></div>
              <div class="cc-field pp-col-3"><label>Tax ID</label><input name="taxId" value="${escapeAttr(club.taxDetails?.taxId ?? "")}" /></div>
              <div class="cc-field pp-col-3"><label>VAT number</label><input name="vatNumber" value="${escapeAttr(club.taxDetails?.vatNumber ?? "")}" /></div>
              <div class="cc-field pp-col-4"><label>Tax country</label><input name="taxCountryCode" value="${escapeAttr(club.taxDetails?.countryCode ?? "")}" maxlength="8" /></div>
              <div class="cc-field pp-col-4"><label>VAT registered</label><select name="isVatRegistered"><option value="true"${club.taxDetails?.isVatRegistered ? " selected" : ""}>yes</option><option value="false"${!club.taxDetails?.isVatRegistered ? " selected" : ""}>no</option></select></div>
              <div class="cc-field full"><label>Tax Notes</label><textarea name="taxNotes">${escapeAttr(club.taxDetails?.notes ?? "")}</textarea></div>
              <div class="cc-field full"><label>Guestlists (days,recurrence,notes per line)</label><textarea name="guestlists">${escapeAttr(guestlistsText(club.guestlists))}</textarea></div>
            </form>`
                : `<p class="admin-note">Club form hidden until Add new/Edit is clicked.</p><button class="pp-btn pp-btn--primary" type="button" id="open-club-form">Open Form</button>`
            }
            `
                : view === "cars"
                  ? `
            ${
              carFormOpen
                ? `<form class="admin-form" id="car-form" data-collapsible="true">
              <h4 class="full">Core Details</h4>
              <div class="cc-field pp-col-4"><label for="car-slug">Slug</label><input id="car-slug" name="slug" required value="${escapeAttr(car.slug)}" /></div>
              <div class="cc-field pp-col-8"><label for="car-name">Name</label><input id="car-name" name="name" required value="${escapeAttr(car.name)}" /></div>
              <div class="cc-field pp-col-6"><label>Display Label</label><input name="roleLabel" value="${escapeAttr(car.roleLabel)}" /></div>
              <div class="cc-field pp-col-3"><label>Grid size</label>
                <select name="gridSize">
                  <option value="large" ${gs === "large" ? "selected" : ""}>Large</option>
                  <option value="medium" ${gs === "medium" ? "selected" : ""}>Medium</option>
                  <option value="feature" ${gs === "feature" ? "selected" : ""}>Feature</option>
                </select>
              </div>
              <div class="cc-field pp-col-3"><label>Display Order</label><input name="order" type="number" step="1" value="${car.order}" /></div>
              <h4 class="full">Media</h4>
              <div class="cc-field full"><label>Specs (one per line)</label><textarea name="specsHover">${escapeAttr(car.specsHover.join("\n"))}</textarea></div>
              <div class="cc-field full"><label>Images (one URL per line)</label><textarea name="images" id="car-images-text">${escapeAttr(car.images.join("\n"))}</textarea></div>
              <div class="cc-field full admin-upload-row">
                <label for="car-image-file">Upload image</label>
                <input id="car-image-file" type="file" accept="image/*" />
                <button type="button" class="cc-btn cc-btn--ghost" id="car-image-upload">Upload to storage &amp; append URL</button>
              </div>
            </form>`
                : `<p class="admin-note">Car form hidden until Add new/Edit is clicked.</p><button class="pp-btn pp-btn--primary" type="button" id="open-car-form">Open Form</button>`
            }
            `
                  : view === "flyers"
                    ? `
            ${
              flyerFormOpen
                ? `<form class="admin-form" id="flyer-form" data-collapsible="true">
              <h4 class="full">Event Details</h4>
              <div class="cc-field full"><label for="flyer-club-select">Club</label>
                <select id="flyer-club-select" name="clubSlug" required>${flyerClubSelectOptions(clubEntries, flyer.clubSlug)}</select>
              </div>
              <div class="cc-field pp-col-4"><label for="flyer-event-date">Event date</label><input id="flyer-event-date" name="eventDate" type="date" required value="${escapeAttr(flyer.eventDate)}" /></div>
              <div class="cc-field pp-col-8"><label>Title</label><input name="title" required value="${escapeAttr(flyer.title)}" /></div>
              <div class="cc-field full"><label>Description</label><textarea name="description">${escapeAttr(flyer.description)}</textarea></div>
              <div class="cc-field pp-col-4"><label>Display Order</label><input name="sortOrder" type="number" step="1" value="${flyer.sortOrder}" /></div>
              <div class="cc-field pp-col-4"><label>Publish Status</label>
                <select name="isActive">
                  <option value="true" ${flyer.isActive ? "selected" : ""}>Active</option>
                  <option value="false" ${!flyer.isActive ? "selected" : ""}>Inactive</option>
                </select>
              </div>
              <h4 class="full">Media</h4>
              <div class="cc-field full"><label>Image URL</label><input name="imageUrl" placeholder="Filled automatically after upload" value="${escapeAttr(flyer.imageUrl)}" /></div>
              <div class="cc-field full"><label>Storage Path</label><input name="imagePath" value="${escapeAttr(flyer.imagePath)}" readonly /></div>
              <div class="cc-field full">
                <label for="flyer-image-file">Upload image</label>
                <input id="flyer-image-file" type="file" accept="image/*" />
              </div>
              <div class="admin-actions full">
                <button class="cc-btn cc-btn--ghost" type="button" id="flyer-upload">Upload selected image</button>
                <button class="cc-btn cc-btn--gold" type="button" id="flyer-save-db">${flyer.id ? "Update flyer" : "Create flyer"}</button>
              </div>
            </form>`
                : `<p class="admin-note">Flyer form hidden until Add new/Edit is clicked.</p><button class="pp-btn pp-btn--primary" type="button" id="open-flyer-form">Open Form</button>`
            }
            `
                    : view === "promoter_requests"
                      ? (() => {
                          const req = promoterSignupRequests.find(
                            (x) => x.id === selectedPromoterRequestId,
                          );
                          if (!req) {
                            return `<p class="admin-note full">No promoter access requests yet.</p>`;
                          }
                          const pending = req.status === "pending";
                          return `
            <div class="admin-form">
              <h4 class="full">Request</h4>
              <div class="cc-field"><label>Name</label><input value="${escapeAttr(req.fullName)}" readonly /></div>
              <div class="cc-field"><label>Email</label><input value="${escapeAttr(req.email)}" readonly /></div>
              <div class="cc-field"><label>Status</label><input value="${escapeAttr(req.status)}" readonly /></div>
              <div class="cc-field full"><label>Submitted</label><input value="${escapeAttr(req.createdAt)}" readonly /></div>
              ${
                req.reviewedAt
                  ? `<div class="cc-field full"><label>Reviewed</label><input value="${escapeAttr(req.reviewedAt)}" readonly /></div>`
                  : ""
              }
              ${
                req.denialReason
                  ? `<div class="cc-field full"><label>Denial notes</label><textarea readonly>${escapeAttr(req.denialReason)}</textarea></div>`
                  : ""
              }
              ${
                pending
                  ? `<div class="cc-field full"><label>Denial message (sent if you deny)</label><textarea id="promoter-request-deny-notes" placeholder="Optional message to include in the denial email"></textarea></div>
              <div class="admin-actions full">
                <button class="cc-btn cc-btn--gold" type="button" id="promoter-request-approve">Approve &amp; create login</button>
                <button class="cc-btn cc-btn--ghost" type="button" id="promoter-request-deny">Deny</button>
                <button class="cc-btn cc-btn--ghost" type="button" id="promoter-request-compose-email">Send email (copy address &amp; open mail)</button>
              </div>
              <p class="admin-note full">Approving creates a Supabase Auth user, promoter profile, and sends emails (requires deployed <code>admin-promoter-request</code> function + <code>RESEND_API_KEY</code>). See <code>edge/README.md</code>.</p>`
                  : `<p class="admin-note full">This request has already been ${escapeAttr(req.status)}.</p>`
              }
            </div>`;
                        })()
                      : view === "promoters"
                      ? `
            <div class="admin-form">
              <h4 class="full">Promoter profile</h4>
              ${
                promoters.find((p) => p.id === selectedPromoterId)
                  ? (() => {
                      const p = promoters.find((x) => x.id === selectedPromoterId)!;
                      return `<div class="cc-field"><label>Name</label><input value="${escapeAttr(p.displayName)}" disabled /></div>
                      <div class="cc-field"><label>Approval</label><input value="${escapeAttr(p.approvalStatus)}" disabled /></div>
                      <div class="cc-field full"><label>Bio</label><textarea disabled>${escapeAttr(p.bio)}</textarea></div>
                      <div class="cc-field full"><label>Primary image</label><input value="${escapeAttr(p.profileImageUrl)}" disabled /></div>
                      <div class="cc-field full"><label>Photo gallery (${(p.profileImageUrls ?? []).length})</label><textarea disabled rows="3">${escapeAttr((p.profileImageUrls ?? []).join("\n"))}</textarea></div>
                      <div class="cc-field full"><label>Portfolio clubs</label><input value="${escapeAttr((p.portfolioClubSlugs ?? []).join(", "))}" disabled /></div>`;
                    })()
                  : `<p class="admin-note full">No promoters yet.</p>`
              }
              ${
                selectedPromoterId
                  ? `
              <h4 class="full">Promoter interactions</h4>
              <div class="admin-actions full">
                <button type="button" class="cc-btn cc-btn--ghost" data-admin-menu-view="jobs">Open Jobs</button>
                <button type="button" class="cc-btn cc-btn--ghost" data-admin-menu-view="financials">Open Financials</button>
                <button type="button" class="cc-btn cc-btn--ghost" data-admin-menu-view="invoices">Open Invoices</button>
              </div>
              <div class="full promoter-table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Club</th><th>Service</th><th>Status</th><th>Guests</th><th>Comp</th></tr></thead>
                  <tbody>${
                    promoterJobs.length
                      ? promoterJobs
                          .slice()
                          .sort((a, b) => (a.jobDate < b.jobDate ? 1 : a.jobDate > b.jobDate ? -1 : 0))
                          .map(
                            (j) =>
                              `<tr><td>${escapeAttr(j.jobDate)}</td><td>${escapeAttr(j.clubSlug ?? "—")}</td><td>${escapeAttr(j.service)}</td><td>${escapeAttr(j.status)}</td><td>${j.guestsCount}</td><td>${escapeAttr(`£${j.shiftFee.toFixed(2)} + £${j.guestlistFee.toFixed(2)}/guest`)}</td></tr>`,
                          )
                          .join("")
                      : "<tr><td colspan='6'>No jobs logged for this promoter yet.</td></tr>"
                  }</tbody>
                </table>
              </div>`
                  : ""
              }
              <h4 class="full">Pending revisions</h4>
              <div class="full admin-list admin-list--inline">
                ${
                  promoterRevisions.length
                    ? promoterRevisions
                        .map(
                          (r) =>
                            `<button type="button" data-revision-id="${escapeAttr(r.id)}" class="${r.id === selectedRevisionId ? "is-active" : ""}">${escapeAttr(r.status)} · ${escapeAttr(r.created_at)}</button>`,
                        )
                        .join("")
                    : `<p class="admin-note">No revision requests.</p>`
                }
              </div>
              ${
                promoterRevisions.find((r) => r.id === selectedRevisionId)
                  ? (() => {
                      const r = promoterRevisions.find((x) => x.id === selectedRevisionId)!;
                      const pay = r.payload;
                      const imgC = Array.isArray(pay.profile_image_urls)
                        ? pay.profile_image_urls.length
                        : 0;
                      const portC = Array.isArray(pay.portfolio_club_slugs)
                        ? pay.portfolio_club_slugs.length
                        : 0;
                      return `<p class="admin-note full">Summary: <strong>${imgC}</strong> photo URL(s), <strong>${portC}</strong> portfolio club slug(s).</p>
                      <div class="cc-field full"><label>Revision payload</label><pre class="admin-json">${escapeAttr(JSON.stringify(r.payload, null, 2))}</pre></div>
                      <div class="cc-field full"><label>Review notes</label><textarea id="promoter-review-notes">${escapeAttr(r.review_notes || "")}</textarea></div>
                      <div class="admin-actions full">
                        <button class="cc-btn cc-btn--gold" type="button" id="promoter-approve-revision">Approve</button>
                        <button class="cc-btn cc-btn--ghost" type="button" id="promoter-reject-revision">Reject</button>
                      </div>`;
                    })()
                  : ""
              }
            </div>`
                      : view === "club_accounts"
                        ? (() => {
                            const acct = clubAccounts.find((x) => x.id === selectedClubAccountId) ?? clubAccounts[0];
                            const clubOptions = clubEntries
                              .map((c) => `<option value="${escapeAttr(c.club.slug)}"${acct?.club_slug === c.club.slug ? " selected" : ""}>${escapeAttr(c.club.slug)}</option>`)
                              .join("");
                            return `${
                              clubAccountsFormOpen
                                ? `<div class="admin-form" id="club-accounts-form">
                              <h4 class="full">Invite-only club account generation</h4>
                              <div class="cc-field"><label>Club slug</label><select id="club-account-slug">${clubOptions}</select></div>
                              <div class="cc-field"><label>Email</label><input id="club-account-email" type="email" placeholder="club@domain.com" /></div>
                              <div class="cc-field"><label>Role</label><select id="club-account-role"><option value="owner">owner</option><option value="manager">manager</option><option value="editor">editor</option></select></div>
                              <div class="cc-field full"><label>Notes</label><textarea id="club-account-notes"></textarea></div>
                              <div class="admin-actions full"><button class="cc-btn cc-btn--gold" type="button" id="club-account-create">Generate Invite Code</button></div>
                              <p class="admin-note full" id="club-account-output"></p>
                              ${acct ? `<h4 class="full">Selected account</h4>
                              <div class="cc-field"><label>Club</label><input readonly value="${escapeAttr(acct.club_slug)}" /></div>
                              <div class="cc-field"><label>Status</label><input readonly value="${escapeAttr(acct.status)}" /></div>
                              <div class="cc-field"><label>Role</label><input readonly value="${escapeAttr(acct.role)}" /></div>
                              <div class="cc-field full"><label>Invite code</label><input readonly value="${escapeAttr(acct.invite_code || "—")}" /></div>` : `<p class="admin-note full">No club accounts yet.</p>`}
                            </div>`
                                : `<p class="admin-note">Club accounts form hidden until Add/Edit is clicked.</p><button class="pp-btn pp-btn--primary" type="button" id="open-club-accounts-form">Open Form</button>`
                            }`;
                          })()
                        : view === "club_edits"
                          ? (() => {
                              const rev = clubEditRevisions.find((x) => x.id === selectedClubRevisionId);
                              if (!rev) return `<p class="admin-note">No club edit revisions yet.</p>`;
                              return `<div class="admin-form">
                                <div class="cc-field"><label>Club</label><input readonly value="${escapeAttr(rev.club_slug)}" /></div>
                                <div class="cc-field"><label>Target</label><input readonly value="${escapeAttr(rev.target_type)}" /></div>
                                <div class="cc-field"><label>Status</label><input readonly value="${escapeAttr(rev.status)}" /></div>
                                <div class="cc-field full"><label>Payload</label><pre class="admin-json">${escapeAttr(JSON.stringify(rev.payload, null, 2))}</pre></div>
                                <div class="cc-field full"><label>Review notes</label><textarea id="club-revision-review-notes">${escapeAttr(rev.review_notes || "")}</textarea></div>
                                <div class="admin-actions full"><button class="cc-btn cc-btn--gold" type="button" id="club-revision-approve">Approve</button><button class="cc-btn cc-btn--ghost" type="button" id="club-revision-reject">Reject</button></div>
                              </div>`;
                            })()
                          : view === "job_disputes"
                            ? (() => {
                                const d = clubJobDisputes.find((x) => x.id === selectedClubDisputeId);
                                if (!d) return `<p class="admin-note">No disputes recorded yet.</p>`;
                                return `<div class="admin-form">
                                  <div class="cc-field"><label>Club</label><input readonly value="${escapeAttr(d.club_slug)}" /></div>
                                  <div class="cc-field"><label>Job</label><input readonly value="${escapeAttr(d.promoter_job_id || "—")}" /></div>
                                  <div class="cc-field"><label>Status</label><input readonly value="${escapeAttr(d.status)}" /></div>
                                  <div class="cc-field"><label>Reason</label><input readonly value="${escapeAttr(d.reason_code)}" /></div>
                                  <div class="cc-field full"><label>Description</label><textarea readonly>${escapeAttr(d.description)}</textarea></div>
                                  <div class="cc-field full"><label>Resolution notes</label><textarea id="club-dispute-review-notes">${escapeAttr(d.resolution_notes || "")}</textarea></div>
                                  <div class="admin-actions full"><button class="cc-btn cc-btn--ghost" type="button" data-dispute-status="under_review">Mark under review</button><button class="cc-btn cc-btn--gold" type="button" data-dispute-status="resolved">Resolve</button><button class="cc-btn cc-btn--ghost" type="button" data-dispute-status="rejected">Reject</button></div>
                                </div>`;
                              })()
                            : view === "jobs"
                        ? renderJobsViewHtml()
                        : view === "guestlist_queue"
                          ? renderGuestlistQueueDetailHtml()
                          : view === "night_adjustments"
                            ? renderNightAdjustmentQueueDetailHtml()
                            : view === "table_sales"
                              ? renderTableSalesViewHtml()
                              : view === "invoices"
                                ? `
            ${
              invoiceFormOpen
                ? `<form class="admin-form" id="promoter-invoice-form" data-collapsible="true">
              <h4 class="full">Generate invoice</h4>
              <div class="cc-field"><label>Promoter</label>
                <select name="promoterId">${promoters.map((p) => `<option value="${escapeAttr(p.id)}"${p.id === selectedPromoterId ? " selected" : ""}>${escapeAttr(p.displayName || p.userId)}</option>`).join("")}</select>
              </div>
              <div class="cc-field"><label>Period start</label><input name="from" type="date" value="${new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)}" /></div>
              <div class="cc-field"><label>Period end</label><input name="to" type="date" value="${new Date().toISOString().slice(0, 10)}" /></div>
              <div class="admin-actions full">
                <button class="cc-btn cc-btn--gold" type="button" id="promoter-invoice-generate">Generate invoice</button>
              </div>
              <p class="admin-note full">PDF and email use the <code>promoter-invoice</code> Edge Function (deploy + set <code>RESEND_API_KEY</code>, <code>RESEND_FROM</code>, <code>INVOICE_EMAIL_PROVIDER</code>).</p>
              <h4 class="full">Previous invoices</h4>
              <div class="full promoter-table-wrap">
                <table>
                  <thead><tr><th>Period</th><th>Status</th><th>Total</th><th>Sent</th><th>PDF</th><th>Email</th></tr></thead>
                  <tbody>
                    ${
                      promoterInvoices.length
                        ? promoterInvoices
                            .map((i) => {
                              const sent =
                                i.sentAt && i.sentToEmail
                                  ? `${escapeAttr(i.sentAt.slice(0, 10))} → ${escapeAttr(i.sentToEmail)}`
                                  : "—";
                              return `<tr>
                              <td>${escapeAttr(i.periodStart)} to ${escapeAttr(i.periodEnd)}</td>
                              <td>${escapeAttr(i.status)}</td>
                              <td>${escapeAttr(`£${i.total.toFixed(2)}`)}</td>
                              <td class="admin-list-col--wide">${sent}</td>
                              <td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-invoice-pdf data-invoice-id="${escapeAttr(i.id)}">PDF</button></td>
                              <td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-invoice-email data-invoice-id="${escapeAttr(i.id)}">Email</button></td>
                            </tr>`;
                            })
                            .join("")
                        : "<tr><td colspan='6'>No invoices for selected promoter.</td></tr>"
                    }
                  </tbody>
                </table>
              </div>
            </form>`
                : `<p class="admin-note">Invoice actions hidden until Add new/Edit is clicked.</p><button class="pp-btn pp-btn--primary" type="button" id="open-invoice-form">Open Form</button>`
            }
            `
                          : view === "financials"
                            ? renderFinancialsViewHtml()
                    : view === "enquiries"
                      ? enquiry
                        ? renderEnquiryDetail(enquiry)
                        : `<p class="admin-note">No enquiries yet.</p>`
                      : clientRow
                        ? renderClientDetail(
                            clientRow,
                            clientGuestlistActivity,
                            clientAttendances,
                            clubEntries,
                            promoters,
                            selectedClientAttendanceId,
                          )
                        : `<p class="admin-note">No clients yet. Add one with “Add client” or use “Create clients from names” on a guestlist enquiry.</p>`
            }
              </section>
            </div>
            <p class="admin-workspace__footer-hint">Enquiries and clients live in the CRM tables. Website content maps to <code>public.clubs</code>, <code>public.cars</code>, and weekly flyers (save a club before linking flyers). Images use the <code>${escapeAttr(ADMIN_MEDIA_BUCKET)}</code> bucket.</p>
            <div class="admin-flash" id="admin-flash"></div>
          </div>
        </div>
      </div>
    `;

    bindDashboardEvents();
  }

  function applyCollapsibleFormSections(scope: ParentNode): void {
    const blocks = Array.from(
      scope.querySelectorAll<HTMLElement>(".admin-form[data-collapsible='true'], .club-form-grid[data-collapsible='true']"),
    );
    for (const block of blocks) {
      if (block.dataset.collapsibleReady === "1") continue;
      const headings = Array.from(block.querySelectorAll<HTMLElement>(":scope > h4.full"));
      if (!headings.length) {
        block.dataset.collapsibleReady = "1";
        continue;
      }

      for (let i = 0; i < headings.length; i += 1) {
        const heading = headings[i];
        const nextHeading = headings[i + 1] ?? null;
        const details = document.createElement("details");
        details.className = "pp-form-section full";
        details.open = i === 0;

        const summary = document.createElement("summary");
        summary.className = "pp-form-section__summary";
        summary.textContent = heading.textContent?.trim() || `Section ${i + 1}`;
        details.append(summary);

        const body = document.createElement("div");
        body.className = "pp-form-section__body";
        details.append(body);

        let node = heading.nextElementSibling as HTMLElement | null;
        while (node && node !== nextHeading) {
          const nextNode = node.nextElementSibling as HTMLElement | null;
          body.append(node);
          node = nextNode;
        }

        heading.replaceWith(details);
      }

      block.dataset.collapsibleReady = "1";
    }
  }

  function mountDashboardFormModal(
    formId: string,
    title: string,
    onClose: () => void,
  ): void {
    const form = adminRoot.querySelector<HTMLElement>(`#${formId}`);
    if (!form || form.closest(".pp-modal")) return;
    const host = document.createElement("div");
    host.className = "pp-modal-host finx-modal-host";
    host.innerHTML = `<div class="pp-modal__overlay">
      <div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}">
        <div class="pp-modal__header">
          <h4 class="pp-modal__title">${escapeAttr(title)}</h4>
          <button type="button" class="pp-modal__close" aria-label="Close">×</button>
        </div>
        <div class="pp-modal__body"></div>
      </div>
    </div>`;
    const body = host.querySelector(".pp-modal__body") as HTMLElement | null;
    body?.append(form);
    host.querySelector(".pp-modal__close")?.addEventListener("click", onClose);
    host.querySelector(".pp-modal__overlay")?.addEventListener("click", (ev) => {
      if (ev.target === ev.currentTarget) onClose();
    });
    adminRoot.append(host);
  }

  function bindDashboardEvents(): void {
    applyCollapsibleFormSections(adminRoot);
    const editingRule = financialEditingRuleId
      ? nativeFinancialRules.find((r) => r.id === financialEditingRuleId) ?? null
      : null;
    const ruleFormEl = adminRoot.querySelector("#financial-rule-form") as HTMLFormElement | null;
    if (ruleFormEl) {
      const departmentEl = ruleFormEl.elements.namedItem("department") as HTMLSelectElement | null;
      const logicTypeEl = ruleFormEl.elements.namedItem("logicType") as HTMLSelectElement | null;
      const maleField = ruleFormEl.elements.namedItem("maleRate") as HTMLInputElement | null;
      const femaleField = ruleFormEl.elements.namedItem("femaleRate") as HTMLInputElement | null;
      const maleLabel = maleField?.closest(".cc-field")?.querySelector("label");
      const femaleLabel = femaleField?.closest(".cc-field")?.querySelector("label");
      if (maleLabel) maleLabel.textContent = "Male ratio";
      if (femaleLabel) femaleLabel.textContent = "Female ratio";
      const syncNightlifeLogicLock = (): void => {
        if (!departmentEl || !logicTypeEl) return;
        const nightlife = departmentEl.value === "nightlife";
        if (nightlife) {
          logicTypeEl.value = "flat_fee";
          logicTypeEl.setAttribute("disabled", "true");
          logicTypeEl.title = "Nightlife is locked to base-rate-per-guest model.";
        } else {
          logicTypeEl.removeAttribute("disabled");
          logicTypeEl.title = "";
        }
      };
      syncNightlifeLogicLock();
      if (departmentEl && !departmentEl.dataset.logicLockBound) {
        departmentEl.dataset.logicLockBound = "1";
        departmentEl.addEventListener("change", syncNightlifeLogicLock);
      }
    }
    if (ruleFormEl && editingRule) {
      const deptEl = ruleFormEl.elements.namedItem("department") as HTMLSelectElement | null;
      if (deptEl) deptEl.value = editingRule.department;
      (ruleFormEl.elements.namedItem("clubSlug") as HTMLSelectElement | null)!.value =
        editingRule.clubSlug || "";
      (ruleFormEl.elements.namedItem("venueOrServiceName") as HTMLInputElement | null)!.value =
        editingRule.venueOrServiceName;
      (ruleFormEl.elements.namedItem("logicType") as HTMLSelectElement | null)!.value = editingRule.logicType;
      (ruleFormEl.elements.namedItem("maleRate") as HTMLInputElement | null)!.value = String(editingRule.maleRate);
      (ruleFormEl.elements.namedItem("femaleRate") as HTMLInputElement | null)!.value = String(editingRule.femaleRate);
      (ruleFormEl.elements.namedItem("baseRate") as HTMLInputElement | null)!.value = String(editingRule.baseRate);
      (ruleFormEl.elements.namedItem("bonusType") as HTMLSelectElement | null)!.value = editingRule.bonusType;
      (ruleFormEl.elements.namedItem("bonusGoal") as HTMLInputElement | null)!.value = String(editingRule.bonusGoal);
      (ruleFormEl.elements.namedItem("bonusAmount") as HTMLInputElement | null)!.value = String(editingRule.bonusAmount);
      (ruleFormEl.elements.namedItem("effectiveFrom") as HTMLInputElement | null)!.value =
        editingRule.effectiveFrom.slice(0, 10);
    }
    const editingBooking = financialEditingBookingId
      ? nativeFinancialBookings.find((b) => b.id === financialEditingBookingId) ?? null
      : null;
    const bookingFormEl = adminRoot.querySelector("#financial-booking-form") as HTMLFormElement | null;
    if (bookingFormEl) {
      const venueInput = bookingFormEl.elements.namedItem("venueOrServiceName") as HTMLInputElement | null;
      if (venueInput) {
        const listId = "fin-venue-service-options";
        venueInput.setAttribute("list", listId);
        if (!adminRoot.querySelector(`#${listId}`)) {
          const dl = document.createElement("datalist");
          dl.id = listId;
          dl.innerHTML = Array.from(
            new Set(nativeFinancialBookings.map((b) => b.venueOrServiceName).filter(Boolean)),
          )
            .map((x) => `<option value="${escapeAttr(x)}"></option>`)
            .join("");
          adminRoot.append(dl);
        }
      }
    }
    if (bookingFormEl && editingBooking) {
      (bookingFormEl.elements.namedItem("department") as HTMLSelectElement | null)!.value =
        editingBooking.department;
      (bookingFormEl.elements.namedItem("clubSlug") as HTMLSelectElement | null)!.value =
        editingBooking.clubSlug || "";
      (bookingFormEl.elements.namedItem("bookingReference") as HTMLInputElement | null)!.value =
        editingBooking.bookingReference;
      (bookingFormEl.elements.namedItem("bookingDate") as HTMLInputElement | null)!.value =
        editingBooking.bookingDate.slice(0, 10);
      (bookingFormEl.elements.namedItem("promoterId") as HTMLSelectElement | null)!.value =
        editingBooking.promoterId || "";
      (bookingFormEl.elements.namedItem("ruleId") as HTMLSelectElement | null)!.value =
        editingBooking.ruleId || "";
      (bookingFormEl.elements.namedItem("venueOrServiceName") as HTMLInputElement | null)!.value =
        editingBooking.venueOrServiceName;
      (bookingFormEl.elements.namedItem("maleGuests") as HTMLInputElement | null)!.value =
        String(editingBooking.maleGuests);
      (bookingFormEl.elements.namedItem("femaleGuests") as HTMLInputElement | null)!.value =
        String(editingBooking.femaleGuests);
      (bookingFormEl.elements.namedItem("otherCosts") as HTMLInputElement | null)!.value =
        String(editingBooking.otherCosts);
      (bookingFormEl.elements.namedItem("totalSpend") as HTMLInputElement | null)!.value =
        String(editingBooking.totalSpend);
      (bookingFormEl.elements.namedItem("paymentStatus") as HTMLSelectElement | null)!.value =
        editingBooking.paymentStatus;
    }
    if (view === "admin_profile" && adminProfileFormOpen) {
      mountDashboardFormModal("admin-profile-form", "Admin profile", () => {
        adminProfileFormOpen = false;
        renderDashboard();
      });
    }
    if (view === "clubs" && clubFormOpen) {
      mountDashboardFormModal("club-form", "Club editor", () => {
        clubFormOpen = false;
        renderDashboard();
      });
    }
    if (view === "cars" && carFormOpen) {
      mountDashboardFormModal("car-form", "Car editor", () => {
        carFormOpen = false;
        renderDashboard();
      });
    }
    if (view === "flyers" && flyerFormOpen) {
      mountDashboardFormModal("flyer-form", "Flyer editor", () => {
        flyerFormOpen = false;
        renderDashboard();
      });
    }
    if (view === "invoices" && invoiceFormOpen) {
      mountDashboardFormModal("promoter-invoice-form", "Invoice actions", () => {
        invoiceFormOpen = false;
        renderDashboard();
      });
    }
    if (view === "club_accounts" && clubAccountsFormOpen) {
      mountDashboardFormModal("club-accounts-form", "Club account tools", () => {
        clubAccountsFormOpen = false;
        renderDashboard();
      });
    }
    if (!guestlistQueueDelegationBound) {
      guestlistQueueDelegationBound = true;
      adminRoot.addEventListener("click", (ev) => {
        const t = ev.target as HTMLElement | null;
        if (!t) return;
        if (t.closest("[data-gl-refresh]")) {
          void reloadGuestlistQueue().then(() => {
            flash("Guestlist queue refreshed.");
            renderDashboard();
          });
          return;
        }
        const approve = t.closest("button[data-gl-approve]") as HTMLButtonElement | null;
        const reject = t.closest("button[data-gl-reject]") as HTMLButtonElement | null;
        const act = approve ?? reject;
        if (!act) return;
        const entryId = act.dataset.entryId?.trim();
        if (!entryId) return;
        const tr = act.closest("tr");
        const notes = String(
          (tr?.querySelector("input[data-gl-notes]") as HTMLInputElement | null)?.value ?? "",
        ).trim();
        void (async () => {
          const res = await reviewGuestlistEntryAsAdmin(
            supabase,
            entryId,
            Boolean(approve),
            notes,
          );
          if (!res.ok) {
            flash(res.message, "error");
            return;
          }
          await reloadGuestlistQueue();
          flash(approve ? "Guest approved." : "Guest rejected.");
          renderDashboard();
        })();
      });
    }

    if (!nightAdjDelegationBound) {
      nightAdjDelegationBound = true;
      adminRoot.addEventListener("click", (ev) => {
        const t = ev.target as HTMLElement | null;
        if (!t) return;
        if (t.closest("[data-pna-refresh]")) {
          void reloadNightAdjQueue().then(() => {
            flash("Night queue refreshed.");
            renderDashboard();
          });
          return;
        }
        const appr = t.closest("button[data-pna-approve]") as HTMLButtonElement | null;
        const rej = t.closest("button[data-pna-reject]") as HTMLButtonElement | null;
        const act = appr ?? rej;
        if (!act) return;
        const adjId = act.dataset.pnaId?.trim();
        if (!adjId) return;
        const tr = act.closest("tr");
        const notes = String(
          (tr?.querySelector("input[data-pna-notes]") as HTMLInputElement | null)?.value ?? "",
        ).trim();
        void (async () => {
          const res = await reviewNightAdjustmentAsAdmin(
            supabase,
            adjId,
            Boolean(appr),
            notes,
          );
          if (!res.ok) {
            flash(res.message, "error");
            return;
          }
          await reloadNightAdjQueue();
          flash(appr ? "Night request approved." : "Night request rejected.");
          renderDashboard();
        })();
      });
    }

    if (!tableSaleQueueDelegationBound) {
      tableSaleQueueDelegationBound = true;
      adminRoot.addEventListener("click", (ev) => {
        const t = ev.target as HTMLElement | null;
        if (!t) return;
        if (t.closest("[data-ts-refresh]")) {
          void (async () => {
            await reloadTableSalesQueue();
            await reloadTableSalesReport();
            flash("Table sales refreshed.");
            renderDashboard();
          })();
          return;
        }
        const approve = t.closest("button[data-ts-approve]") as HTMLButtonElement | null;
        const reject = t.closest("button[data-ts-reject]") as HTMLButtonElement | null;
        const act = approve ?? reject;
        if (!act) return;
        const entryId = act.dataset.entryId?.trim();
        if (!entryId) return;
        const tr = act.closest("tr");
        const notes = String(
          (tr?.querySelector("input[data-ts-notes]") as HTMLInputElement | null)?.value ?? "",
        ).trim();
        void (async () => {
          const res = await reviewTableSaleAsAdmin(
            supabase,
            entryId,
            Boolean(approve),
            notes,
          );
          if (!res.ok) {
            flash(res.message, "error");
            return;
          }
          await reloadTableSalesQueue();
          await reloadTableSalesReport();
          flash(approve ? "Table sale approved." : "Table sale rejected.");
          renderDashboard();
        })();
      });
    }

    if (!tableSaleFormDelegationBound) {
      tableSaleFormDelegationBound = true;
      adminRoot.addEventListener("change", (ev) => {
        const el = ev.target as HTMLElement | null;
        if (el?.id !== "admin-ts-promoter") return;
        const id = (el as HTMLSelectElement).value?.trim();
        if (!id) return;
        selectedPromoterId = id;
        void (async () => {
          await reloadPromoters();
          flash("Promoter jobs reloaded for table entry.");
          renderDashboard();
        })();
      });
      adminRoot.addEventListener("click", (ev) => {
        const t = ev.target as HTMLElement | null;
        if (!t?.closest("[data-ts-report-apply]")) return;
        const form = adminRoot.querySelector("#admin-ts-report-filters") as HTMLFormElement | null;
        if (!form) return;
        const fd = new FormData(form);
        tableSalesReportFrom = String(fd.get("from") || "").trim().slice(0, 10);
        tableSalesReportTo = String(fd.get("to") || "").trim().slice(0, 10);
        tableSalesReportClub = String(fd.get("clubFilter") || "").trim();
        void (async () => {
          await reloadTableSalesReport();
          flash("Report updated.");
          renderDashboard();
        })();
      });
      adminRoot.addEventListener("submit", (ev) => {
        const form = (ev.target as HTMLElement | null)?.closest?.("#admin-ts-insert-form");
        if (!form) return;
        ev.preventDefault();
        const fd = new FormData(form as HTMLFormElement);
        const promoterId = String(fd.get("promoterId") || "").trim();
        const saleDate = String(fd.get("saleDate") || "").trim();
        const clubSlug = String(fd.get("clubSlug") || "").trim();
        const promoterJobId = String(fd.get("promoterJobId") || "").trim() || null;
        const tier = String(fd.get("tier") || "other").trim();
        const tableCount = Number(fd.get("tableCount") || 1) || 1;
        const totalMinSpend = Number(fd.get("totalMinSpend") || 0) || 0;
        const notes = String(fd.get("notes") || "").trim();
        void (async () => {
          const res = await adminInsertTableSale(supabase, {
            promoterId,
            saleDate,
            clubSlug,
            promoterJobId,
            tier,
            tableCount,
            totalMinSpend,
            notes,
          });
          if (!res.ok) {
            flash(res.message, "error");
            return;
          }
          await reloadTableSalesQueue();
          await reloadTableSalesReport();
          flash("Office table entry saved.");
          renderDashboard();
        })();
      });
    }

    if (!invoiceEdgeActionsBound) {
      invoiceEdgeActionsBound = true;
      adminRoot.addEventListener("click", (ev) => {
        const t = ev.target as HTMLElement | null;
        const pdfBtn = t?.closest("button[data-invoice-pdf]") as HTMLButtonElement | null;
        const emailBtn = t?.closest("button[data-invoice-email]") as HTMLButtonElement | null;
        const act = pdfBtn ?? emailBtn;
        if (!act) return;
        const invoiceId = act.dataset.invoiceId?.trim();
        if (!invoiceId) return;
        const anonKey =
          String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim() ||
          String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
        if (!anonKey) {
          flash("Missing anon key in env.", "error");
          return;
        }
        void (async () => {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess.session?.access_token ?? "";
          if (!token) {
            flash("Session expired — sign in again.", "error");
            return;
          }
          if (pdfBtn) {
            const res = await callPromoterInvoiceEdge(anonKey, token, invoiceId, "pdf");
            if (!res.ok) {
              flash(res.message || "PDF failed.", "error");
              return;
            }
            if (res.action !== "pdf") {
              flash("Unexpected invoice response for PDF action.", "error");
              return;
            }
            downloadPdfFromBase64(res.pdfBase64, res.filename);
            flash("PDF downloaded.");
            return;
          }
          const res = await callPromoterInvoiceEdge(anonKey, token, invoiceId, "send");
          if (!res.ok) {
            flash(res.message || "Email failed.", "error");
            return;
          }
          if (res.action !== "send") {
            flash("Unexpected invoice response for email action.", "error");
            return;
          }
          await reloadPromoters();
          flash(`Invoice emailed to ${res.emailedTo}.`);
          renderDashboard();
        })();
      });
    }

    if (!financialDelegationBound) {
      financialDelegationBound = true;
      adminRoot.addEventListener("click", (ev) => {
        const t = ev.target as HTMLElement | null;
        if (!t) return;
        if (t.closest("[data-fin-refresh]")) {
          const form = adminRoot.querySelector("#financial-period-form") as HTMLFormElement | null;
          if (form) {
            const fd = new FormData(form);
            financialPeriodFrom = String(fd.get("from") || "").trim().slice(0, 10);
            financialPeriodTo = String(fd.get("to") || "").trim().slice(0, 10);
            const d = String(fd.get("direction") || "").trim();
            financialFilterDirection = d === "income" || d === "expense" ? d : "";
            const st = String(fd.get("status") || "").trim();
            financialFilterStatus =
              st === "pending" || st === "paid" || st === "cancelled" || st === "failed" ? st : "";
            financialFilterTag = String(fd.get("paymentTag") || "").trim();
            financialFilterPayeeId = String(fd.get("payeeId") || "").trim();
          }
          void (async () => {
            await reloadFinancialReport();
            flash("Financial period refreshed.");
            renderDashboard();
          })();
          return;
        }
        if (t.closest("[data-fin-scope-apply]")) {
          const form = adminRoot.querySelector("#financial-scope-form") as HTMLFormElement | null;
          if (form) {
            const fd = new FormData(form);
            const st = String(fd.get("scopePaymentStatus") || "").trim();
            financialScopePaymentStatus =
              st === "expected" || st === "attended" || st === "paid_final" ? st : "";
            financialScopePromoterId = String(fd.get("scopePromoterId") || "").trim();
            financialScopeSearch = String(fd.get("scopeSearch") || "").trim();
          }
          renderDashboard();
          return;
        }
        if (t.closest("[data-fin-scope-reset]")) {
          financialScopePaymentStatus = "";
          financialScopePromoterId = "";
          financialScopeSearch = "";
          renderDashboard();
          return;
        }
        if (t.closest("[data-fin-export-csv]")) {
          const lines = [
            ["tx_date", "category", "direction", "amount", "currency", "source_type", "notes"].join(","),
            ...financialTransactions.map((r) =>
              [
                r.txDate,
                `"${String(r.category || "").replace(/"/g, '""')}"`,
                r.direction,
                r.amount.toFixed(2),
                r.currency,
                r.sourceType,
                `"${String(r.notes || "").replace(/"/g, '""')}"`,
              ].join(","),
            ),
          ];
          const name = `financial-${financialPeriodFrom || "from"}-to-${financialPeriodTo || "to"}.csv`;
          downloadTextFile(name, lines.join("\n"));
          flash("Financial CSV exported.");
          return;
        }
        const calNavBtn = t.closest("[data-fin-cal-nav]") as HTMLButtonElement | null;
        if (calNavBtn) {
          const action = calNavBtn.dataset.finCalNav?.trim() || "";
          let y = financialCalendarYear;
          let m = financialCalendarMonth;
          if (action === "prev-month") m -= 1;
          else if (action === "next-month") m += 1;
          else if (action === "prev-year") y -= 1;
          else if (action === "next-year") y += 1;
          else if (action === "today") {
            const now = new Date();
            y = now.getFullYear();
            m = now.getMonth();
          }
          if (m < 0) {
            y -= Math.ceil(Math.abs(m) / 12);
            m = ((m % 12) + 12) % 12;
          } else if (m > 11) {
            y += Math.floor(m / 12);
            m %= 12;
          }
          financialCalendarYear = y;
          financialCalendarMonth = m;
          financialPeriodFrom = isoLocalYmd(y, m, 1);
          financialPeriodTo = isoLocalYmd(y, m, new Date(y, m + 1, 0).getDate());
          void (async () => {
            await reloadFinancialReport();
            renderDashboard();
          })();
          return;
        }
        if (t.closest("[data-fin-bulk-apply]")) {
          const selected = Array.from(
            adminRoot.querySelectorAll<HTMLInputElement>('input[name="finTxSelect"]:checked'),
          )
            .map((x) => x.value.trim())
            .filter(Boolean);
          if (selected.length === 0) {
            flash("Select at least one ledger row first.", "error");
            return;
          }
          void (async () => {
            let changed = 0;
            for (const txId of selected) {
              const r = await saveFinancialTxPatch(txId, { status: financialBulkStatus });
              if (r.ok) changed += 1;
            }
            if (changed === 0) {
              flash("No rows were updated.", "error");
              return;
            }
            await reloadFinancialReport();
            flash(`Updated ${changed} transaction(s) to ${financialBulkStatus}.`);
            renderDashboard();
          })();
          return;
        }
        const viewModeBtn = t.closest("[data-fin-view-mode]") as HTMLButtonElement | null;
        if (viewModeBtn) {
          financialViewMode = viewModeBtn.dataset.finViewMode === "table" ? "table" : "calendar";
          renderDashboard();
          return;
        }
        const openEntry = t.closest("[data-fin-open-entry]") as HTMLButtonElement | null;
        if (openEntry) {
          financialEntryOpen = true;
          financialEntryMode = openEntry.dataset.finOpenEntry === "recurring" ? "recurring" : "one_off";
          financialEditingTxId = null;
          financialEditingTemplateId = null;
          renderDashboard();
          return;
        }
        if (t.closest("[data-fin-close-entry]")) {
          financialEntryOpen = false;
          financialEditingTxId = null;
          financialEditingTemplateId = null;
          renderDashboard();
          return;
        }
        if (t.closest("[data-fin-open-payee]")) {
          financialPayeeOpen = true;
          financialEditingPayeeId = null;
          renderDashboard();
          return;
        }
        if (t.closest("[data-fin-close-payee]")) {
          financialPayeeOpen = false;
          financialEditingPayeeId = null;
          renderDashboard();
          return;
        }
        const openRuleEditor = t.closest("[data-fin-open-rule-editor]") as HTMLButtonElement | null;
        if (openRuleEditor) {
          financialEditingRuleId = null;
          financialRuleEditorOpen = true;
          renderDashboard();
          return;
        }
        const openPromoterEditor = t.closest("[data-fin-open-promoter-editor]") as HTMLButtonElement | null;
        if (openPromoterEditor) {
          financialPromoterEditorOpen = true;
          renderDashboard();
          return;
        }
        const openBookingEditor = t.closest("[data-fin-open-booking-editor]") as HTMLButtonElement | null;
        if (openBookingEditor) {
          financialEditingBookingId = null;
          financialBookingEditorOpen = true;
          renderDashboard();
          return;
        }
        const editRuleBtn = t.closest("[data-fin-edit-rule]") as HTMLButtonElement | null;
        if (editRuleBtn) {
          const id = editRuleBtn.dataset.finEditRule?.trim() || "";
          if (!id) return;
          financialEditingRuleId = id;
          financialRuleEditorOpen = true;
          renderDashboard();
          return;
        }
        const delRuleBtn = t.closest("[data-fin-delete-rule]") as HTMLButtonElement | null;
        if (delRuleBtn) {
          const id = delRuleBtn.dataset.finDeleteRule?.trim() || "";
          if (!id) return;
          financialDeleteConfirmOpen = true;
          financialDeleteConfirmType = "rule";
          financialDeleteConfirmId = id;
          renderDashboard();
          return;
        }
        const editBookingBtn = t.closest("[data-fin-edit-booking]") as HTMLButtonElement | null;
        if (editBookingBtn) {
          const id = editBookingBtn.dataset.finEditBooking?.trim() || "";
          if (!id) return;
          financialEditingBookingId = id;
          financialBookingEditorOpen = true;
          renderDashboard();
          return;
        }
        const delBookingBtn = t.closest("[data-fin-delete-booking]") as HTMLButtonElement | null;
        if (delBookingBtn) {
          const id = delBookingBtn.dataset.finDeleteBooking?.trim() || "";
          if (!id) return;
          financialDeleteConfirmOpen = true;
          financialDeleteConfirmType = "booking";
          financialDeleteConfirmId = id;
          renderDashboard();
          return;
        }
        if (t.closest("[data-fin-delete-cancel]")) {
          financialDeleteConfirmOpen = false;
          financialDeleteConfirmType = null;
          financialDeleteConfirmId = null;
          renderDashboard();
          return;
        }
        if (t.closest("[data-fin-delete-confirm]")) {
          if (!financialDeleteConfirmType || !financialDeleteConfirmId) return;
          const id = financialDeleteConfirmId;
          const type = financialDeleteConfirmType;
          void (async () => {
            const res =
              type === "rule"
                ? await archiveFinancialRule(supabase, id)
                : await archiveFinancialBooking(supabase, id);
            if (!res.ok) {
              flash(res.message, "error");
              return;
            }
            financialDeleteConfirmOpen = false;
            financialDeleteConfirmType = null;
            financialDeleteConfirmId = null;
            await reloadFinancialReport();
            flash(type === "rule" ? "Financial rule deleted." : "Financial job deleted.");
            renderDashboard();
          })();
          return;
        }
        if (t.closest("[data-fin-close-rule-editor]")) {
          financialRuleEditorOpen = false;
          financialEditingRuleId = null;
          renderDashboard();
          return;
        }
        if (t.closest("[data-fin-close-promoter-editor]")) {
          financialPromoterEditorOpen = false;
          renderDashboard();
          return;
        }
        if (t.closest("[data-fin-close-booking-editor]")) {
          financialBookingEditorOpen = false;
          financialEditingBookingId = null;
          renderDashboard();
          return;
        }
        const payeeEdit = t.closest("[data-fin-payee-edit]") as HTMLButtonElement | null;
        if (payeeEdit) {
          const pid = payeeEdit.dataset.finPayeeEdit?.trim() || "";
          if (!pid) return;
          financialPayeeOpen = true;
          financialEditingPayeeId = pid;
          renderDashboard();
          return;
        }
        const editTx = t.closest("[data-fin-edit-tx]") as HTMLButtonElement | null;
        if (editTx) {
          const txId = editTx.dataset.finEditTx?.trim() || "";
          if (!txId) return;
          financialEntryOpen = true;
          financialEntryMode = "one_off";
          financialEditingTxId = txId;
          financialEditingTemplateId = null;
          renderDashboard();
          return;
        }
        const editBtn = t.closest("[data-fin-template-edit]") as HTMLButtonElement | null;
        if (editBtn) {
          const tid = editBtn.dataset.templateId?.trim() ?? "";
          if (!tid) return;
          financialEntryOpen = true;
          financialEntryMode = "recurring";
          financialEditingTxId = null;
          financialEditingTemplateId = tid;
          renderDashboard();
          return;
        }
        if (t.closest("[data-fin-apply-recurring]")) {
          void (async () => {
            const through = financialPeriodTo.trim() || new Date().toISOString().slice(0, 10);
            const r = await applyRecurringFinancialTransactions(supabase, through);
            if (!r.ok) {
              flash(r.message, "error");
              return;
            }
            await reloadFinancialReport();
            flash(`Recurring applied: ${r.createdRows} row(s) created.`);
            renderDashboard();
          })();
          return;
        }
        const toggleBtn = t.closest("[data-fin-template-toggle]") as HTMLButtonElement | null;
        if (toggleBtn) {
          const tid = toggleBtn.dataset.templateId?.trim() ?? "";
          if (!tid) return;
          const current = toggleBtn.dataset.active === "true";
          void (async () => {
            const r = await setFinancialRecurringTemplateActive(supabase, tid, !current);
            if (!r.ok) {
              flash(r.message, "error");
              return;
            }
            await reloadFinancialReport();
            flash(!current ? "Template activated." : "Template deactivated.");
            renderDashboard();
          })();
          return;
        }
        const delBtn = t.closest("[data-fin-template-delete]") as HTMLButtonElement | null;
        if (delBtn) {
          const tid = delBtn.dataset.templateId?.trim() ?? "";
          if (!tid) return;
          const ok = window.confirm("Delete this recurring template?");
          if (!ok) return;
          void (async () => {
            const r = await deleteFinancialRecurringTemplate(supabase, tid);
            if (!r.ok) {
              flash(r.message, "error");
              return;
            }
            await reloadFinancialReport();
            flash("Template deleted.");
            renderDashboard();
          })();
          return;
        }
        const approvalBtn = t.closest("[data-fin-approval]") as HTMLButtonElement | null;
        if (approvalBtn) {
          const requestId = approvalBtn.dataset.finApproval?.trim() || "";
          if (!requestId) return;
          const approve = approvalBtn.dataset.approve === "true";
          void (async () => {
            const res = await reviewFinancialConfigChangeRequest(supabase, {
              requestId,
              approve,
              reviewNotes: approve ? "Approved in finance panel" : "Rejected in finance panel",
            });
            if (!res.ok) {
              flash(res.message, "error");
              return;
            }
            await reloadFinancialReport();
            flash(approve ? "Change request approved." : "Change request rejected.");
            renderDashboard();
          })();
        }
      });

      adminRoot.addEventListener("change", (ev) => {
        const t = ev.target as HTMLElement | null;
        if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
        if (t.id === "fin-select-all-tx" && t instanceof HTMLInputElement) {
          const checked = t.checked;
          adminRoot
            .querySelectorAll<HTMLInputElement>('input[name="finTxSelect"]')
            .forEach((el) => {
              el.checked = checked;
            });
          return;
        }
        if (t.id === "fin-bulk-status") {
          const v = t.value.trim();
          financialBulkStatus =
            v === "pending" || v === "paid" || v === "cancelled" || v === "failed" ? v : "paid";
          return;
        }
        if (t.closest("#financial-booking-form")) {
          const form = t.closest("#financial-booking-form") as HTMLFormElement | null;
          if (!form) return;
          const fd = new FormData(form);
          const ruleId = String(fd.get("ruleId") || "").trim();
          const male = Number(fd.get("maleGuests") || 0) || 0;
          const female = Number(fd.get("femaleGuests") || 0) || 0;
          const costs = Number(fd.get("otherCosts") || 0) || 0;
          const rule = nativeFinancialRules.find((r) => r.id === ruleId);
          const previewEl = adminRoot.querySelector("#fin-booking-preview") as HTMLElement | null;
          if (previewEl && rule) {
            const totalRevenue = (male + female) * rule.baseRate;
            const totalGuests = male + female;
            const flatBonus =
              rule.bonusType === "flat" && totalGuests >= rule.bonusGoal ? rule.bonusAmount : 0;
            const stackBonus =
              rule.bonusType === "stacking" && rule.bonusGoal > 0
                ? rule.bonusAmount * Math.floor(female / rule.bonusGoal)
                : 0;
            const bonus = flatBonus > 0 ? flatBonus : stackBonus;
            const projected = totalRevenue + bonus - costs;
            previewEl.textContent = `Auto projected profit: £${projected.toFixed(2)} (revenue £${totalRevenue.toFixed(2)}, bonus £${bonus.toFixed(2)}, costs £${costs.toFixed(2)}).`;
          } else if (previewEl) {
            previewEl.textContent =
              "Projected revenue auto-calculates from base rate per guest and selected rule.";
          }
        }
      });

      adminRoot.addEventListener("dragstart", (event) => {
        const ev = event as DragEvent;
        const t = ev.target as HTMLElement | null;
        const chip = t?.closest("[data-fin-drag-tx]") as HTMLElement | null;
        if (!chip || !ev.dataTransfer) return;
        const txId = chip.getAttribute("data-fin-drag-tx")?.trim() || "";
        if (!txId) return;
        ev.dataTransfer.setData("text/plain", txId);
        ev.dataTransfer.effectAllowed = "move";
      });

      adminRoot.addEventListener("dragover", (event) => {
        const ev = event as DragEvent;
        const t = ev.target as HTMLElement | null;
        const cell = t?.closest("[data-fin-drop-date]") as HTMLElement | null;
        if (!cell) return;
        ev.preventDefault();
        cell.classList.add("fin-cal-drop-target");
      });

      adminRoot.addEventListener("dragleave", (event) => {
        const ev = event as DragEvent;
        const t = ev.target as HTMLElement | null;
        const cell = t?.closest("[data-fin-drop-date]") as HTMLElement | null;
        if (!cell) return;
        cell.classList.remove("fin-cal-drop-target");
      });

      adminRoot.addEventListener("drop", (event) => {
        const ev = event as DragEvent;
        const t = ev.target as HTMLElement | null;
        const cell = t?.closest("[data-fin-drop-date]") as HTMLElement | null;
        if (!cell || !ev.dataTransfer) return;
        ev.preventDefault();
        cell.classList.remove("fin-cal-drop-target");
        const txId = ev.dataTransfer.getData("text/plain").trim();
        const newDate = cell.getAttribute("data-fin-drop-date")?.trim() || "";
        if (!txId || !newDate) return;
        void (async () => {
          const r = await saveFinancialTxPatch(txId, { txDate: newDate });
          if (!r.ok) {
            flash(r.message, "error");
            return;
          }
          await reloadFinancialReport();
          flash(`Rescheduled transaction to ${newDate}.`);
          renderDashboard();
        })();
      });

      adminRoot.addEventListener("submit", (ev) => {
        const target = ev.target as HTMLElement | null;
        const entryForm = target?.closest?.("#financial-entry-form");
        if (entryForm) {
          ev.preventDefault();
          const fd = new FormData(entryForm as HTMLFormElement);
          const entryType = String(fd.get("entryType") || "one_off");
          const direction: FinancialDirection =
            String(fd.get("direction") || "expense").trim() === "income" ? "income" : "expense";
          const statusRaw = String(fd.get("status") || "pending").trim();
          const status: FinancialStatus =
            statusRaw === "paid" || statusRaw === "cancelled" || statusRaw === "failed" || statusRaw === "pending"
              ? statusRaw
              : "pending";
          const common = {
            txDate: String(fd.get("txDate") || "").trim(),
            category: String(fd.get("category") || "").trim(),
            direction,
            status,
            paymentTag: String(fd.get("paymentTag") || "").trim(),
            amount: Number(fd.get("amount") || 0) || 0,
            currency: String(fd.get("currency") || "GBP").trim(),
            convertForeign: String(fd.get("convertForeign") || "false").trim() === "true",
            payeeId: String(fd.get("payeeId") || "").trim() || null,
            payeeLabel: String(fd.get("payeeLabel") || "").trim(),
            notes: String(fd.get("notes") || "").trim(),
          };
          void (async () => {
            if (entryType === "recurring") {
              const templateId = String(fd.get("templateId") || "").trim();
              const recurrenceUnitRaw = String(fd.get("recurrenceUnit") || "monthly").trim();
              const recurrenceUnit =
                recurrenceUnitRaw === "monthly" ||
                recurrenceUnitRaw === "quarterly" ||
                recurrenceUnitRaw === "annual" ||
                recurrenceUnitRaw === "custom_days"
                  ? recurrenceUnitRaw
                  : "monthly";
              const rInput = {
                id: templateId || undefined,
                label: String(fd.get("category") || "").trim() || String(fd.get("paymentTag") || "").trim(),
                category: common.category,
                direction: common.direction,
                defaultStatus: common.status,
                paymentTag: common.paymentTag,
                amount: common.amount,
                currency: common.currency,
                convertForeign: common.convertForeign,
                payeeId: common.payeeId,
                payeeLabel: common.payeeLabel,
                notes: common.notes,
                intervalDays: Number(fd.get("intervalDays") || 30) || 30,
                recurrenceUnit,
                recurrenceEvery: Number(fd.get("recurrenceEvery") || 1) || 1,
                nextDueDate: common.txDate,
                isActive: String(fd.get("isActive") || "true").trim() !== "false",
              } as const;
              const res = await upsertFinancialRecurringTemplate(supabase, rInput);
              if (!res.ok) {
                flash(res.message, "error");
                return;
              }
              flash(templateId ? "Recurring template updated." : "Recurring template created.");
            } else {
              const txId = String(fd.get("txId") || "").trim();
              const res = await upsertFinancialTransaction(supabase, {
                id: txId || undefined,
                ...common,
              });
              if (!res.ok) {
                flash(res.message, "error");
                return;
              }
              flash(txId ? "Ledger entry updated." : "Ledger entry created.");
            }
            financialEntryOpen = false;
            financialEditingTxId = null;
            financialEditingTemplateId = null;
            await reloadFinancialReport();
            renderDashboard();
          })();
          return;
        }
        const payeeForm = target?.closest?.("#financial-payee-form");
        if (payeeForm) {
          ev.preventDefault();
          const fd = new FormData(payeeForm as HTMLFormElement);
          const payeeId = String(fd.get("payeeId") || "").trim();
          const payload = {
            id: payeeId || undefined,
            name: String(fd.get("name") || "").trim(),
            defaultPaymentTag: String(fd.get("defaultPaymentTag") || "").trim(),
            defaultCurrency: String(fd.get("defaultCurrency") || "GBP").trim(),
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
            notes: String(fd.get("notes") || "").trim(),
            isActive: String(fd.get("isActive") || "true").trim() !== "false",
          };
          void (async () => {
            const r = await upsertFinancialPayee(supabase, payload);
            if (!r.ok) {
              flash(r.message, "error");
              return;
            }
            financialPayeeOpen = false;
            financialEditingPayeeId = null;
            await reloadFinancialReport();
            flash(payeeId ? "Payee updated." : "Payee created.");
            renderDashboard();
          })();
          return;
        }
        const ruleForm = target?.closest?.("#financial-rule-form");
        if (ruleForm) {
          ev.preventDefault();
          const fd = new FormData(ruleForm as HTMLFormElement);
          void (async () => {
            const res = await upsertFinancialRule(supabase, {
              id: financialEditingRuleId || undefined,
              department: String(fd.get("department") || "other").trim() as
                | "nightlife"
                | "transport"
                | "protection"
                | "other",
              clubSlug: String(fd.get("clubSlug") || "").trim() || null,
              venueOrServiceName: String(fd.get("venueOrServiceName") || "").trim(),
              logicType: String(fd.get("logicType") || "flat_fee").trim() as
                | "headcount_pay"
                | "commission_percent"
                | "flat_fee",
              maleRate: Number(fd.get("maleRate") || 0) || 0,
              femaleRate: Number(fd.get("femaleRate") || 0) || 0,
              baseRate: Number(fd.get("baseRate") || 0) || 0,
              bonusType: String(fd.get("bonusType") || "none").trim() as
                | "none"
                | "flat"
                | "stacking",
              bonusGoal: Number(fd.get("bonusGoal") || 0) || 0,
              bonusAmount: Number(fd.get("bonusAmount") || 0) || 0,
              effectiveFrom: String(fd.get("effectiveFrom") || "").trim(),
            });
            if (!res.ok) {
              flash(res.message, "error");
              return;
            }
            financialRuleEditorOpen = false;
            financialEditingRuleId = null;
            await reloadFinancialReport();
            flash("Financial rule saved.");
            renderDashboard();
          })();
          return;
        }
        const promoterForm = target?.closest?.("#financial-promoter-form");
        if (promoterForm) {
          ev.preventDefault();
          const fd = new FormData(promoterForm as HTMLFormElement);
          void (async () => {
            const res = await upsertFinancialPromoter(supabase, {
              userId: String(fd.get("userId") || "").trim() || null,
              name: String(fd.get("name") || "").trim(),
              commissionPercentage: Number(fd.get("commissionPercentage") || 0) || 0,
              contact: String(fd.get("contact") || "").trim(),
              notes: String(fd.get("notes") || "").trim(),
            });
            if (!res.ok) {
              flash(res.message, "error");
              return;
            }
            financialPromoterEditorOpen = false;
            await reloadFinancialReport();
            flash("Financial promoter saved.");
            renderDashboard();
          })();
          return;
        }
        const bookingForm = target?.closest?.("#financial-booking-form");
        if (bookingForm) {
          ev.preventDefault();
          const fd = new FormData(bookingForm as HTMLFormElement);
          const department = String(fd.get("department") || "nightlife").trim();
          void (async () => {
            const bookingReference = String(fd.get("bookingReference") || "").trim();
            const bookingDate = String(fd.get("bookingDate") || "").trim();
            const clubSlug = String(fd.get("clubSlug") || "").trim() || null;
            const promoterId = String(fd.get("promoterId") || "").trim() || null;
            const venueOrServiceName = String(fd.get("venueOrServiceName") || "").trim();
            const paymentStatus = String(fd.get("paymentStatus") || "expected").trim() as
              | "expected"
              | "attended"
              | "paid_final";
            if (department === "nightlife") {
              const ruleId = String(fd.get("ruleId") || "").trim();
              const res = await upsertNightlifeFinancialBooking(supabase, {
                id: financialEditingBookingId || undefined,
                bookingReference,
                bookingDate,
                clubSlug,
                promoterId,
                clientId: null,
                ruleId,
                venueOrServiceName,
                maleGuests: Number(fd.get("maleGuests") || 0) || 0,
                femaleGuests: Number(fd.get("femaleGuests") || 0) || 0,
                otherCosts: Number(fd.get("otherCosts") || 0) || 0,
                paymentStatus,
              });
              if (!res.ok) {
                flash(res.message, "error");
                return;
              }
            } else {
              const res = await upsertServiceFinancialBooking(supabase, {
                id: financialEditingBookingId || undefined,
                bookingReference,
                bookingDate,
                clubSlug,
                department: (department === "transport" || department === "protection"
                  ? department
                  : "other") as "transport" | "protection" | "other",
                promoterId,
                clientId: null,
                ruleId: String(fd.get("ruleId") || "").trim() || null,
                venueOrServiceName,
                totalSpend: Number(fd.get("totalSpend") || 0) || 0,
                commissionPercentage: Number(fd.get("commissionPercentage") || 0) || 0,
                paymentStatus,
              });
              if (!res.ok) {
                flash(res.message, "error");
                return;
              }
            }
            financialBookingEditorOpen = false;
            financialEditingBookingId = null;
            await reloadFinancialReport();
            flash("Financial booking saved.");
            renderDashboard();
          })();
        }
      });
    }

    adminRoot.querySelectorAll(".admin-view-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = (btn as HTMLButtonElement).dataset.view as AdminView | undefined;
        if (!v) return;
        view = v;
        adminNavExpanded =
          v === "admin_profile"
            ? "account"
            : v === "enquiries" || v === "clients"
              ? "enquiries"
              : v === "club_accounts" || v === "club_edits" || v === "job_disputes"
                ? "clubs"
              : v === "clubs" || v === "cars" || v === "flyers"
                ? "website"
                : "promoters";
        if (v === "enquiries") void reloadEnquiries().then(() => renderDashboard());
        else if (v === "clients") void reloadClients().then(() => renderDashboard());
        else if (v === "promoter_requests")
          void reloadPromoterSignupRequests().then(() => renderDashboard());
        else if (v === "promoters" || v === "jobs" || v === "invoices")
          void (async () => {
            await reloadPromoters();
            if (v === "jobs") await reloadJobsCalendar();
            renderDashboard();
          })();
        else if (v === "guestlist_queue")
          void reloadGuestlistQueue().then(() => renderDashboard());
        else if (v === "night_adjustments")
          void reloadNightAdjQueue().then(() => renderDashboard());
        else if (v === "table_sales")
          void (async () => {
            await reloadPromoters();
            await reloadTableSalesQueue();
            await reloadTableSalesReport();
            renderDashboard();
          })();
        else if (v === "financials")
          void reloadFinancialReport().then(() => renderDashboard());
        else if (v === "club_accounts")
          void reloadClubAccounts().then(() => renderDashboard());
        else if (v === "club_edits")
          void reloadClubRevisions().then(() => renderDashboard());
        else if (v === "job_disputes")
          void reloadClubDisputes().then(() => renderDashboard());
        else renderDashboard();
      });
    });
    adminRoot.querySelectorAll("[data-admin-nav-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const section = (btn as HTMLButtonElement).dataset
          .adminNavToggle as AdminNavSection | undefined;
        if (!section) return;
        adminNavExpanded = adminNavExpanded === section ? "enquiries" : section;
        renderDashboard();
      });
    });
    const adminAccountBtn = adminRoot.querySelector("#admin-account-btn") as HTMLButtonElement | null;
    const adminAccountMenu = adminRoot.querySelector("#admin-account-menu") as HTMLElement | null;
    const setAdminAccountOpen = (open: boolean): void => {
      if (!adminAccountBtn || !adminAccountMenu) return;
      adminAccountBtn.setAttribute("aria-expanded", String(open));
      adminAccountMenu.hidden = !open;
    };
    adminAccountBtn?.addEventListener("click", () => {
      const open = adminAccountBtn.getAttribute("aria-expanded") === "true";
      setAdminAccountOpen(!open);
    });
    adminAccountMenu?.addEventListener("click", (ev) => {
      const target = (ev.target as HTMLElement | null)?.closest(
        "[data-admin-menu-view], #admin-account-signout",
      ) as HTMLElement | null;
      if (!target) return;
      if (target.id === "admin-account-signout") {
        void signOutAdmin(supabase).then(() => renderLogin());
        return;
      }
      const v = target.getAttribute("data-admin-menu-view") as AdminView | null;
      if (!v) return;
      view = v;
      renderDashboard();
    });
    adminRoot.querySelectorAll("[data-admin-menu-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = (btn as HTMLElement).getAttribute("data-admin-menu-view") as
          | AdminView
          | null;
        if (!v) return;
        view = v;
        adminNavExpanded =
          v === "admin_profile"
            ? "account"
            : v === "enquiries" || v === "clients"
              ? "enquiries"
              : v === "club_accounts" || v === "club_edits" || v === "job_disputes"
                ? "clubs"
              : v === "clubs" || v === "cars" || v === "flyers"
                ? "website"
                : "promoters";
        renderDashboard();
      });
    });
    adminRoot.querySelector("#admin-profile-form")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const form = ev.target as HTMLFormElement;
      const fd = new FormData(form);
      const email = String(fd.get("email") || "")
        .trim()
        .toLowerCase();
      const username = String(fd.get("username") || "").trim();
      const password = String(fd.get("password") || "").trim();
      const passwordConfirm = String(fd.get("passwordConfirm") || "").trim();

      if (!adminProfile.userId) {
        flash("Missing admin session context. Reload and try again.", "error");
        return;
      }
      if (!email) {
        flash("Email is required.", "error");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        flash("Enter a valid email address.", "error");
        return;
      }
      if (!username) {
        flash("Username is required.", "error");
        return;
      }
      if (password && password.length < 8) {
        flash("New password must be at least 8 characters.", "error");
        return;
      }
      if (password && password !== passwordConfirm) {
        flash("Password confirmation does not match.", "error");
        return;
      }

      const emailChanged = email !== adminProfile.email;
      const usernameChanged = username !== adminProfile.username;
      const passwordChanged = Boolean(password);
      if (!emailChanged && !usernameChanged && !passwordChanged) {
        flash("No profile changes to save.");
        return;
      }

      const saveBtn = form.querySelector("#admin-save-profile-settings") as HTMLButtonElement | null;
      if (saveBtn) saveBtn.disabled = true;
      void (async () => {
        const { data: profileRow, error: profileReadError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", adminProfile.userId)
          .maybeSingle();
        if (profileReadError) {
          flash(`Could not verify admin profile: ${profileReadError.message}`, "error");
          if (saveBtn) saveBtn.disabled = false;
          return;
        }
        const role = String(profileRow?.role || "admin");
        const { error: profileWriteError } = await supabase.from("profiles").upsert(
          {
            id: adminProfile.userId,
            role,
            display_name: username,
          },
          { onConflict: "id" },
        );
        if (profileWriteError) {
          flash(`Could not save username to profile: ${profileWriteError.message}`, "error");
          if (saveBtn) saveBtn.disabled = false;
          return;
        }

        const authPayload: {
          email?: string;
          password?: string;
          data?: Record<string, unknown>;
        } = {};
        if (emailChanged) authPayload.email = email;
        if (passwordChanged) authPayload.password = password;
        if (usernameChanged) {
          authPayload.data = {
            username,
            display_name: username,
          };
        }
        if (Object.keys(authPayload).length) {
          const { error: authError } = await supabase.auth.updateUser(authPayload);
          if (authError) {
            flash(`Could not update auth settings: ${authError.message}`, "error");
            if (saveBtn) saveBtn.disabled = false;
            return;
          }
        }

        adminProfile = {
          ...adminProfile,
          email,
          username,
        };
        flash(
          emailChanged
            ? "Profile saved. Check your inbox to confirm the new email if required."
            : "Profile settings updated.",
        );
        renderDashboard();
      })().finally(() => {
        if (saveBtn) saveBtn.disabled = false;
      });
    });

    adminRoot.querySelector("#admin-logout")?.addEventListener("click", () => {
      void signOutAdmin(supabase).then(() => renderLogin());
    });

    adminRoot.querySelector("#admin-reload-db")?.addEventListener("click", () => {
      void (async () => {
        await reloadAllFromDb();
        flash("Reloaded from database.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#admin-export-json")?.addEventListener("click", () => {
      downloadTextFile(
        "clubs.json",
        JSON.stringify(clubEntries.map((e) => e.club), null, 2),
      );
      downloadTextFile(
        "cars.json",
        JSON.stringify(carEntries.map((e) => e.car), null, 2),
      );
      flash("Exported clubs.json and cars.json.");
    });

    adminRoot.querySelector("#admin-export-clubs-csv")?.addEventListener("click", () => {
      downloadTextFile(
        "clubs.csv",
        asClubsCsv(clubEntries.map((e) => e.club)),
      );
      flash("Exported clubs.csv.");
    });

    adminRoot.querySelector("#admin-save-club")?.addEventListener("click", () => {
      const c = clubEntries[selectedClub]?.club;
      if (!c) return;
      const v = validateClubShape(c);
      if (v.length) {
        flash(v.join(" "), "error");
        return;
      }
      void (async () => {
        const res = await upsertClubToDb(supabase, c, {
          sortOrder: selectedClub + 1,
          isActive: true,
        });
        if (!res.ok) {
          flash(`Save failed: ${res.message}`, "error");
          return;
        }
        await syncClubIdsFromDb();
        flash("Club saved to database.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#admin-save-all-clubs")?.addEventListener("click", () => {
      void (async () => {
        for (const e of clubEntries) {
          const v = validateClubShape(e.club);
          if (v.length) {
            flash(`Fix “${e.club.slug}”: ${v.join(" ")}`, "error");
            return;
          }
        }
        const res = await upsertAllClubsOrder(
          supabase,
          clubEntries.map((e) => e.club),
        );
        if (!res.ok) {
          flash(`Save failed: ${res.message}`, "error");
          return;
        }
        await syncClubIdsFromDb();
        flash("All clubs saved.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#admin-save-car")?.addEventListener("click", () => {
      const c = carEntries[selectedCar]?.car;
      if (!c) return;
      const v = validateCarShape(c);
      if (v.length) {
        flash(v.join(" "), "error");
        return;
      }
      void (async () => {
        const res = await upsertCarToDb(supabase, c, {
          sortOrder: c.order || selectedCar + 1,
          isActive: true,
        });
        if (!res.ok) {
          flash(`Save failed: ${res.message}`, "error");
          return;
        }
        await syncCarIdsFromDb();
        flash("Car saved to database.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#admin-save-all-cars")?.addEventListener("click", () => {
      void (async () => {
        for (const e of carEntries) {
          const v = validateCarShape(e.car);
          if (v.length) {
            flash(`Fix “${e.car.slug}”: ${v.join(" ")}`, "error");
            return;
          }
        }
        const res = await upsertAllCarsOrder(
          supabase,
          carEntries.map((e) => e.car),
        );
        if (!res.ok) {
          flash(`Save failed: ${res.message}`, "error");
          return;
        }
        await syncCarIdsFromDb();
        flash("All cars saved.");
        renderDashboard();
      })();
    });

    const listEl = adminRoot.querySelector("#admin-list");
    if (listEl) {
      const listHost = listEl as HTMLElement;
      if (view === "enquiries") {
        listEl.className = "admin-list";
        const q = listSearch.trim().toLowerCase();
        const filteredRows = enquiries.filter((e) => {
          if (!q) return true;
          const hay = [
            e.name,
            e.email,
            e.phone,
            e.form_label,
            e.status,
            e.created_at,
            e.submitted_at,
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
        if (!filteredRows.length) {
          listEl.innerHTML = `<p class="admin-note">No enquiries yet.</p>`;
        } else {
          if (listViewMode === "grid") {
            listEl.innerHTML = `<div class="pp-kpi-grid">${filteredRows
              .map((e) => {
                const date = e.submitted_at?.slice(0, 10) || e.created_at?.slice(0, 10) || "—";
                const active = e.id === selectedEnquiry ? " is-active" : "";
                return `<button type="button" class="pp-card${active}" data-enquiry-id="${escapeAttr(e.id)}" style="text-align:left;cursor:pointer">
                  <p class="pp-kpi__label">${escapeAttr(e.form_label)}</p>
                  <h4 class="pp-card__title">${escapeAttr(adminDisplayTruncate(e.name || e.email || "Enquiry", 28))}</h4>
                  <p class="admin-note">${escapeAttr(date)} · ${escapeAttr(e.status)}</p>
                </button>`;
              })
              .join("")}</div>`;
            listEl.querySelectorAll<HTMLElement>("[data-enquiry-id]").forEach((row) => {
              row.addEventListener("click", () => {
                const id = row.dataset.enquiryId ?? null;
                selectedEnquiry = id;
                void (async () => {
                  if (id) {
                    const g = await loadEnquiryGuests(supabase, id);
                    enquiryGuests = g.ok ? g.rows : [];
                  } else enquiryGuests = [];
                  renderDashboard();
                })();
              });
            });
          } else if (listViewMode === "calendar") {
            const byDate = new Map<string, number>();
            for (const e of filteredRows) {
              const date = e.submitted_at?.slice(0, 10) || e.created_at?.slice(0, 10) || "";
              if (!date) continue;
              byDate.set(date, (byDate.get(date) ?? 0) + 1);
            }
            const days = Array.from(byDate.entries())
              .sort(([a], [b]) => (a < b ? 1 : -1))
              .map(
                ([date, count]) =>
                  `<button type="button" class="pp-card" data-enquiry-day="${escapeAttr(date)}" style="text-align:left;cursor:pointer"><p class="pp-kpi__label">${escapeAttr(date)}</p><h4 class="pp-card__title">${count} enquiry${count === 1 ? "" : "ies"}</h4></button>`,
              )
              .join("");
            listEl.innerHTML = `<div class="pp-kpi-grid">${days || `<p class="admin-note">No dated enquiries in current filter.</p>`}</div>`;
            listEl.querySelectorAll<HTMLElement>("[data-enquiry-day]").forEach((btn) => {
              btn.addEventListener("click", () => {
                const date = btn.dataset.enquiryDay ?? "";
                const first = filteredRows.find(
                  (e) =>
                    (e.submitted_at?.slice(0, 10) || e.created_at?.slice(0, 10) || "") === date,
                );
                if (!first) return;
                selectedEnquiry = first.id;
                void (async () => {
                  const g = await loadEnquiryGuests(supabase, first.id);
                  enquiryGuests = g.ok ? g.rows : [];
                  renderDashboard();
                })();
              });
            });
          } else {
          listEl.innerHTML = "";
          mountDataTable(listHost, {
            id: "admin-enquiries",
            rows: filteredRows,
            rowId: (e) => e.id,
            activeRowId: selectedEnquiry,
            columns: [
              {
                key: "date",
                label: "Date",
                sortable: true,
                accessor: (e) => e.submitted_at?.slice(0, 10) || e.created_at?.slice(0, 10) || "—",
              },
              {
                key: "form",
                label: "Form",
                sortable: true,
                accessor: (e) => e.form_label,
                render: (e) => escapeAttr(adminDisplayTruncate(e.form_label, 36)),
              },
              {
                key: "status",
                label: "Status",
                sortable: true,
                accessor: (e) => e.status,
                render: (e) => renderStatusBadge(e.status),
              },
              {
                key: "contact",
                label: "Contact",
                accessor: (e) => [e.name, e.email, e.phone].filter(Boolean).join(" · ") || "—",
                render: (e) => {
                  const contact = [e.name, e.email, e.phone].filter(Boolean).join(" · ") || "—";
                  return escapeAttr(adminDisplayTruncate(contact, 42));
                },
              },
              {
                key: "actions",
                label: "Actions",
                render: (e) =>
                  `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-edit="${escapeAttr(e.id)}">Edit</button>
                   <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-delete="${escapeAttr(e.id)}">Delete</button>`,
              },
            ],
            onRowClick: (row) => {
              const id = row.id ?? null;
            selectedEnquiry = id;
            void (async () => {
              if (id) {
                const g = await loadEnquiryGuests(supabase, id);
                enquiryGuests = g.ok ? g.rows : [];
              } else enquiryGuests = [];
              renderDashboard();
            })();
            },
          });
          }
        }
      } else if (view === "clients") {
        listEl.className = "admin-list";
        if (!clients.length) {
          listEl.innerHTML = `<p class="admin-note">No clients yet.</p>`;
        } else {
          listEl.innerHTML = "";
          mountDataTable(listHost, {
            id: "admin-clients",
            rows: clients,
            rowId: (c) => c.id,
            activeRowId: selectedClientId,
            columns: [
              {
                key: "name",
                label: "Name / handle",
                sortable: true,
                accessor: (c) => c.name || c.email || c.phone || c.instagram || c.id.slice(0, 8),
                render: (c) => {
                  const label = c.name || c.email || c.phone || c.instagram || c.id.slice(0, 8);
                  return escapeAttr(adminDisplayTruncate(label, 40));
                },
              },
              {
                key: "email",
                label: "Email",
                sortable: true,
                accessor: (c) => c.email || "—",
                render: (c) => escapeAttr(adminDisplayTruncate(c.email || "—", 36)),
              },
              {
                key: "created",
                label: "Added",
                sortable: true,
                accessor: (c) => c.created_at?.slice(0, 10) || "—",
              },
              {
                key: "actions",
                label: "Actions",
                render: (c) =>
                  `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-edit="${escapeAttr(c.id)}">Edit</button>
                   <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-delete="${escapeAttr(c.id)}">Delete</button>`,
              },
            ],
            onRowClick: (row) => {
              selectedClientId = row.id ?? null;
              void reloadClients().then(() => renderDashboard());
            },
          });
        }
      } else if (view === "promoter_requests") {
        listEl.className = "admin-list";
        if (!promoterSignupRequests.length) {
          listEl.innerHTML = `<p class="admin-note">No requests.</p>`;
        } else {
          listEl.innerHTML = "";
          mountDataTable(listHost, {
            id: "admin-promoter-requests",
            rows: promoterSignupRequests,
            rowId: (q) => q.id,
            activeRowId: selectedPromoterRequestId,
            columns: [
              {
                key: "status",
                label: "Status",
                sortable: true,
                accessor: (q) => q.status,
                render: (q) => renderStatusBadge(q.status),
              },
              {
                key: "name",
                label: "Name",
                sortable: true,
                accessor: (q) => q.fullName,
                render: (q) => escapeAttr(adminDisplayTruncate(q.fullName, 28)),
              },
              {
                key: "email",
                label: "Email",
                sortable: true,
                accessor: (q) => q.email,
                render: (q) => escapeAttr(adminDisplayTruncate(q.email, 40)),
              },
              {
                key: "requested",
                label: "Requested",
                sortable: true,
                accessor: (q) => q.createdAt.slice(0, 10),
              },
              {
                key: "actions",
                label: "Actions",
                render: (q) =>
                  `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-edit="${escapeAttr(q.id)}">Edit</button>
                   <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-delete="${escapeAttr(q.id)}">Delete</button>`,
              },
            ],
            onRowClick: (row) => {
              selectedPromoterRequestId = row.id ?? null;
              renderDashboard();
            },
          });
        }
      } else if (view === "promoters" || view === "jobs" || view === "invoices") {
        listEl.className = "admin-list";
        if (!promoters.length) {
          listEl.innerHTML = `<p class="admin-note">No promoters loaded.</p>`;
        } else {
          listEl.innerHTML = "";
          mountDataTable(listHost, {
            id: "admin-promoters",
            rows: promoters,
            rowId: (p) => p.id,
            activeRowId: selectedPromoterId,
            columns: [
              {
                key: "photo",
                label: "",
                width: "56px",
                render: (p) =>
                  p.profileImageUrl
                    ? `<img src="${escapeAttr(p.profileImageUrl)}" alt="" style="width:34px;height:34px;border-radius:999px;object-fit:cover;border:1px solid var(--portal-border)" />`
                    : `<span class="pp-avatar pp-avatar--sm">${escapeAttr((p.displayName || p.userId || "?").charAt(0).toUpperCase())}</span>`,
              },
              {
                key: "promoter",
                label: "Promoter",
                sortable: true,
                accessor: (p) => p.displayName || p.userId,
                render: (p) => escapeAttr(adminDisplayTruncate(p.displayName || p.userId, 32)),
              },
              {
                key: "approval",
                label: "Approval",
                sortable: true,
                accessor: (p) => p.approvalStatus,
                render: (p) => renderStatusBadge(p.approvalStatus),
              },
              {
                key: "actions",
                label: "Actions",
                render: (p) =>
                  `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-edit="${escapeAttr(p.id)}">Edit</button>
                   <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-delete="${escapeAttr(p.id)}">Delete</button>`,
              },
            ],
            onRowClick: (row) => {
              selectedPromoterId = row.id ?? null;
              void (async () => {
                await reloadPromoters();
                if (view === "jobs") await reloadJobsCalendar();
                renderDashboard();
              })();
            },
          });
        }
      } else if (view === "club_accounts") {
        listEl.className = "admin-list";
        if (!clubAccounts.length) {
          listEl.innerHTML = `<p class="admin-note">No club accounts yet.</p>`;
        } else {
          listEl.innerHTML = "";
          mountDataTable(listHost, {
            id: "admin-club-accounts",
            rows: clubAccounts,
            rowId: (a) => a.id,
            activeRowId: selectedClubAccountId,
            columns: [
              { key: "club", label: "Club", sortable: true, accessor: (a) => a.club_slug },
              { key: "role", label: "Role", sortable: true, accessor: (a) => a.role },
              {
                key: "status",
                label: "Status",
                sortable: true,
                accessor: (a) => a.status,
                render: (a) => renderStatusBadge(a.status),
              },
              {
                key: "actions",
                label: "Actions",
                render: (a) =>
                  `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-edit="${escapeAttr(a.id)}">Edit</button>
                   <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-delete="${escapeAttr(a.id)}">Delete</button>`,
              },
            ],
            onRowClick: (row) => {
              selectedClubAccountId = row.id ?? null;
              renderDashboard();
            },
          });
        }
      } else if (view === "club_edits") {
        listEl.className = "admin-list";
        if (!clubEditRevisions.length) {
          listEl.innerHTML = `<p class="admin-note">No club edit revisions yet.</p>`;
        } else {
          listEl.innerHTML = "";
          mountDataTable(listHost, {
            id: "admin-club-edits",
            rows: clubEditRevisions,
            rowId: (r) => r.id,
            activeRowId: selectedClubRevisionId,
            columns: [
              { key: "club", label: "Club", sortable: true, accessor: (r) => r.club_slug },
              { key: "target", label: "Target", sortable: true, accessor: (r) => r.target_type },
              {
                key: "status",
                label: "Status",
                sortable: true,
                accessor: (r) => r.status,
                render: (r) => renderStatusBadge(r.status),
              },
              {
                key: "actions",
                label: "Actions",
                render: (r) =>
                  `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-edit="${escapeAttr(r.id)}">Edit</button>
                   <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-delete="${escapeAttr(r.id)}">Delete</button>`,
              },
            ],
            onRowClick: (row) => {
              selectedClubRevisionId = row.id ?? null;
              renderDashboard();
            },
          });
        }
      } else if (view === "job_disputes") {
        listEl.className = "admin-list";
        if (!clubJobDisputes.length) {
          listEl.innerHTML = `<p class="admin-note">No disputes found.</p>`;
        } else {
          listEl.innerHTML = "";
          mountDataTable(listHost, {
            id: "admin-job-disputes",
            rows: clubJobDisputes,
            rowId: (d) => d.id,
            activeRowId: selectedClubDisputeId,
            columns: [
              { key: "club", label: "Club", sortable: true, accessor: (d) => d.club_slug },
              { key: "reason", label: "Reason", sortable: true, accessor: (d) => d.reason_code },
              {
                key: "status",
                label: "Status",
                sortable: true,
                accessor: (d) => d.status,
                render: (d) => renderStatusBadge(d.status),
              },
              {
                key: "actions",
                label: "Actions",
                render: (d) =>
                  `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-edit="${escapeAttr(d.id)}">Edit</button>
                   <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-row-delete="${escapeAttr(d.id)}">Delete</button>`,
              },
            ],
            onRowClick: (row) => {
              selectedClubDisputeId = row.id ?? null;
              renderDashboard();
            },
          });
        }
      } else if (view === "guestlist_queue") {
        listEl.className = "admin-list";
        listEl.innerHTML = `<p class="admin-note">${guestlistQueueRows.length} pending name(s). Open <strong>Guestlist</strong> in the sidebar if you switched away.</p>`;
      } else if (view === "night_adjustments") {
        listEl.className = "admin-list";
        listEl.innerHTML = `<p class="admin-note">${nightAdjQueueRows.length} pending night request(s).</p>`;
      } else if (view === "table_sales") {
        listEl.className = "admin-list";
        listEl.innerHTML = `<p class="admin-note">${tableSalesQueueRows.length} pending table submission(s). Use <strong>Tables</strong> for review, office entry, and the dated report.</p>`;
      } else if (view === "financials") {
        listEl.className = "admin-list";
        listEl.innerHTML = `<p class="admin-note">Financial reporting is generated from \`financial_transactions\`.</p>`;
      } else if (view === "flyers") {
        listEl.className = "admin-list admin-list--table";
        const activeIndex = selectedFlyer;
        if (!flyers.length) {
          listEl.innerHTML = `<p class="admin-note">No flyers. Add one below.</p>`;
        } else {
          const rows = flyers
            .map((f, i) => {
              const active = i === activeIndex ? " is-active" : "";
              return `<tr class="admin-list-row${active}" data-i="${i}" tabindex="0" role="button">
                <td>${escapeAttr(adminDisplayTruncate(f.clubSlug, 24))}</td>
                <td>${escapeAttr(f.eventDate)}</td>
                <td class="admin-list-col--wide">${escapeAttr(adminDisplayTruncate(f.title, 36))}</td>
              </tr>`;
            })
            .join("");
          listEl.innerHTML = adminListTableWrap(
            `<thead><tr>
              <th scope="col">Club</th>
              <th scope="col">Event date</th>
              <th scope="col">Title</th>
            </tr></thead><tbody>${rows}</tbody>`,
          );
          bindAdminListRows(listEl, "tr[data-i]", (row) => {
            selectedFlyer = Number(row.dataset.i ?? "0");
            renderDashboard();
          });
        }
      } else if (view === "admin_profile") {
        listEl.className = "admin-list";
        listEl.innerHTML = `<p class="admin-note">Profile settings only. Website editors (clubs/cars/flyers) appear under the Website section.</p>`;
      } else {
        const isClubs = view === "clubs";
        const items = isClubs ? clubEntries : carEntries;
        const activeIndex = isClubs ? selectedClub : selectedCar;
        listEl.className = "admin-list";
        const q = listSearch.trim().toLowerCase();
        const filtered = items
          .map((entry, idx) => ({ entry, idx }))
          .filter(({ entry }) => {
            if (!q) return true;
            const slug = isClubs
              ? (entry as ClubEntry).club.slug
              : (entry as CarEntry).car.slug;
            const name = isClubs
              ? (entry as ClubEntry).club.name
              : (entry as CarEntry).car.name;
            return `${slug} ${name}`.toLowerCase().includes(q);
          });
        if (!filtered.length) {
          listEl.innerHTML = `<p class="admin-note">No items yet.</p>`;
        } else {
          listEl.innerHTML = "";
          mountDataTable(listHost, {
            id: isClubs ? "admin-clubs-list" : "admin-cars-list",
            rows: filtered,
            rowId: (r) => String(r.idx),
            activeRowId: String(activeIndex),
            columns: [
              {
                key: "image",
                label: "",
                width: "64px",
                render: ({ entry }) => {
                  const image = isClubs
                    ? (entry as ClubEntry).club.images?.[0]
                    : (entry as CarEntry).car.images?.[0];
                  if (image) {
                    return `<img src="${escapeAttr(image)}" alt="" style="width:44px;height:30px;border-radius:8px;object-fit:cover;border:1px solid var(--portal-border)" />`;
                  }
                  return `<span class="pp-avatar pp-avatar--sm">•</span>`;
                },
              },
              {
                key: "slug",
                label: "Slug",
                sortable: true,
                accessor: ({ entry }) =>
                  isClubs
                    ? (entry as ClubEntry).club.slug
                    : (entry as CarEntry).car.slug,
                render: ({ entry }) => {
                  const slug = isClubs
                    ? (entry as ClubEntry).club.slug
                    : (entry as CarEntry).car.slug;
                  return `<code class="admin-list-code">${escapeAttr(slug)}</code>`;
                },
              },
              {
                key: "name",
                label: "Name",
                sortable: true,
                accessor: ({ entry }) =>
                  isClubs
                    ? (entry as ClubEntry).club.name
                    : (entry as CarEntry).car.name,
                render: ({ entry }) => {
                  const name = isClubs
                    ? (entry as ClubEntry).club.name
                    : (entry as CarEntry).car.name;
                  return escapeAttr(adminDisplayTruncate(name, 40));
                },
              },
              {
                key: "actions",
                label: "Actions",
                render: ({ idx }) =>
                  `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-item-edit="${idx}">Edit</button>
                   <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-item-delete="${idx}">Delete</button>`,
              },
            ],
            onRowClick: (row) => {
              if (isClubs) selectedClub = row.idx;
              else selectedCar = row.idx;
              renderDashboard();
            },
          });
          listEl.querySelectorAll<HTMLElement>("[data-item-edit]").forEach((btn) => {
            btn.addEventListener("click", (ev) => {
              ev.stopPropagation();
              const i = Number((btn as HTMLElement).getAttribute("data-item-edit") || "0");
              if (isClubs) selectedClub = i;
              else selectedCar = i;
              if (isClubs) clubFormOpen = true;
              else carFormOpen = true;
              renderDashboard();
            });
          });
          listEl.querySelectorAll<HTMLElement>("[data-item-delete]").forEach((btn) => {
            btn.addEventListener("click", (ev) => {
              ev.stopPropagation();
              const i = Number((btn as HTMLElement).getAttribute("data-item-delete") || "0");
              if (isClubs) {
                selectedClub = i;
                (adminRoot.querySelector("#admin-delete") as HTMLButtonElement | null)?.click();
              } else {
                selectedCar = i;
                (adminRoot.querySelector("#admin-delete") as HTMLButtonElement | null)?.click();
              }
            });
          });
        }
      }
    }

    adminRoot.querySelectorAll<HTMLElement>("[data-admin-row-edit]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const id = String(btn.getAttribute("data-admin-row-edit") || "").trim();
        if (!id) return;
        if (view === "enquiries") selectedEnquiry = id;
        else if (view === "clients") selectedClientId = id;
        else if (view === "promoter_requests") selectedPromoterRequestId = id;
        else if (view === "promoters" || view === "jobs" || view === "invoices")
          selectedPromoterId = id;
        else if (view === "club_accounts") selectedClubAccountId = id;
        else if (view === "club_edits") selectedClubRevisionId = id;
        else if (view === "job_disputes") selectedClubDisputeId = id;
        if (view === "clubs") clubFormOpen = true;
        if (view === "cars") carFormOpen = true;
        if (view === "flyers") flyerFormOpen = true;
        if (view === "admin_profile") adminProfileFormOpen = true;
        if (view === "invoices") invoiceFormOpen = true;
        if (view === "club_accounts") clubAccountsFormOpen = true;
        renderDashboard();
      });
    });
    adminRoot.querySelectorAll<HTMLElement>("[data-admin-row-delete]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const id = String(btn.getAttribute("data-admin-row-delete") || "").trim();
        if (!id) return;
        if (view === "clients") {
          selectedClientId = id;
          (adminRoot.querySelector("#admin-delete-client") as HTMLButtonElement | null)?.click();
          return;
        }
        if (view === "jobs" || view === "promoters" || view === "invoices") {
          selectedPromoterId = id;
          flash("Delete for this row type is not enabled in this phase.", "error");
          return;
        }
        if (view === "club_accounts") {
          selectedClubAccountId = id;
          flash("Delete for club accounts is not enabled in this phase.", "error");
          return;
        }
        if (view === "club_edits") {
          selectedClubRevisionId = id;
          flash("Delete for club revisions is not enabled in this phase.", "error");
          return;
        }
        if (view === "job_disputes") {
          selectedClubDisputeId = id;
          flash("Delete for disputes is not enabled in this phase.", "error");
          return;
        }
        if (view === "enquiries" || view === "promoter_requests") {
          flash("Delete for this row type is not enabled in this phase.", "error");
        }
      });
    });

    adminRoot.querySelector("#admin-list-search")?.addEventListener("input", (ev) => {
      listSearch = String((ev.target as HTMLInputElement).value || "");
      renderDashboard();
    });
    adminRoot.querySelectorAll("[data-admin-list-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = String((btn as HTMLElement).getAttribute("data-admin-list-view") || "");
        if (next !== "table" && next !== "grid" && next !== "calendar") return;
        listViewMode = next;
        renderDashboard();
      });
    });
    adminRoot.querySelector("#admin-add-top")?.addEventListener("click", () => {
      if (view === "clubs") clubFormOpen = true;
      if (view === "cars") carFormOpen = true;
      if (view === "flyers") flyerFormOpen = true;
      (adminRoot.querySelector("#admin-add") as HTMLButtonElement | null)?.click();
    });
    adminRoot.querySelector("#admin-add-client-top")?.addEventListener("click", () => {
      (adminRoot.querySelector("#admin-add-client") as HTMLButtonElement | null)?.click();
    });
    adminRoot.querySelector("#jobs-create-toggle")?.addEventListener("click", () => {
      jobsCreateOpen = !jobsCreateOpen;
      renderDashboard();
    });
    adminRoot.querySelector("#jobs-calendar-toggle")?.addEventListener("click", () => {
      jobsCalendarOpen = !jobsCalendarOpen;
      renderDashboard();
    });
    adminRoot.querySelector("#jobs-open-financial")?.addEventListener("click", () => {
      const params = new URLSearchParams(window.location.search);
      params.set("view", "admin.financial_nightlife");
      const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.replaceState({}, "", next);
      view = "financials";
      renderDashboard();
    });

    adminRoot.querySelector("#admin-add")?.addEventListener("click", () => {
      if (view === "clubs") {
        clubFormOpen = true;
        clubEntries.push({
          dbId: null,
          club: cloneClub({ slug: "new-club", name: "New Club" }),
        });
        selectedClub = clubEntries.length - 1;
      } else if (view === "cars") {
        carFormOpen = true;
        carEntries.push({
          dbId: null,
          car: cloneCar({ slug: "new-car", name: "New Car" }),
        });
        selectedCar = carEntries.length - 1;
      } else {
        flyerFormOpen = true;
        flyers.push(
          cloneFlyer({
            clubSlug: clubEntries[0]?.club.slug ?? "",
            eventDate: new Date().toISOString().slice(0, 10),
            title: "Weekly flyer",
            isActive: true,
          }),
        );
        selectedFlyer = flyers.length - 1;
      }
      renderDashboard();
    });
    adminRoot.querySelector("#open-admin-profile-form")?.addEventListener("click", () => {
      adminProfileFormOpen = true;
      renderDashboard();
    });
    adminRoot.querySelector("#open-club-form")?.addEventListener("click", () => {
      clubFormOpen = true;
      renderDashboard();
    });
    adminRoot.querySelector("#open-car-form")?.addEventListener("click", () => {
      carFormOpen = true;
      renderDashboard();
    });
    adminRoot.querySelector("#open-flyer-form")?.addEventListener("click", () => {
      flyerFormOpen = true;
      renderDashboard();
    });
    adminRoot.querySelector("#open-invoice-form")?.addEventListener("click", () => {
      invoiceFormOpen = true;
      renderDashboard();
    });
    adminRoot.querySelector("#open-club-accounts-form")?.addEventListener("click", () => {
      clubAccountsFormOpen = true;
      renderDashboard();
    });

    adminRoot.querySelector("#admin-delete")?.addEventListener("click", () => {
      if (view === "clubs" && clubEntries.length) {
        const victim = clubEntries[selectedClub];
        const slug = victim?.club.slug.trim();
        void (async () => {
          if (slug) {
            const res = await deleteClubFromDb(supabase, slug);
            if (!res.ok) {
              flash(`Delete failed: ${res.message}`, "error");
              return;
            }
          }
          clubEntries.splice(selectedClub, 1);
          selectedClub = Math.max(0, selectedClub - 1);
          flash(slug ? "Club removed from database." : "Draft removed.");
          renderDashboard();
        })();
        return;
      }
      if (view === "cars" && carEntries.length) {
        const victim = carEntries[selectedCar];
        const slug = victim?.car.slug.trim();
        void (async () => {
          if (slug) {
            const res = await deleteCarFromDb(supabase, slug);
            if (!res.ok) {
              flash(`Delete failed: ${res.message}`, "error");
              return;
            }
          }
          carEntries.splice(selectedCar, 1);
          selectedCar = Math.max(0, selectedCar - 1);
          flash(slug ? "Car removed from database." : "Draft removed.");
          renderDashboard();
        })();
        return;
      }
      if (view === "flyers" && flyers.length) {
        const victim = flyers[selectedFlyer];
        if (victim?.id) {
          void (async () => {
            const { error } = await supabase
              .from("club_weekly_flyers")
              .delete()
              .eq("id", victim.id);
            if (error) {
              flash(`Delete failed: ${error.message}`, "error");
              return;
            }
            await reloadFlyers();
            flash("Flyer deleted.");
            renderDashboard();
          })();
          return;
        }
        flyers.splice(selectedFlyer, 1);
        selectedFlyer = Math.max(0, selectedFlyer - 1);
        renderDashboard();
      }
    });

    const clubForm = adminRoot.querySelector("#club-form");
    if (clubForm) {
      const syncClubFromForm = (): void => {
        const fd = new FormData(clubForm as HTMLFormElement);
        clubEntries[selectedClub] = {
          ...clubEntries[selectedClub],
          club: cloneClub({
            ...clubEntries[selectedClub]?.club,
            slug: String(fd.get("slug") || "").trim(),
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
            discoveryCardTitle:
              String(fd.get("discoveryCardTitle") || "").trim() || undefined,
            discoveryCardBlurb:
              String(fd.get("discoveryCardBlurb") || "").trim() || undefined,
            discoveryCardImage:
              String(fd.get("discoveryCardImage") || "").trim() || undefined,
          }),
        };
      };
      clubForm.addEventListener("input", syncClubFromForm);
      clubForm.addEventListener("change", syncClubFromForm);
    }

    adminRoot.querySelector("#club-image-upload")?.addEventListener("click", () => {
      const slug = clubEntries[selectedClub]?.club.slug.trim() ?? "";
      if (!slug || !SLUG_PATTERN.test(slug)) {
        flash("Set a valid lowercase slug (letters, numbers, hyphens) before uploading.", "error");
        return;
      }
      const input = adminRoot.querySelector("#club-image-file") as HTMLInputElement | null;
      const ta = adminRoot.querySelector("#club-images-text") as HTMLTextAreaElement | null;
      const file = input?.files?.[0];
      if (!file || !ta) {
        flash("Choose an image file.", "error");
        return;
      }
      void (async () => {
        const path = `catalog/clubs/${slug}/${safeUploadPath(file.name)}`;
        const { error } = await supabase.storage
          .from(ADMIN_MEDIA_BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) {
          flash(`Upload failed: ${error.message}`, "error");
          return;
        }
        const pub = supabase.storage.from(ADMIN_MEDIA_BUCKET).getPublicUrl(path);
        const line = pub.data.publicUrl;
        const cur = ta.value.trim();
        ta.value = cur ? `${cur}\n${line}` : line;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        flash("Club image uploaded — URL appended.");
      })();
    });

    const carForm = adminRoot.querySelector("#car-form");
    if (carForm) {
      const syncCarFromForm = (): void => {
        const fd = new FormData(carForm as HTMLFormElement);
        const rawGrid = String(fd.get("gridSize") || "medium").trim();
        carEntries[selectedCar] = {
          ...carEntries[selectedCar],
          car: cloneCar({
            ...carEntries[selectedCar]?.car,
            slug: String(fd.get("slug") || "").trim(),
            name: String(fd.get("name") || "").trim(),
            roleLabel: String(fd.get("roleLabel") || "").trim(),
            order: Number(fd.get("order") || 0) || 0,
            gridSize:
              rawGrid === "large" || rawGrid === "feature" ? rawGrid : "medium",
            specsHover: parseLines(String(fd.get("specsHover") || "")),
            images: parseLines(String(fd.get("images") || "")),
          }),
        };
      };
      carForm.addEventListener("input", syncCarFromForm);
      carForm.addEventListener("change", syncCarFromForm);
    }

    adminRoot.querySelector("#car-image-upload")?.addEventListener("click", () => {
      const slug = carEntries[selectedCar]?.car.slug.trim() ?? "";
      if (!slug || !SLUG_PATTERN.test(slug)) {
        flash("Set a valid lowercase slug before uploading.", "error");
        return;
      }
      const input = adminRoot.querySelector("#car-image-file") as HTMLInputElement | null;
      const ta = adminRoot.querySelector("#car-images-text") as HTMLTextAreaElement | null;
      const file = input?.files?.[0];
      if (!file || !ta) {
        flash("Choose an image file.", "error");
        return;
      }
      void (async () => {
        const path = `catalog/cars/${slug}/${safeUploadPath(file.name)}`;
        const { error } = await supabase.storage
          .from(ADMIN_MEDIA_BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) {
          flash(`Upload failed: ${error.message}`, "error");
          return;
        }
        const pub = supabase.storage.from(ADMIN_MEDIA_BUCKET).getPublicUrl(path);
        const line = pub.data.publicUrl;
        const cur = ta.value.trim();
        ta.value = cur ? `${cur}\n${line}` : line;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        flash("Car image uploaded — URL appended.");
      })();
    });

    const flyerForm = adminRoot.querySelector("#flyer-form");
    if (flyerForm) {
      const syncFlyerFromForm = (): void => {
        const fd = new FormData(flyerForm as HTMLFormElement);
        flyers[selectedFlyer] = cloneFlyer({
          ...flyers[selectedFlyer],
          id: flyers[selectedFlyer]?.id ?? "",
          clubSlug: String(fd.get("clubSlug") || "").trim(),
          eventDate: String(fd.get("eventDate") || "").trim(),
          title: String(fd.get("title") || "").trim(),
          description: String(fd.get("description") || "").trim(),
          imageUrl: String(fd.get("imageUrl") || "").trim(),
          imagePath: String(fd.get("imagePath") || "").trim(),
          sortOrder: Number(fd.get("sortOrder") || 0) || 0,
          isActive: String(fd.get("isActive") || "true")
            .toLowerCase()
            .includes("true"),
        });
      };
      flyerForm.addEventListener("input", syncFlyerFromForm);
      flyerForm.addEventListener("change", syncFlyerFromForm);
      adminRoot.querySelector("#flyer-upload")?.addEventListener("click", () => {
        const input = adminRoot.querySelector("#flyer-image-file") as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (!file) {
          flash("Choose an image first.", "error");
          return;
        }
        void (async () => {
          const path = safeUploadPath(file.name);
          const { error } = await supabase.storage
            .from(ADMIN_MEDIA_BUCKET)
            .upload(path, file, { upsert: true, contentType: file.type });
          if (error) {
            flash(`Upload failed: ${error.message}`, "error");
            return;
          }
          const pub = supabase.storage.from(ADMIN_MEDIA_BUCKET).getPublicUrl(path);
          flyers[selectedFlyer] = cloneFlyer({
            ...flyers[selectedFlyer],
            imagePath: path,
            imageUrl: pub.data.publicUrl,
          });
          flash("Image uploaded.");
          renderDashboard();
        })();
      });
      adminRoot.querySelector("#flyer-save-db")?.addEventListener("click", () => {
        const current = flyers[selectedFlyer];
        if (!current) {
          flash("No flyer selected.", "error");
          return;
        }
        const ve = validateFlyerShape(current, clubEntries);
        if (ve.length) {
          flash(ve.join(" "), "error");
          return;
        }
        void (async () => {
          const row = {
            club_slug: current.clubSlug,
            event_date: current.eventDate,
            title: current.title,
            description: current.description,
            image_path: current.imagePath,
            image_url: current.imageUrl,
            is_active: current.isActive,
            sort_order: current.sortOrder,
            updated_at: new Date().toISOString(),
          };
          const q = current.id
            ? supabase.from("club_weekly_flyers").update(row).eq("id", current.id).select("id")
            : supabase.from("club_weekly_flyers").insert(row).select("id");
          const { data, error } = await q;
          if (error) {
            flash(`Save failed: ${error.message}`, "error");
            return;
          }
          if (!current.id && Array.isArray(data) && data[0]?.id) {
            flyers[selectedFlyer] = cloneFlyer({
              ...current,
              id: String(data[0].id),
            });
          }
          await reloadFlyers();
          flash("Flyer saved.");
          renderDashboard();
        })();
      });
    }

    adminRoot.querySelectorAll("button[data-revision-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedRevisionId =
          (btn as HTMLButtonElement).dataset.revisionId ?? null;
        renderDashboard();
      });
    });

    adminRoot.querySelector("#promoter-approve-revision")?.addEventListener("click", () => {
      const rev = promoterRevisions.find((r) => r.id === selectedRevisionId);
      if (!rev) return;
      const notes = String(
        (adminRoot.querySelector("#promoter-review-notes") as HTMLTextAreaElement | null)
          ?.value || "",
      ).trim();
      void (async () => {
        const res = await approvePromoterRevision(supabase, rev.id, true, notes);
        if (!res.ok) {
          flash(`Approve failed: ${res.message}`, "error");
          return;
        }
        await reloadPromoters();
        flash("Revision approved.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#promoter-reject-revision")?.addEventListener("click", () => {
      const rev = promoterRevisions.find((r) => r.id === selectedRevisionId);
      if (!rev) return;
      const notes = String(
        (adminRoot.querySelector("#promoter-review-notes") as HTMLTextAreaElement | null)
          ?.value || "",
      ).trim();
      void (async () => {
        const res = await approvePromoterRevision(supabase, rev.id, false, notes);
        if (!res.ok) {
          flash(`Reject failed: ${res.message}`, "error");
          return;
        }
        await reloadPromoters();
        flash("Revision rejected.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#club-account-create")?.addEventListener("click", () => {
      const clubSlug = String(
        (adminRoot.querySelector("#club-account-slug") as HTMLSelectElement | null)?.value || "",
      ).trim();
      const inviteEmail = String(
        (adminRoot.querySelector("#club-account-email") as HTMLInputElement | null)?.value || "",
      ).trim();
      const role = String(
        (adminRoot.querySelector("#club-account-role") as HTMLSelectElement | null)?.value || "owner",
      ).trim() as "owner" | "manager" | "editor";
      const notes = String(
        (adminRoot.querySelector("#club-account-notes") as HTMLTextAreaElement | null)?.value || "",
      ).trim();
      const output = adminRoot.querySelector("#club-account-output") as HTMLElement | null;
      void (async () => {
        const res = await issueClubInvite(supabase, { clubSlug, inviteEmail, role, notes });
        if (!res.ok) {
          if (output) output.textContent = `Create invite failed: ${res.message}`;
          flash(`Create invite failed: ${res.message}`, "error");
          return;
        }
        if (output) output.textContent = `Invite code generated: ${res.row.inviteCode}`;
        await reloadClubAccounts();
        flash("Club invite generated.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#club-revision-approve")?.addEventListener("click", () => {
      const rev = clubEditRevisions.find((x) => x.id === selectedClubRevisionId);
      if (!rev) return;
      const notes = String(
        (adminRoot.querySelector("#club-revision-review-notes") as HTMLTextAreaElement | null)
          ?.value || "",
      ).trim();
      void (async () => {
        const res = await reviewClubEditRevision(supabase, rev.id, true, notes);
        if (!res.ok) {
          flash(`Approve failed: ${res.message}`, "error");
          return;
        }
        await reloadClubRevisions();
        flash("Club edit approved.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#club-revision-reject")?.addEventListener("click", () => {
      const rev = clubEditRevisions.find((x) => x.id === selectedClubRevisionId);
      if (!rev) return;
      const notes = String(
        (adminRoot.querySelector("#club-revision-review-notes") as HTMLTextAreaElement | null)
          ?.value || "",
      ).trim();
      void (async () => {
        const res = await reviewClubEditRevision(supabase, rev.id, false, notes);
        if (!res.ok) {
          flash(`Reject failed: ${res.message}`, "error");
          return;
        }
        await reloadClubRevisions();
        flash("Club edit rejected.");
        renderDashboard();
      })();
    });

    adminRoot.querySelectorAll("[data-dispute-status]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dispute = clubJobDisputes.find((x) => x.id === selectedClubDisputeId);
        if (!dispute) return;
        const status = String((btn as HTMLElement).getAttribute("data-dispute-status") || "").trim() as
          | "under_review"
          | "resolved"
          | "rejected";
        const notes = String(
          (adminRoot.querySelector("#club-dispute-review-notes") as HTMLTextAreaElement | null)
            ?.value || "",
        ).trim();
        void (async () => {
          const res = await reviewJobDispute(supabase, dispute.id, status, notes);
          if (!res.ok) {
            flash(`Dispute update failed: ${res.message}`, "error");
            return;
          }
          await reloadClubDisputes();
          flash(`Dispute marked ${status.replace("_", " ")}.`);
          renderDashboard();
        })();
      });
    });

    adminRoot.querySelector("#promoter-request-approve")?.addEventListener("click", () => {
      const req = promoterSignupRequests.find((x) => x.id === selectedPromoterRequestId);
      if (!req || req.status !== "pending") return;
      void (async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          flash("Session expired. Sign in again.", "error");
          return;
        }
        const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
        const anon =
          String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim() ||
          String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
        if (!url || !anon) {
          flash("Missing Supabase URL or anon key.", "error");
          return;
        }
        const res = await adminPromoterRequestDecision(url, anon, session.access_token, {
          requestId: req.id,
          action: "approve",
        });
        if (!res.ok) {
          flash(`Approve failed: ${res.message}`, "error");
          return;
        }
        await reloadPromoterSignupRequests();
        await reloadPromoters();
        flash(
          "Promoter approved. Auth account created; applicant should receive email with password (configure Resend + Edge Function).",
        );
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#promoter-request-deny")?.addEventListener("click", () => {
      const req = promoterSignupRequests.find((x) => x.id === selectedPromoterRequestId);
      if (!req || req.status !== "pending") return;
      const denialReason = String(
        (adminRoot.querySelector("#promoter-request-deny-notes") as HTMLTextAreaElement | null)
          ?.value || "",
      ).trim();
      void (async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          flash("Session expired. Sign in again.", "error");
          return;
        }
        const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
        const anon =
          String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim() ||
          String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
        if (!url || !anon) {
          flash("Missing Supabase URL or anon key.", "error");
          return;
        }
        const res = await adminPromoterRequestDecision(url, anon, session.access_token, {
          requestId: req.id,
          action: "deny",
          denialReason: denialReason || undefined,
        });
        if (!res.ok) {
          flash(`Deny failed: ${res.message}`, "error");
          return;
        }
        await reloadPromoterSignupRequests();
        flash("Request denied. Applicant notified if email is configured.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#promoter-request-compose-email")?.addEventListener("click", () => {
      const req = promoterSignupRequests.find((x) => x.id === selectedPromoterRequestId);
      if (!req) return;
      void navigator.clipboard.writeText(req.email).catch(() => {});
      const subj = encodeURIComponent(`Cooper Concierge – promoter access (${req.fullName})`);
      const body = encodeURIComponent(
        `Hi ${req.fullName},\n\n\n\n—\n(Email address copied to clipboard.)`,
      );
      window.location.href = `mailto:${req.email}?subject=${subj}&body=${body}`;
    });

    adminRoot.querySelector("#promoter-job-create")?.addEventListener("click", () => {
      const form = adminRoot.querySelector("#promoter-job-form") as HTMLFormElement | null;
      if (!form) return;
      const fd = new FormData(form);
      const promoterId = String(fd.get("promoterId") || "").trim();
      const clubSlug = String(fd.get("clubSlug") || "").trim();
      const jobDate = String(fd.get("jobDate") || "").trim();
      const status = String(fd.get("status") || "assigned").trim() as
        | "assigned"
        | "completed"
        | "cancelled";
      if (!promoterId || !jobDate) {
        flash("Promoter and date are required.", "error");
        return;
      }
      void (async () => {
        const resolvedClients: Array<{ name: string; contact: string }> = [];
        for (const item of createJobClients) {
          if (item.mode === "existing") {
            if (item.name.trim()) {
              resolvedClients.push({ name: item.name.trim(), contact: item.contact.trim() });
            }
            continue;
          }
          if (item.mode === "blank") {
            const blank = await createEmptyClient(supabase);
            if (!blank.ok) {
              flash(`Create client failed: ${blank.message}`, "error");
              return;
            }
            await reloadClients();
            const c = clients.find((x) => x.id === blank.id);
            resolvedClients.push({ name: String(c?.name || "New client").trim(), contact: "" });
            continue;
          }
          const created = await createEmptyClient(supabase);
          if (!created.ok) {
            flash(`Create client failed: ${created.message}`, "error");
            return;
          }
          const newName = String(item.name || "").trim() || "New client";
          const newEmail = String(item.newEmail || "").trim() || null;
          const newPhone = String(item.newPhone || "").trim() || null;
          const upd = await updateClientById(supabase, created.id, {
            name: newName,
            email: newEmail,
            phone: newPhone,
            instagram: null,
            notes: null,
            typical_spend_gbp: null,
            preferred_nights: null,
            preferred_promoter_id: promoterId || null,
            preferred_club_slug: null,
          });
          if (!upd.ok) {
            flash(`Update client failed: ${upd.message}`, "error");
            return;
          }
          resolvedClients.push({ name: newName, contact: String(newPhone || newEmail || "").trim() });
        }
        const clientName = resolvedClients.map((c) => c.name).filter(Boolean).join("; ");
        const clientContact = resolvedClients.map((c) => c.contact).filter(Boolean).join("; ");
        const res = await createPromoterJob(supabase, {
          promoter_id: promoterId,
          club_slug: clubSlug || null,
          service: String(fd.get("service") || "guestlist").trim() || "guestlist",
          job_date: jobDate,
          status,
          client_name: clientName,
          client_contact: clientContact,
          shift_fee: Number(fd.get("shiftFee") || 0) || 0,
          guestlist_fee: Number(fd.get("guestFee") || 0) || 0,
          guests_count: Number(fd.get("guestCount") || 0) || 0,
          notes: String(fd.get("notes") || "").trim(),
        });
        if (!res.ok) {
          flash(`Create job failed: ${res.message}`, "error");
          return;
        }
        const ymd = jobDate.split("-").map(Number);
        if (ymd.length >= 2 && Number.isFinite(ymd[0]) && Number.isFinite(ymd[1])) {
          jobsCalendarYear = ymd[0]!;
          jobsCalendarMonth = Math.max(0, Math.min(11, ymd[1]! - 1));
        }
        await reloadPromoters();
        if (view === "jobs") await reloadJobsCalendar();
        createJobClients = [];
        flash("Job created.");
        renderDashboard();
      })();
    });
    adminRoot.querySelector("#admin-job-add-client")?.addEventListener("click", () => {
      const form = adminRoot.querySelector("#promoter-job-form") as HTMLFormElement | null;
      if (!form) return;
      const fd = new FormData(form);
      const mode = String(fd.get("clientMode") || "existing").trim();
      if (mode === "existing") {
        const existingId = String(fd.get("existingClientId") || "").trim();
        const existing = clients.find((c) => c.id === existingId);
        if (!existing) {
          flash("Select a client from the find results first.", "error");
          return;
        }
        createJobClients.push({
          mode: "existing",
          clientId: existing.id,
          name: String(existing.name || "").trim() || "Client",
          contact: String(existing.phone || existing.email || existing.instagram || "").trim(),
        });
      } else if (mode === "blank") {
        createJobClients.push({
          mode: "blank",
          name: "New client",
          contact: "",
        });
      } else {
        const newName = String(fd.get("newClientName") || "").trim();
        const newEmail = String(fd.get("newClientEmail") || "").trim();
        const newPhone = String(fd.get("newClientPhone") || "").trim();
        if (!newName) {
          flash("New client name is required.", "error");
          return;
        }
        createJobClients.push({
          mode: "new",
          name: newName,
          contact: String(newPhone || newEmail || "").trim(),
          newEmail,
          newPhone,
        });
      }
      renderDashboard();
    });
    adminRoot.querySelectorAll("[data-admin-job-remove-client]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number((btn as HTMLElement).getAttribute("data-admin-job-remove-client") || "-1");
        if (idx < 0 || idx >= createJobClients.length) return;
        createJobClients.splice(idx, 1);
        renderDashboard();
      });
    });
    adminRoot.querySelector("[name=clientMode]")?.addEventListener("change", (ev) => {
      const mode = String((ev.target as HTMLSelectElement).value || "existing").trim();
      const findBlock = adminRoot.querySelector("#admin-job-find-client-block") as HTMLElement | null;
      const newName = adminRoot.querySelector("#admin-job-new-client-name") as HTMLElement | null;
      const newEmail = adminRoot.querySelector("#admin-job-new-client-email") as HTMLElement | null;
      const newPhone = adminRoot.querySelector("#admin-job-new-client-phone") as HTMLElement | null;
      const showNew = mode === "new";
      if (findBlock) findBlock.hidden = mode !== "existing";
      if (newName) newName.hidden = !showNew;
      if (newEmail) newEmail.hidden = !showNew;
      if (newPhone) newPhone.hidden = !showNew;
    });
    adminRoot.querySelector("[name=clientSearch]")?.addEventListener("input", (ev) => {
      const q = String((ev.target as HTMLInputElement).value || "").trim().toLowerCase();
      const sel = adminRoot.querySelector("[name=existingClientId]") as HTMLSelectElement | null;
      if (!sel) return;
      const filtered = clients.filter((c) => {
        const hay = `${c.name || ""} ${c.email || ""} ${c.phone || ""}`.toLowerCase();
        return !q || hay.includes(q);
      });
      sel.innerHTML = `<option value="">(none)</option>${filtered
        .map((c) => `<option value="${escapeAttr(c.id)}">${escapeAttr(c.name || c.email || c.phone || c.id.slice(0, 8))}</option>`)
        .join("")}`;
    });

    adminRoot.querySelector("#jobs-cal-prev")?.addEventListener("click", () => {
      editingJobId = null;
      jobsCalendarMonth -= 1;
      if (jobsCalendarMonth < 0) {
        jobsCalendarMonth = 11;
        jobsCalendarYear -= 1;
      }
      void reloadJobsCalendar().then(() => renderDashboard());
    });

    adminRoot.querySelector("#jobs-cal-next")?.addEventListener("click", () => {
      editingJobId = null;
      jobsCalendarMonth += 1;
      if (jobsCalendarMonth > 11) {
        jobsCalendarMonth = 0;
        jobsCalendarYear += 1;
      }
      void reloadJobsCalendar().then(() => renderDashboard());
    });

    adminRoot.querySelector("#jobs-filter-apply")?.addEventListener("click", () => {
      const pf = adminRoot.querySelector(
        "#jobs-filter-promoter",
      ) as HTMLSelectElement | null;
      const cf = adminRoot.querySelector("#jobs-filter-club") as HTMLSelectElement | null;
      jobsFilterPromoterId = pf?.value.trim() ?? "";
      jobsFilterClubSlug = cf?.value.trim() ?? "";
      void reloadJobsCalendar().then(() => renderDashboard());
    });

    adminRoot.querySelector("#jobs-filter-reset")?.addEventListener("click", () => {
      jobsFilterPromoterId = "";
      jobsFilterClubSlug = "";
      void reloadJobsCalendar().then(() => renderDashboard());
    });

    adminRoot.querySelectorAll("[data-open-job-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingJobId =
          (btn as HTMLButtonElement).dataset.openJobEdit?.trim() || null;
        renderDashboard();
      });
    });

    adminRoot.querySelectorAll("[data-job-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = (btn as HTMLButtonElement).dataset.jobDelete?.trim();
        if (!id) return;
        if (
          !globalThis.confirm(
            "Delete this job? Guestlist rows on this job will be removed. If the job was completed, linked payout expense and earning rows will be removed too.",
          )
        )
          return;
        void (async () => {
          const res = await deletePromoterJob(supabase, id);
          if (!res.ok) {
            flash(`Delete failed: ${res.message}`, "error");
            return;
          }
          editingJobId = null;
          await reloadPromoters();
          await reloadJobsCalendar();
          await reloadFinancialReport();
          flashAfterJobDelete(res);
          renderDashboard();
        })();
      });
    });

    adminRoot.querySelectorAll("[data-job-complete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = (btn as HTMLButtonElement).dataset.jobComplete?.trim();
        if (!id) return;
        void (async () => {
          const res = await completePromoterJob(supabase, id);
          if (!res.ok) {
            flash(`Complete job failed: ${res.message}`, "error");
            return;
          }
          editingJobId = null;
          await reloadPromoters();
          await reloadJobsCalendar();
          await reloadFinancialReport();
          flash("Job completed and earnings recorded.");
          renderDashboard();
        })();
      });
    });

    adminRoot.querySelector("#admin-job-edit-dismiss")?.addEventListener("click", () => {
      const dlg = adminRoot.querySelector(
        "#admin-job-edit-dialog",
      ) as HTMLDialogElement | null;
      dlg?.close();
      editingJobId = null;
      renderDashboard();
    });

    adminRoot.querySelector("#admin-job-edit-save")?.addEventListener("click", () => {
      const form = adminRoot.querySelector(
        "#admin-job-edit-form",
      ) as HTMLFormElement | null;
      if (!form) return;
      const fd = new FormData(form);
      const jobId = String(fd.get("jobId") || "").trim();
      if (!jobId) return;
      const clubRaw = String(fd.get("clubSlug") || "").trim();
      void (async () => {
        const rawSt = String(fd.get("status") || "assigned").trim();
        const status: PromoterJob["status"] =
          rawSt === "cancelled" ? "cancelled" : "assigned";
        const res = await updatePromoterJob(supabase, jobId, {
          club_slug: clubRaw ? clubRaw : null,
          service: String(fd.get("service") || "guestlist").trim() || "guestlist",
          job_date: String(fd.get("jobDate") || "").trim(),
          status,
          guests_count: Number(fd.get("guestCount") || 0) || 0,
          shift_fee: Number(fd.get("shiftFee") || 0) || 0,
          guestlist_fee: Number(fd.get("guestFee") || 0) || 0,
          notes: String(fd.get("notes") || "").trim(),
        });
        if (!res.ok) {
          flash(`Save failed: ${res.message}`, "error");
          return;
        }
        (
          adminRoot.querySelector(
            "#admin-job-edit-dialog",
          ) as HTMLDialogElement | null
        )?.close();
        editingJobId = null;
        await reloadPromoters();
        await reloadJobsCalendar();
        flash("Job updated.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#admin-job-edit-delete")?.addEventListener("click", () => {
      const fromForm = adminRoot.querySelector(
        '#admin-job-edit-form input[name="jobId"]',
      ) as HTMLInputElement | null;
      const fromRo = adminRoot.querySelector(
        "#admin-job-edit-id",
      ) as HTMLInputElement | null;
      const jobId = (fromForm?.value ?? fromRo?.value ?? "").trim();
      if (!jobId) return;
      if (
        !globalThis.confirm(
          "Delete this job permanently? Guestlist rows will be removed. If it was completed, linked payout expense and earning rows will be removed as well.",
        )
      )
        return;
      void (async () => {
        const res = await deletePromoterJob(supabase, jobId);
        if (!res.ok) {
          flash(`Delete failed: ${res.message}`, "error");
          return;
        }
        (
          adminRoot.querySelector(
            "#admin-job-edit-dialog",
          ) as HTMLDialogElement | null
        )?.close();
        editingJobId = null;
        await reloadPromoters();
        await reloadJobsCalendar();
        await reloadFinancialReport();
        flashAfterJobDelete(res);
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#admin-job-edit-complete")?.addEventListener("click", () => {
      const form = adminRoot.querySelector(
        "#admin-job-edit-form",
      ) as HTMLFormElement | null;
      if (!form) return;
      const jobId = String(new FormData(form).get("jobId") || "").trim();
      if (!jobId) return;
      void (async () => {
        const res = await completePromoterJob(supabase, jobId);
        if (!res.ok) {
          flash(`Complete job failed: ${res.message}`, "error");
          return;
        }
        (
          adminRoot.querySelector(
            "#admin-job-edit-dialog",
          ) as HTMLDialogElement | null
        )?.close();
        editingJobId = null;
        await reloadPromoters();
        await reloadJobsCalendar();
        await reloadFinancialReport();
        flash("Job completed and earnings recorded.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#promoter-invoice-generate")?.addEventListener("click", () => {
      const form = adminRoot.querySelector("#promoter-invoice-form") as HTMLFormElement | null;
      if (!form) return;
      const fd = new FormData(form);
      const promoterId = String(fd.get("promoterId") || "").trim();
      const from = String(fd.get("from") || "").trim();
      const to = String(fd.get("to") || "").trim();
      if (!promoterId || !from || !to) {
        flash("Promoter and date range are required.", "error");
        return;
      }
      void (async () => {
        const res = await generateInvoiceForPromoter(supabase, promoterId, from, to);
        if (!res.ok) {
          flash(`Invoice failed: ${res.message}`, "error");
          return;
        }
        await reloadPromoters();
        flash(`Invoice generated: ${res.invoiceId.slice(0, 8)}…`);
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#enquiry-status-save")?.addEventListener("click", () => {
      const sel = adminRoot.querySelector("#enquiry-status-select") as HTMLSelectElement | null;
      const id = sel?.dataset.enquiryId;
      const status = sel?.value;
      if (!id || !status) return;
      void (async () => {
        const res = await updateEnquiryStatus(supabase, id, status);
        if (!res.ok) {
          flash(`Update failed: ${res.message}`, "error");
          return;
        }
        await reloadEnquiries();
        flash("Status updated.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#enquiry-create-clients")?.addEventListener("click", () => {
      const btn = adminRoot.querySelector(
        "#enquiry-create-clients",
      ) as HTMLButtonElement | null;
      const id = btn?.dataset.enquiryId;
      if (!id) return;
      void (async () => {
        btn.disabled = true;
        const res = await createClientsFromEnquiry(supabase, id);
        btn.disabled = false;
        if (!res.ok) {
          flash(`Clients: ${res.message}`, "error");
          return;
        }
        await reloadClients();
        renderDashboard();
        flash(
          res.created === 0
            ? "No new clients (all rows already exist or nothing to import)."
            : `Created ${res.created} client(s).`,
        );
      })();
    });

    adminRoot.querySelector("#admin-client-save")?.addEventListener("click", () => {
      const form = adminRoot.querySelector("#admin-client-form") as HTMLFormElement | null;
      if (!form || !selectedClientId) return;
      const fd = new FormData(form);
      const spendRaw = String(fd.get("typical_spend_gbp") || "").trim();
      const spendParsed =
        spendRaw === "" ? null : Number.parseFloat(spendRaw.replace(",", "."));
      const spend =
        spendParsed != null && Number.isFinite(spendParsed) ? spendParsed : null;
      const promoId = String(fd.get("preferred_promoter_id") || "").trim();
      void (async () => {
        const res = await updateClientById(supabase, selectedClientId!, {
          name: String(fd.get("name") || "").trim() || null,
          email: String(fd.get("email") || "").trim().toLowerCase() || null,
          phone: String(fd.get("phone") || "").trim() || null,
          instagram: String(fd.get("instagram") || "").trim() || null,
          notes: String(fd.get("notes") || "").trim() || null,
          typical_spend_gbp: spend,
          preferred_nights: String(fd.get("preferred_nights") || "").trim() || null,
          preferred_promoter_id: promoId || null,
          preferred_club_slug: String(fd.get("preferred_club_slug") || "").trim() || null,
        });
        if (!res.ok) {
          flash(`Save failed: ${res.message}`, "error");
          return;
        }
        await reloadClients();
        flash("Client saved.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#admin-add-client")?.addEventListener("click", () => {
      void (async () => {
        const res = await createEmptyClient(supabase);
        if (!res.ok) {
          flash(`Could not add client: ${res.message}`, "error");
          return;
        }
        selectedClientId = res.id;
        await reloadClients();
        flash("New client created — fill in details and save.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#admin-delete-client")?.addEventListener("click", () => {
      if (!selectedClientId) {
        flash("Select a client first.", "error");
        return;
      }
      if (
        !globalThis.confirm(
          "Delete this client? Guestlist activity rows for them will be removed too.",
        )
      )
        return;
      void (async () => {
        const id = selectedClientId!;
        const res = await deleteClientById(supabase, id);
        if (!res.ok) {
          flash(`Delete failed: ${res.message}`, "error");
          return;
        }
        selectedClientId = null;
        await reloadClients();
        flash("Client deleted.");
        renderDashboard();
      })();
    });

    adminRoot.querySelectorAll("[data-client-attendance-id]").forEach((row) => {
      row.addEventListener("click", () => {
        selectedClientAttendanceId =
          (row as HTMLElement).getAttribute("data-client-attendance-id") || null;
        renderDashboard();
      });
    });
    adminRoot.querySelectorAll("[data-client-attendance-delete]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const id =
          (btn as HTMLElement).getAttribute("data-client-attendance-delete") || "";
        if (!id) return;
        void (async () => {
          const res = await deleteClientAttendanceForAdmin(supabase, id);
          if (!res.ok) {
            flash(`Delete attendance failed: ${res.message}`, "error");
            return;
          }
          await reloadClients();
          flash("Attendance deleted.");
          renderDashboard();
        })();
      });
    });
    adminRoot.querySelector("#admin-client-attendance-new")?.addEventListener("click", () => {
      selectedClientAttendanceId = null;
      renderDashboard();
    });
    adminRoot.querySelector("#admin-client-attendance-save")?.addEventListener("click", () => {
      const form = adminRoot.querySelector(
        "#admin-client-attendance-form",
      ) as HTMLFormElement | null;
      if (!form || !selectedClientId) return;
      const fd = new FormData(form);
      const spend = Number(fd.get("spend_gbp") || 0) || 0;
      void (async () => {
        const res = await saveClientAttendanceForAdmin(supabase, {
          id: String(fd.get("attendance_id") || "").trim() || undefined,
          client_id: selectedClientId,
          event_date: String(fd.get("event_date") || "").trim(),
          club_slug: String(fd.get("club_slug") || "").trim(),
          promoter_id: String(fd.get("promoter_id") || "").trim() || null,
          spend_gbp: spend,
          source: String(fd.get("source") || "").trim() || "manual",
          notes: String(fd.get("attendance_notes") || "").trim(),
        });
        if (!res.ok) {
          flash(`Save attendance failed: ${res.message}`, "error");
          return;
        }
        await reloadClients();
        selectedClientAttendanceId = res.id;
        flash("Attendance saved. Client preferences recalculated.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#enquiry-status-select")?.addEventListener("change", (e) => {
      const t = e.target as HTMLSelectElement;
      const id = t.dataset.enquiryId;
      if (id) {
        const row = enquiries.find((x) => x.id === id);
        if (row) row.status = t.value;
      }
    });

    if (view === "jobs" && editingJobId) {
      const dlg = adminRoot.querySelector(
        "#admin-job-edit-dialog",
      ) as HTMLDialogElement | null;
      if (dlg && typeof dlg.showModal === "function") {
        dlg.addEventListener(
          "cancel",
          () => {
            editingJobId = null;
            renderDashboard();
          },
          { once: true },
        );
        try {
          dlg.showModal();
        } catch {
          /* already open or invalid */
        }
      }
    }

    const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
    const mapsHint = adminRoot.querySelector("#club-address-maps-hint");
    if (mapsHint) {
      mapsHint.textContent = mapsKey
        ? "Type to search Google Places; choosing a result fills address, latitude, and longitude."
        : "Tip: set VITE_GOOGLE_MAPS_API_KEY (enable Maps JavaScript API + Places API; restrict the key by HTTP referrer) to enable address search.";
    }
    const mapsClubForm = adminRoot.querySelector("#club-form");
    if (mapsClubForm && mapsKey) {
      const address = mapsClubForm.querySelector<HTMLInputElement>('input[name="address"]');
      const lat = mapsClubForm.querySelector<HTMLInputElement>('input[name="lat"]');
      const lng = mapsClubForm.querySelector<HTMLInputElement>('input[name="lng"]');
      if (address && lat && lng) {
        void attachClubAddressAutocomplete({
          addressInput: address,
          latInput: lat,
          lngInput: lng,
          apiKey: mapsKey,
        }        ).catch(() =>
          flash(
            "Could not load Google Maps — check API key, billing, and Places API.",
            "error",
          ),
        );
      }
    }
  }

  async function loadAdminDashboard(): Promise<void> {
    const gate = await gateAdminUser(supabase);
    if (!gate.ok) {
      if (gate.reason === "not_signed_in") {
        renderLogin();
        return;
      }
      await signOutAdmin(supabase);
      loginError =
        gate.reason === "not_admin"
          ? "Not an admin account."
          : "Could not verify access.";
      renderLogin();
      return;
    }
    const userMetadata = (gate.user.user_metadata ?? {}) as Record<string, unknown>;
    const profileRow = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", gate.user.id)
      .maybeSingle();
    adminProfile = {
      userId: gate.user.id,
      email: String(gate.user.email ?? "").trim().toLowerCase(),
      username: String(
        profileRow.data?.display_name ??
          userMetadata.username ??
          userMetadata.display_name ??
          gate.user.email ??
          "",
      ).trim(),
    };
    await reloadAllFromDb();
    renderDashboard();
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (!session) {
      renderLogin();
      return;
    }
    if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
    void loadAdminDashboard();
  });

  await loadAdminDashboard();
}
