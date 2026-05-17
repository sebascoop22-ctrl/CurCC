import {
  gateAdminUser,
  gatePromoterUser,
  signInPromoter,
  signOutAdmin,
} from "../admin/auth";
import {
  deletePromoterClientAttendance,
  insertPromoterTableSale,
  loadPromoterAvailability,
  loadPromoterByUser,
  loadPromotersForAdmin,
  loadPromoterGuestlistEntriesForJobs,
  loadPromoterInvoices,
  loadPromoterJobs,
  loadPromoterNightAdjustments,
  loadPromoterPreferences,
  loadPromoterClientsWorkedWith,
  loadPromoterClientGuestlistViaJobs,
  loadPromoterClientAttendances,
  loadPromoterTableSales,
  savePromoterClient,
  savePromoterClientAttendance,
  savePromoterAvailability,
  savePromoterPreference,
  submitPromoterRevision,
  upsertPromoterNightAdjustment,
} from "../admin/promoters";
import { listFinancialBookings, listFinancialPromoters } from "../admin/financial-tracking";
import { fetchClubs } from "../data/fetch-data";
import {
  callPromoterInvoiceEdge,
  downloadPdfFromBase64,
} from "../lib/promoter-invoice-edge";
import { notifyPromoterRequestSubmitted } from "../lib/promoter-request-edge";
import { renderStatusBadge } from "../portal/badge";
import { mountDataTable } from "../portal/data-table";
import { getSupabaseClient } from "../lib/supabase";
import { applyCollapsibleFormSections } from "../lib/collapsible-form-sections";
import { jobTypeLabel } from "../lib/financial/job-display";
import {
  formatInvoiceGbp,
  renderInvoiceVerificationBadge,
} from "./admin/invoices-shared";
import { bindPromoterJobsEvents } from "./promoter/jobs-bind";
import {
  defaultPromoterJobsFilters,
  renderPromoterJobsViewHtml,
  type PromoterJobsFilters,
} from "./promoter/jobs-view";
import type {
  Club,
  FinancialBooking,
  FinancialPromoterProfile,
  PromoterAvailabilitySlot,
  PromoterClubPreference,
  PromoterGuestlistEntry,
  PromoterInvoice,
  PromoterJob,
  PromoterNightAdjustment,
  PromoterProfile,
  PromoterTableSale,
} from "../types";
import "../styles/pages/promoter.css";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type PromoterView =
  | "overview"
  | "profile"
  | "preferences"
  | "jobs"
  | "tables"
  | "clients"
  | "invoices"
  | "job_history"
  | "table_history";

type PromoterNavSection = "overview" | "account" | "work" | "finance";

const PROMOTER_VIEW_HEADINGS: Record<
  PromoterView,
  { title: string; subtitle: string }
> = {
  overview: {
    title: "Overview",
    subtitle:
      "Snapshot of your approval status, completed work, and earnings from tracked jobs.",
  },
  profile: {
    title: "My profile",
    subtitle:
      "Bio, up to twelve photos, and clubs to highlight on your approved profile — submit once for admin approval.",
  },
  preferences: {
    title: "Work preferences",
    subtitle:
      "Weekly hours, preferred clubs, and one-off night change requests the team can approve.",
  },
  jobs: {
    title: "Jobs",
    subtitle:
      "Upcoming assignments and history. For guestlist shifts, add each guest below; admins approve names before they count toward payout.",
  },
  tables: {
    title: "Tables sold",
    subtitle:
      "Log table bookings and reported min spend for your nights. Cooper also records office-side entries so both views can be compared in reports.",
  },
  clients: {
    title: "Clients",
    subtitle:
      "Create and manage your own client records with duplicate detection by email, phone, or Instagram.",
  },
  invoices: {
    title: "Invoices",
    subtitle:
      "Period statements from completed earnings. Download a PDF anytime; your coordinator can also email a copy to your login address.",
  },
  job_history: {
    title: "Jobs history",
    subtitle:
      "Completed and cancelled work history with quick filtering by service type and status.",
  },
  table_history: {
    title: "Tables sold history",
    subtitle:
      "Historical table-sale records logged for your account across clubs and date ranges.",
  },
};

function esc(v: string): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function parseClubDays(raw: string): string[] {
  return raw
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

function money(v: number): string {
  return `£${v.toFixed(2)}`;
}

/** Public bucket shared with admin catalog / flyers (`src/pages/admin.ts`). */
const PROMOTER_PROFILE_IMAGE_BUCKET = "club-flyers";

function safePromoterProfileFileSegment(fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${new Date().toISOString().slice(0, 10)}/${Date.now()}_${safe}`;
}

export async function initPromoterPortal(): Promise<void> {
  const rootEl = document.getElementById("promoter-root");
  if (!rootEl) return;
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    rootEl.innerHTML = `<div class="admin-card"><p>Supabase is not configured.</p></div>`;
    return;
  }
  const root = rootEl;
  const supabase = supabaseClient;

  let profile: PromoterProfile | null = null;
  let availability: PromoterAvailabilitySlot[] = [];
  let preferences: PromoterClubPreference[] = [];
  let jobs: PromoterJob[] = [];
  let guestlistEntries: PromoterGuestlistEntry[] = [];
  let promoterClients: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    instagram: string;
    notes: string;
    createdAt: string;
  }> = [];
  let selectedClientId: string | null = null;
  let selectedClientAttendanceId: string | null = null;
  let promoterClientFormOpen = false;
  let promoterClientAttendanceFormOpen = false;
  let promoterClientAttendances: Array<{
    id: string;
    clientId: string;
    eventDate: string;
    clubSlug: string;
    promoterId: string | null;
    spendGbp: number;
    source: string;
    notes: string;
    createdAt: string;
  }> = [];
  let nightAdjustments: PromoterNightAdjustment[] = [];
  let tableSales: PromoterTableSale[] = [];
  let invoices: PromoterInvoice[] = [];
  let promoterView: PromoterView = "overview";
  let promoterNavExpanded: PromoterNavSection = "overview";
  let jobTypeFilter = "all";
  let jobStatusFilter = "all";
  let tableStatusFilter = "all";
  let selectedPromoterJobId: string | null = null;
  let promoterJobsFilters: PromoterJobsFilters = defaultPromoterJobsFilters();
  let clientGuestlistEntries: PromoterGuestlistEntry[] = [];
  let promoterAccount = {
    userId: "",
    email: "",
    username: "",
  };
  let promoterUiDelegateBound = false;
  let promoterInvoicePdfBound = false;
  let adminMode = false;
  let adminPromoters: PromoterProfile[] = [];
  let adminSelectedPromoterId: string | null = null;
  let financialPromoterProfile: FinancialPromoterProfile | null = null;
  let financialBookings: FinancialBooking[] = [];
  const clubs = await fetchClubs().catch(() => [] as Club[]);

  function flash(msg: string, bad = false): void {
    const el = root.querySelector("#promoter-flash");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("admin-flash--error", bad);
    setTimeout(() => {
      if (el.textContent === msg) {
        el.textContent = "";
        el.classList.remove("admin-flash--error");
      }
    }, 3500);
  }

  async function reloadPromoterData(userId: string): Promise<void> {
    const p = await loadPromoterByUser(supabase, userId);
    await reloadPromoterDataByProfile(p.ok ? p.row : null);
  }

  async function reloadPromoterDataByProfile(nextProfile: PromoterProfile | null): Promise<void> {
    if (!nextProfile) {
      profile = null;
      availability = [];
      preferences = [];
      jobs = [];
      guestlistEntries = [];
      nightAdjustments = [];
      tableSales = [];
      invoices = [];
      financialPromoterProfile = null;
      financialBookings = [];
      return;
    }
    profile = nextProfile;
    const [a, pref, j, inv, na, ts] = await Promise.all([
      loadPromoterAvailability(supabase, profile.id),
      loadPromoterPreferences(supabase, profile.id),
      loadPromoterJobs(supabase, profile.id),
      loadPromoterInvoices(supabase, profile.id),
      loadPromoterNightAdjustments(supabase, profile.id),
      loadPromoterTableSales(supabase, profile.id),
    ]);
    availability = a.ok ? a.rows : [];
    preferences = pref.ok ? pref.rows : [];
    jobs = j.ok ? j.rows : [];
    invoices = inv.ok ? inv.rows : [];
    nightAdjustments = na.ok ? na.rows : [];
    tableSales = ts.ok ? ts.rows : [];
    const c = await loadPromoterClientsWorkedWith(supabase, profile.id);
    promoterClients = c.ok ? c.rows : [];
    if (!selectedClientId || !promoterClients.some((x) => x.id === selectedClientId)) {
      selectedClientId = promoterClients[0]?.id ?? null;
    }
    promoterClientAttendances = [];
    selectedClientAttendanceId = null;
    clientGuestlistEntries = [];
    if (selectedClientId) {
      const [at, glClient] = await Promise.all([
        loadPromoterClientAttendances(supabase, profile.id, selectedClientId),
        loadPromoterClientGuestlistViaJobs(supabase, profile.id, selectedClientId),
      ]);
      promoterClientAttendances = at.ok ? at.rows : [];
      clientGuestlistEntries = glClient.ok ? glClient.rows : [];
    }
    if (selectedPromoterJobId && !jobs.some((j) => j.id === selectedPromoterJobId)) {
      selectedPromoterJobId = null;
    }
    const assignedGlJobIds = jobs
      .filter((job) => job.status === "assigned" && job.jobType === "guestlist")
      .map((job) => job.id);
    const gl = await loadPromoterGuestlistEntriesForJobs(supabase, assignedGlJobIds);
    guestlistEntries = gl.ok ? gl.rows : [];
    const finPromRes = await listFinancialPromoters(supabase);
    financialPromoterProfile = finPromRes.ok
      ? finPromRes.data.find((row) => row.userId === profile?.userId) ?? null
      : null;
    if (financialPromoterProfile) {
      const year = new Date().getFullYear();
      const finBookingRes = await listFinancialBookings(supabase, {
        from: `${year}-01-01`,
        to: `${year}-12-31`,
        promoterId: financialPromoterProfile.id,
      });
      financialBookings = finBookingRes.ok ? finBookingRes.data : [];
    } else {
      financialBookings = [];
    }
  }

  function renderAuth(): void {
    root.innerHTML = `
      <div class="admin-card">
        <div class="promoter-auth-grid">
          <form id="promoter-login-form" class="admin-form">
            <h3>Sign in</h3>
            <p class="promoter-auth-hint">Use the email and password you received when your access request was approved.</p>
            <div class="cc-field full"><label>Email</label><input name="email" type="email" required autocomplete="username" /></div>
            <div class="cc-field full"><label>Password</label><input name="password" type="password" required autocomplete="current-password" /></div>
            <button class="cc-btn cc-btn--gold" type="submit">Sign in</button>
          </form>
          <form id="promoter-access-request-form" class="admin-form">
            <h3>Request promoter access</h3>
            <p class="promoter-auth-hint">Submit your name and email. We will confirm by email and notify our team. If approved, you will receive login details to complete your profile.</p>
            <div class="cc-field full"><label>Full name</label><input name="fullName" type="text" required autocomplete="name" /></div>
            <div class="cc-field full"><label>Email</label><input name="email" type="email" required autocomplete="email" /></div>
            <button class="cc-btn cc-btn--ghost" type="submit">Submit request</button>
          </form>
        </div>
        <div class="admin-flash" id="promoter-flash"></div>
      </div>
    `;

    const clientsTableHost = root.querySelector("#promoter-clients-table") as HTMLElement | null;
    if (clientsTableHost) {
      mountDataTable(clientsTableHost, {
        id: "promoter-clients",
        rows: promoterClients,
        rowId: (c) => c.id,
        activeRowId: selectedClientId,
        columns: [
          { key: "name", label: "Name", sortable: true, accessor: (c) => c.name },
          { key: "email", label: "Email", sortable: true, accessor: (c) => c.email || "—" },
          { key: "phone", label: "Phone", accessor: (c) => c.phone || "—" },
          { key: "instagram", label: "Instagram", accessor: (c) => c.instagram || "—" },
          { key: "added", label: "Added", sortable: true, accessor: (c) => c.createdAt.slice(0, 10) || "—" },
          {
            key: "actions",
            label: "Actions",
            render: (c) =>
              `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-client-id="${esc(c.id)}">Edit</button>`,
          },
        ],
        onRowClick: (row) => {
          selectedClientId = row.id;
          selectedClientAttendanceId = null;
          renderDashboard();
        },
      });
    }

    const attendanceTableHost = root.querySelector("#promoter-attendance-table") as HTMLElement | null;
    if (attendanceTableHost) {
      mountDataTable(attendanceTableHost, {
        id: "promoter-attendance",
        rows: promoterClientAttendances,
        rowId: (a) => a.id,
        activeRowId: selectedClientAttendanceId,
        columns: [
          { key: "date", label: "Date", sortable: true, accessor: (a) => a.eventDate },
          { key: "club", label: "Club", accessor: (a) => a.clubSlug },
          {
            key: "spend",
            label: "Spend",
            sortable: true,
            accessor: (a) => Number(a.spendGbp || 0),
            render: (a) => `£${Number(a.spendGbp || 0).toFixed(2)}`,
            align: "right",
          },
          { key: "source", label: "Source", accessor: (a) => a.source || "manual" },
          { key: "details", label: "Details", accessor: (a) => a.notes || "—", render: (a) => esc(a.notes || "—") },
          {
            key: "actions",
            label: "Actions",
            render: (a) =>
              `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-client-attendance-id="${esc(a.id)}">Edit</button>
               <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-promoter-attendance-delete="${esc(a.id)}">Delete</button>`,
          },
        ],
        onRowClick: (row) => {
          selectedClientAttendanceId = row.id;
          renderDashboard();
        },
      });
    }

    const invoicesTableHost = root.querySelector("#promoter-invoices-table") as HTMLElement | null;
    if (invoicesTableHost) {
      mountDataTable(invoicesTableHost, {
        id: "promoter-invoices",
        rows: invoices,
        rowId: (i) => i.id,
        columns: [
          {
            key: "period",
            label: "Period",
            sortable: true,
            accessor: (i) => `${i.periodStart} to ${i.periodEnd}`,
            render: (i) => `${esc(i.periodStart)} to ${esc(i.periodEnd)}`,
          },
          {
            key: "status",
            label: "Status",
            sortable: true,
            accessor: (i) => i.status,
            render: (i) => renderStatusBadge(i.status),
          },
          {
            key: "verification",
            label: "Verification",
            sortable: true,
            accessor: (i) => i.verificationStatus,
            render: (i) => renderInvoiceVerificationBadge(i.verificationStatus),
          },
          {
            key: "submitted",
            label: "Submitted",
            sortable: true,
            accessor: (i) => i.submittedTotalGbp || i.subtotal,
            render: (i) => formatInvoiceGbp(i.submittedTotalGbp || i.subtotal),
            align: "right",
          },
          {
            key: "ledger",
            label: "Ledger (jobs)",
            sortable: true,
            accessor: (i) => i.ledgerTotalGbp,
            render: (i) => (i.ledgerTotalGbp > 0 ? formatInvoiceGbp(i.ledgerTotalGbp) : "—"),
            align: "right",
          },
          {
            key: "total",
            label: "Invoice total",
            sortable: true,
            accessor: (i) => i.total,
            render: (i) => money(i.total),
            align: "right",
          },
          {
            key: "emailed",
            label: "Emailed",
            accessor: (i) => (i.sentAt && i.sentToEmail ? `${i.sentAt.slice(0, 10)} · ${i.sentToEmail}` : "—"),
          },
          {
            key: "actions",
            label: "Actions",
            render: (i) =>
              `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-promoter-invoice-pdf data-invoice-id="${esc(i.id)}">PDF</button>`,
          },
        ],
        empty: { title: "No invoices generated yet." },
        paginated: false,
      });
    }
    root.querySelector("#promoter-login-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const email = String(fd.get("email") || "");
      const password = String(fd.get("password") || "");
      void (async () => {
        const r = await signInPromoter(supabase, email, password);
        if (!r.ok) {
          flash(r.message, true);
          return;
        }
        promoterView = "overview";
        await loadAndRender();
      })();
    });
    root.querySelector("#promoter-access-request-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const fullName = String(fd.get("fullName") || "").trim();
      const email = String(fd.get("email") || "").trim().toLowerCase();
      void (async () => {
        if (!fullName || !email) {
          flash("Please enter your name and email.", true);
          return;
        }
        const id = crypto.randomUUID();
        const { error } = await supabase.from("promoter_signup_requests").insert({
          id,
          full_name: fullName,
          email,
          status: "pending",
        });
        if (error) {
          flash(error.message, true);
          return;
        }
        const key =
          (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
          (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
          "";
        let emailed = false;
        if (key) {
          const n = await notifyPromoterRequestSubmitted(key, id);
          emailed = n.ok;
        }
        flash(
          emailed
            ? "Request received. Check your email for a confirmation message. We will be in touch after review."
            : "Request received. We could not send the confirmation email (deploy the notify-promoter-request Edge Function and set RESEND_API_KEY in function secrets, or check the browser Network tab). Your request is still saved for admin review.",
          !emailed,
        );
        (e.target as HTMLFormElement).reset();
      })();
    });
  }

  function renderWorkspaceBody(): string {
    const v = promoterView;
    if (v === "job_history") {
      const rows = jobs
        .filter((j) => j.status !== "assigned")
        .filter((j) => (jobTypeFilter === "all" ? true : j.jobType === jobTypeFilter))
        .filter((j) => (jobStatusFilter === "all" ? true : j.status === jobStatusFilter));
      const histRows =
        rows.length === 0
          ? `<tr><td colspan="8">${esc("No completed/cancelled jobs yet.")}</td></tr>`
          : rows
              .map(
                (j) =>
                  `<tr><td>${esc(j.jobDate)}</td><td>${esc(j.clubSlug ?? "—")}</td><td>${esc(jobTypeLabel(j.jobType))}${!j.bonusValid ? ` <span class="pp-badge pp-badge--warning"><span class="pp-badge__dot"></span><span class="pp-badge__text">Ratio</span></span>` : ""}</td><td>${esc(j.clientName || "—")}</td><td>${esc(j.clientContact || "—")}</td><td>${esc(j.status)}</td><td>${j.guestsEntered || j.guestsCount}</td><td>${money(j.shiftFee)} + ${money(j.guestlistFee)}/guest</td></tr>`,
              )
              .join("");
      const typeOpts = ["all", "guestlist", "table", "ticket", "venue_hire"]
        .map(
          (t) =>
            `<option value="${esc(t)}"${jobTypeFilter === t ? " selected" : ""}>${t === "all" ? "All types" : esc(jobTypeLabel(t as PromoterJob["jobType"]))}</option>`,
        )
        .join("");
      return `
      <div class="promoter-panel">
        <p class="promoter-panel__title">Jobs history</p>
        <div class="admin-actions" style="margin-bottom:0.7rem">
          <div class="cc-field"><label>Type</label><select id="promoter-job-type-filter">${typeOpts}</select></div>
          <div class="cc-field"><label>Status</label>
            <select id="promoter-job-status-filter">
              <option value="all"${jobStatusFilter === "all" ? " selected" : ""}>All</option>
              <option value="completed"${jobStatusFilter === "completed" ? " selected" : ""}>Completed</option>
              <option value="cancelled"${jobStatusFilter === "cancelled" ? " selected" : ""}>Cancelled</option>
            </select>
          </div>
        </div>
        <div class="promoter-table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Club</th><th>Type</th><th>Client</th><th>Contact</th><th>Status</th><th>Entered</th><th>Comp</th></tr></thead>
            <tbody>${histRows}</tbody>
          </table>
        </div>
      </div>`;
    }
    if (v === "table_history") {
      const rows = tableSales
        .slice()
        .sort((a, b) => (a.saleDate < b.saleDate ? 1 : a.saleDate > b.saleDate ? -1 : 0));
      return `
      <div class="promoter-panel">
        <p class="promoter-panel__title">Table history</p>
        <div class="promoter-table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Club</th><th>Tier</th><th>Tables</th><th>Min spend</th><th>Status</th></tr></thead>
            <tbody>${
              rows.length
                ? rows
                    .map(
                      (r) =>
                        `<tr><td>${esc(r.saleDate)}</td><td>${esc(r.clubSlug || "—")}</td><td>${esc(r.tier || "—")}</td><td>${r.tableCount}</td><td>${money(r.totalMinSpend)}</td><td>${esc(r.approvalStatus)}</td></tr>`,
                    )
                    .join("")
                : "<tr><td colspan='6'>No table-sale history yet.</td></tr>"
            }</tbody>
          </table>
        </div>
      </div>`;
    }
    if (!profile) return "";

    if (v === "overview") {
      const jobsDone = jobs.filter((j) => j.status === "completed");
      const totalGuests = jobsDone.reduce((acc, j) => acc + j.guestsCount, 0);
      const totalEarned = jobsDone.reduce(
        (acc, j) => acc + j.shiftFee + j.guestlistFee * j.guestsCount,
        0,
      );
      const paidFinalProfit = financialBookings
        .filter((booking) => booking.paymentStatus === "paid_final")
        .reduce((sum, booking) => sum + booking.realizedAgencyProfit, 0);
      const upcoming = jobs.filter((j) => j.status === "assigned").length;
      const approvalBadge =
        profile.approvalStatus === "approved"
          ? "Approved"
          : profile.approvalStatus === "rejected"
            ? "Rejected"
            : "Pending";
      return `
        <p class="promoter-status">Signed in as <strong>${esc(profile.displayName || "Promoter")}</strong>. Approval: <strong>${esc(approvalBadge)}</strong>${profile.approvalNotes ? ` — ${esc(profile.approvalNotes)}` : ""}</p>
        <div class="promoter-panel">
          <p class="promoter-panel__title">At a glance</p>
          <div class="promoter-kpi-grid">
            <article><p>Upcoming jobs</p><strong>${upcoming}</strong></article>
            <article><p>Completed jobs</p><strong>${jobsDone.length}</strong></article>
            <article><p>Guestlist guests (completed)</p><strong>${totalGuests}</strong></article>
            <article><p>Earnings (tracked)</p><strong>${money(totalEarned)}</strong></article>
            <article><p>Paid-final agency profit (YTD)</p><strong>${money(paidFinalProfit)}</strong></article>
            <article><p>Commission (linked)</p><strong>${financialPromoterProfile ? `${financialPromoterProfile.commissionPercentage.toFixed(2)}%` : "—"}</strong></article>
          </div>
        </div>
        <div class="promoter-panel">
          <p class="promoter-panel__title">Quick links</p>
          <p class="promoter-main__subtitle" style="margin:0">Use the sidebar to edit your profile, set availability and club preferences, review jobs by status, or open invoices.</p>
        </div>`;
    }

    if (v === "profile") {
      const baseUrls: string[] =
        profile.profileImageUrls?.length > 0
          ? [...profile.profileImageUrls]
          : profile.profileImageUrl.trim()
            ? [profile.profileImageUrl.trim()]
            : [""];
      const imgRows = baseUrls
        .map(
          (url, idx) => `
        <div class="promoter-profile-img-row" data-img-row="${idx}">
          <div class="cc-field full">
            <label>Photo ${idx + 1} URL</label>
            <input type="url" class="p-img-url" value="${esc(url)}" placeholder="https://…" />
          </div>
          <div class="promoter-profile-upload">
            <input type="file" class="p-img-file" accept="image/jpeg,image/png,image/webp,image/gif" />
            <button type="button" class="cc-btn cc-btn--ghost p-img-upload-btn">Upload</button>
            <button type="button" class="cc-btn cc-btn--ghost p-img-remove-btn"${baseUrls.length <= 1 && !url.trim() ? " disabled" : ""}>Remove</button>
          </div>
        </div>`,
        )
        .join("");
      const pf = profile.portfolioClubSlugs ?? [];
      const clubOpts = clubs
        .map(
          (c) =>
            `<option value="${esc(c.slug)}"${pf.includes(c.slug) ? " selected" : ""}>${esc(c.name)}</option>`,
        )
        .join("");
      const previewFirst = (baseUrls[0] ?? "").trim();
      const previewSrc = previewFirst ? ` src="${esc(previewFirst)}"` : "";
      return `
        <div class="promoter-panel">
          <section class="admin-form">
            <h4 class="full">Account & Security</h4>
            <p class="promoter-main__subtitle full" style="margin-top:0">Manage your login email and password for this promoter account.</p>
            <div class="cc-field"><label>Email</label><input id="p-account-email" type="email" autocomplete="email" value="${esc(promoterAccount.email)}" placeholder="name@example.com" /></div>
            <div class="cc-field"><label>Username</label><input id="p-account-username" value="${esc(promoterAccount.username)}" placeholder="Display username" /></div>
            <div class="cc-field"><label>New password</label><input id="p-account-password" type="password" minlength="8" autocomplete="new-password" placeholder="••••••••" /></div>
            <div class="cc-field"><label>Confirm new password</label><input id="p-account-password-confirm" type="password" minlength="8" autocomplete="new-password" placeholder="••••••••" /></div>
            <div class="admin-actions full">
              <button class="cc-btn cc-btn--gold" id="p-save-account-settings" type="button">Save Changes</button>
            </div>
          </section>
        </div>
        <div class="promoter-panel">
          <section class="admin-form">
            <h4 class="full">Profile Details</h4>
            <p class="promoter-main__subtitle full" style="margin-top:0">The team reviews each submission. Use photos you are allowed to publish.</p>
            <div class="cc-field"><label>Display name</label><input id="p-display-name" value="${esc(profile.displayName)}" /></div>
            <div class="cc-field full"><label>Bio</label><textarea id="p-bio" rows="6" placeholder="Experience, venues, languages…">${esc(profile.bio)}</textarea></div>
            <h4 class="full">Payment Details</h4>
            <div class="cc-field"><label>Method</label><input id="p-payment-method" value="${esc(profile.paymentDetails.method)}" placeholder="bank_transfer / card / cash" /></div>
            <div class="cc-field"><label>Beneficiary</label><input id="p-beneficiary-name" value="${esc(profile.paymentDetails.beneficiaryName)}" /></div>
            <div class="cc-field"><label>Account no</label><input id="p-account-number" value="${esc(profile.paymentDetails.accountNumber)}" /></div>
            <div class="cc-field"><label>Sort code</label><input id="p-sort-code" value="${esc(profile.paymentDetails.sortCode)}" /></div>
            <div class="cc-field"><label>IBAN</label><input id="p-iban" value="${esc(profile.paymentDetails.iban)}" /></div>
            <div class="cc-field"><label>SWIFT/BIC</label><input id="p-swift-bic" value="${esc(profile.paymentDetails.swiftBic)}" /></div>
            <div class="cc-field"><label>Reference</label><input id="p-payment-reference" value="${esc(profile.paymentDetails.reference)}" /></div>
            <div class="cc-field"><label>Payout email</label><input id="p-payout-email" value="${esc(profile.paymentDetails.payoutEmail)}" /></div>
            <h4 class="full">Tax Details</h4>
            <div class="cc-field"><label>Registered name</label><input id="p-tax-registered-name" value="${esc(profile.taxDetails.registeredName)}" /></div>
            <div class="cc-field"><label>Tax ID</label><input id="p-tax-id" value="${esc(profile.taxDetails.taxId)}" /></div>
            <div class="cc-field"><label>VAT number</label><input id="p-vat-number" value="${esc(profile.taxDetails.vatNumber)}" /></div>
            <div class="cc-field"><label>Tax country</label><input id="p-tax-country-code" value="${esc(profile.taxDetails.countryCode)}" /></div>
            <div class="cc-field"><label>VAT registered</label><select id="p-is-vat-registered"><option value="true"${profile.taxDetails.isVatRegistered ? " selected" : ""}>yes</option><option value="false"${!profile.taxDetails.isVatRegistered ? " selected" : ""}>no</option></select></div>
            <div class="cc-field full"><label>Tax notes</label><textarea id="p-tax-notes" rows="3">${esc(profile.taxDetails.notes)}</textarea></div>
            <h4 class="full">Media</h4>
            <div id="p-profile-img-rows">${imgRows}</div>
            <div class="admin-actions full">
              <button type="button" class="cc-btn cc-btn--ghost" id="p-add-profile-image"${baseUrls.length >= 12 ? " disabled" : ""}>Add another photo</button>
            </div>
            <p class="promoter-upload-hint full">JPEG, PNG, WebP or GIF (about 6MB each). The first photo is your main thumbnail.</p>
            <div id="p-image-preview-wrap" class="promoter-image-preview-wrap${previewFirst ? "" : " is-empty"}">
              <img id="p-image-preview" class="promoter-image-preview__img"${previewSrc} alt="Primary photo preview" referrerpolicy="no-referrer"${previewFirst ? "" : " hidden"} />
            </div>
            <h4 class="full">Portfolio Clubs</h4>
            <p class="promoter-main__subtitle full" style="margin-top:0">Choose venues for your public-facing profile (Ctrl/Command + click for multiple).</p>
            <div class="cc-field full">
              <label for="p-portfolio-clubs">Venues</label>
              <select id="p-portfolio-clubs" multiple size="8" class="promoter-portfolio-select">${clubOpts}</select>
            </div>
            <div class="admin-actions full">
              <button class="cc-btn cc-btn--gold" id="p-save-profile" type="button">Submit for Approval</button>
            </div>
            <h4 class="full">Financial Profile</h4>
            <p class="promoter-main__subtitle full" style="margin-top:0">Commission is controlled by admin. Payout and tax fields above are editable here and used for invoice/payee linkage.</p>
            <div class="cc-field"><label>Linked financial promoter</label><input readonly value="${esc(financialPromoterProfile?.name || "Not linked yet")}" /></div>
            <div class="cc-field"><label>Commission percentage</label><input readonly value="${financialPromoterProfile ? esc(financialPromoterProfile.commissionPercentage.toFixed(2)) : "0.00"}" /></div>
            <div class="cc-field"><label>Financial bookings (YTD)</label><input readonly value="${String(financialBookings.length)}" /></div>
          </section>
        </div>`;
    }

    if (v === "preferences") {
      const availabilityBlock = WEEKDAY_LABELS.map((label, idx) => {
        const row = availability.find((a) => a.weekday === idx);
        const available = row ? row.isAvailable : false;
        const st = row?.startTime ?? "";
        const et = row?.endTime ?? "";
        return `<div class="promoter-day-row full">
          <label><input type="checkbox" data-weekday="${idx}" data-available ${available ? "checked" : ""}/> ${label}</label>
          <input type="time" data-weekday="${idx}" data-start value="${esc(st)}" />
          <input type="time" data-weekday="${idx}" data-end value="${esc(et)}" />
        </div>`;
      }).join("");

      const prefLines =
        preferences
          .map(
            (p) =>
              `<p><strong>${esc(p.clubSlug)}</strong> · ${esc(p.weekdays.join("|"))} · <span class="promoter-pref-status">${esc(p.status)}</span>${p.notes ? ` — ${esc(p.notes)}` : ""}</p>`,
          )
          .join("") || "<p>No club preferences submitted yet.</p>";

      return `
        <div class="promoter-panel">
          <h4>Weekly availability</h4>
          <p class="promoter-main__subtitle" style="margin-top:0">Tick the days you can work and optional start / end times.</p>
          <section class="admin-form" style="margin-top:0.75rem">
            ${availabilityBlock}
            <div class="admin-actions full">
              <button class="cc-btn cc-btn--gold" id="p-save-availability" type="button">Save Changes</button>
            </div>
          </section>
        </div>
        <div class="promoter-panel">
          <h4>Preferred clubs &amp; nights</h4>
          <p class="promoter-main__subtitle" style="margin-top:0">Submit where you like to work; the team will review each preference.</p>
          <section class="admin-form" style="margin-top:0.75rem">
            <div class="cc-field"><label>Club</label>
              <select id="p-pref-club">${clubs.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join("")}</select>
            </div>
            <div class="cc-field"><label>Days (pipe-separated)</label><input id="p-pref-days" placeholder="Thu|Fri|Sat" /></div>
            <div class="cc-field full"><label>Notes</label><textarea id="p-pref-notes" rows="3" placeholder="Door experience, languages, etc."></textarea></div>
            <div class="admin-actions full">
              <button class="cc-btn cc-btn--ghost" id="p-save-preference" type="button">Submit for Review</button>
            </div>
          </section>
          <div class="promoter-pref-list">
            <p class="promoter-panel__title">Your submissions</p>
            ${prefLines}
          </div>
        </div>
        <div class="promoter-panel">
          <h4>One-off night changes</h4>
          <p class="promoter-main__subtitle" style="margin-top:0">Override your usual weekly pattern for a specific date. Each request is reviewed.</p>
          <form class="admin-form" id="p-night-adj-form" style="margin-top:0.75rem">
            <div class="cc-field"><label>Date</label><input type="date" name="nightDate" required /></div>
            <div class="cc-field full"><label><input type="checkbox" name="availableOverride" checked /> Available this night</label></div>
            <div class="cc-field"><label>Start (optional)</label><input type="time" name="startTime" /></div>
            <div class="cc-field"><label>End (optional)</label><input type="time" name="endTime" /></div>
            <div class="cc-field full"><label>Notes</label><textarea name="notes" rows="2" placeholder="Context for the team"></textarea></div>
            <div class="admin-actions full">
              <button type="submit" class="cc-btn cc-btn--gold">Submit night change</button>
            </div>
          </form>
          <div class="promoter-table-wrap" style="margin-top:1rem">
            <table>
              <thead><tr><th>Night</th><th>Override</th><th>From</th><th>To</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>${
                nightAdjustments.length === 0
                  ? "<tr><td colspan=\"6\">No requests yet.</td></tr>"
                  : nightAdjustments
                      .map(
                        (n) =>
                          `<tr><td>${esc(n.nightDate)}</td><td>${n.availableOverride ? "Available" : "Unavailable"}</td><td>${esc(n.startTime ?? "—")}</td><td>${esc(n.endTime ?? "—")}</td><td><span class="promoter-gl-status promoter-gl-status--${esc(n.status)}">${esc(n.status)}</span></td><td>${esc(n.notes || "—")}</td></tr>`,
                      )
                      .join("")
              }</tbody>
            </table>
          </div>
        </div>`;
    }

    if (v === "tables") {
      const today = new Date().toISOString().slice(0, 10);
      const clubOpts = clubs
        .map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`)
        .join("");
      const tierOpts = ["standard", "luxury", "vip", "other"]
        .map((t) => `<option value="${esc(t)}">${esc(t)}</option>`)
        .join("");
      const jobOpts = jobs
        .filter((j) => j.status === "assigned" || j.status === "completed")
        .map(
          (j) =>
            `<option value="${esc(j.id)}">${esc(j.jobDate)} · ${esc(j.clubSlug ?? "—")} · ${esc(j.service)} · ${esc(j.status)}</option>`,
        )
        .join("");
      const visibleRows = tableSales.filter((r) =>
        tableStatusFilter === "all" ? true : r.approvalStatus === tableStatusFilter,
      );
      const clientOptions = promoterClients
        .map(
          (c) =>
            `<option value="${esc(c.id)}">${esc(c.name)}${c.phone ? ` · ${esc(c.phone)}` : c.instagram ? ` · @${esc(c.instagram.replace(/^@/, ""))}` : ""}</option>`,
        )
        .join("");
      const hist =
        visibleRows.length === 0
          ? "<tr><td colspan=\"8\">No rows yet.</td></tr>"
          : visibleRows
              .map(
                (r) =>
                  `<tr><td>${esc(r.saleDate)}</td><td><code>${esc(r.clubSlug)}</code></td><td>${esc(r.entryChannel)}</td><td>${esc(r.tier)}</td><td>${r.tableCount}</td><td>${money(r.totalMinSpend)}</td><td><span class="promoter-gl-status promoter-gl-status--${esc(r.approvalStatus)}">${esc(r.approvalStatus)}</span></td><td>${esc(r.notes || "—")}</td></tr>`,
              )
              .join("");
      return `
        <div class="promoter-panel">
          <h4>Log a table booking</h4>
          <p class="promoter-main__subtitle" style="margin-top:0">Each submission is reviewed. Optional job link must match the same club and date.</p>
          <form class="admin-form" id="p-table-sale-form" style="margin-top:0.75rem">
            <div class="cc-field"><label>Date</label><input type="date" name="saleDate" required value="${esc(today)}" /></div>
            <div class="cc-field"><label>Club</label>
              <select name="clubSlug" required>${clubOpts}</select>
            </div>
            <div class="cc-field"><label>Client</label><select name="clientId"><option value="">— Select client —</option>${clientOptions}</select></div>
            <div class="cc-field full"><label>Link to job (optional)</label>
              <select name="promoterJobId"><option value="">— None —</option>${jobOpts}</select>
            </div>
            <div class="cc-field"><label>Tier</label><select name="tier">${tierOpts}</select></div>
            <div class="cc-field"><label>Table count</label><input type="number" name="tableCount" min="1" max="99" value="1" required /></div>
            <div class="cc-field"><label>Total min spend (£)</label><input type="number" name="totalMinSpend" min="0" step="0.01" value="0" /></div>
            <div class="cc-field full"><label>Notes</label><textarea name="notes" rows="2" placeholder="Booking name, bottle package, etc."></textarea></div>
            <div class="admin-actions full">
              <button type="submit" class="cc-btn cc-btn--gold">Submit for review</button>
            </div>
          </form>
        </div>
        <div class="promoter-panel">
          <p class="promoter-panel__title">Your submissions</p>
          <div class="admin-actions" style="margin-bottom:0.7rem">
            <label class="cc-field" style="max-width:220px">
              <span>Status filter</span>
              <select id="promoter-table-status-filter">
                <option value="all" ${tableStatusFilter === "all" ? "selected" : ""}>All</option>
                <option value="pending" ${tableStatusFilter === "pending" ? "selected" : ""}>Pending</option>
                <option value="approved" ${tableStatusFilter === "approved" ? "selected" : ""}>Approved</option>
                <option value="rejected" ${tableStatusFilter === "rejected" ? "selected" : ""}>Rejected</option>
              </select>
            </label>
          </div>
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Club</th><th>Channel</th><th>Tier</th><th>Tables</th><th>Min spend</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>${hist}</tbody>
            </table>
          </div>
        </div>`;
    }

    if (v === "clients") {
      const selected = promoterClients.find((c) => c.id === selectedClientId) ?? null;
      const selectedAttendance =
        (selectedClientAttendanceId &&
          promoterClientAttendances.find((a) => a.id === selectedClientAttendanceId)) ||
        null;
      const clubSelect = clubs
        .map(
          (club) =>
            `<option value="${esc(club.slug)}"${club.slug === selectedAttendance?.clubSlug ? " selected" : ""}>${esc(club.name)}</option>`,
        )
        .join("");
      return `
        <div class="promoter-panel">
          <h4>Client directory</h4>
          <p class="promoter-main__subtitle" style="margin-top:0">Create or update clients; duplicates are merged by email, phone, or Instagram for your account.</p>
          <div id="promoter-clients-table"></div>
        </div>
        <div class="promoter-panel">
          <h4>${selected ? "Edit client" : "Create client"}</h4>
          ${
            promoterClientFormOpen || selected
              ? `<form class="admin-form" id="promoter-client-form" data-collapsible="true">
            <input type="hidden" name="id" value="${esc(selected?.id || "")}" />
            <h4 class="full">Contact Details</h4>
            <div class="cc-field pp-col-6"><label>Name</label><input name="name" required value="${esc(selected?.name || "")}" /></div>
            <div class="cc-field pp-col-6"><label>Email</label><input name="email" type="email" value="${esc(selected?.email || "")}" /></div>
            <div class="cc-field pp-col-6"><label>Phone</label><input name="phone" value="${esc(selected?.phone || "")}" /></div>
            <div class="cc-field pp-col-6"><label>Instagram</label><input name="instagram" value="${esc(selected?.instagram || "")}" placeholder="@handle" /></div>
            <h4 class="full">Notes</h4>
            <div class="cc-field full"><label>Notes (Internal)</label><textarea name="notes" rows="3">${esc(selected?.notes || "")}</textarea></div>
            <div class="admin-actions full">
              <button class="cc-btn cc-btn--gold" type="submit">${selected ? "Save client" : "Create client"}</button>
              <button class="cc-btn cc-btn--ghost" type="button" id="promoter-client-new">Create New</button>
            </div>
          </form>`
              : `<p class="admin-note">Client form hidden until Add new/Edit is clicked.</p><button type="button" class="pp-btn pp-btn--primary" id="promoter-open-client-form">Open Form</button>`
          }
          ${
            selected
              ? `<h4 style="margin-top:1rem">Past visits</h4>
          <div id="promoter-attendance-table"></div>
          ${
            promoterClientAttendanceFormOpen || selectedAttendance
              ? `<form class="admin-form" id="promoter-client-attendance-form" data-collapsible="true" style="margin-top:0.8rem">
            <input type="hidden" name="attendanceId" value="${esc(selectedAttendance?.id || "")}" />
            <h4 class="full">Visit Details</h4>
            <div class="cc-field pp-col-3"><label>Date</label><input type="date" name="eventDate" required value="${esc(selectedAttendance?.eventDate || new Date().toISOString().slice(0, 10))}" /></div>
            <div class="cc-field pp-col-5"><label>Club</label><select name="clubSlug">${clubSelect}</select></div>
            <div class="cc-field pp-col-2"><label>Spend (£)</label><input type="number" name="spendGbp" min="0" step="0.01" value="${esc(String(selectedAttendance?.spendGbp ?? 0))}" /></div>
            <div class="cc-field pp-col-2"><label>Source</label><input name="source" value="${esc(selectedAttendance?.source || "manual")}" /></div>
            <div class="cc-field full"><label>Details</label><textarea name="notes" rows="2">${esc(selectedAttendance?.notes || "")}</textarea></div>
            <div class="admin-actions full">
              <button class="cc-btn cc-btn--gold" type="submit">${selectedAttendance ? "Save Changes" : "Create Visit"}</button>
              ${
                selectedAttendance
                  ? `<button class="cc-btn cc-btn--ghost" type="button" id="promoter-client-attendance-new">Create New</button>`
                  : ""
              }
            </div>
          </form>`
              : `<p class="admin-note">Visit form hidden until Add new/Edit is clicked.</p><button type="button" class="pp-btn pp-btn--primary" id="promoter-open-attendance-form">Open Form</button>`
          }`
              : ""
          }
          ${
            selected
              ? `<h4 style="margin-top:1.25rem">Guestlist activity</h4>
          <p class="admin-note" style="margin-top:0">Names submitted on your guestlist jobs for this client.</p>
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Guest</th><th>Contact</th><th>Status</th><th>Added</th></tr></thead>
              <tbody>${
                clientGuestlistEntries.length === 0
                  ? '<tr><td colspan="4">No guestlist entries linked to this client yet.</td></tr>'
                  : clientGuestlistEntries
                      .map(
                        (e) =>
                          `<tr><td>${esc(e.guestName)}</td><td>${esc(e.guestContact || "—")}</td><td><span class="promoter-gl-status promoter-gl-status--${esc(e.approvalStatus)}">${esc(e.approvalStatus)}</span></td><td>${esc(e.createdAt.slice(0, 10))}</td></tr>`,
                      )
                      .join("")
              }</tbody>
            </table>
          </div>`
              : ""
          }
        </div>`;
    }

    if (v === "jobs") {
      return renderPromoterJobsViewHtml({
        jobs,
        filters: promoterJobsFilters,
        selectedJobId: selectedPromoterJobId,
        clients: promoterClients,
        clubs,
        rates: [],
        guestlistEntries,
      });
    }

    if (v === "invoices") {
      return `
      <div class="promoter-panel">
        <p class="promoter-panel__title">Statements</p>
        <p class="promoter-main__subtitle" style="margin-top:0">Verification status is read-only. Totals match admin-generated invoices (ledger from completed jobs vs submitted lines).</p>
        <div id="promoter-invoices-table"></div>
      </div>`;
    }

    return `<p class="admin-note">Choose a section from the menu.</p>`;
  }

  function renderDashboard(): void {
    if (!profile) {
      if (adminMode) {
        root.innerHTML = `<div class="admin-card"><p>No promoter profiles found yet. Create a promoter in admin portal, then switch back here.</p></div>`;
        return;
      }
      renderAuth();
      return;
    }
    const v = promoterView;
    const vh = PROMOTER_VIEW_HEADINGS[v];
    const tab = (id: PromoterView, label: string) =>
      `<button type="button" class="promoter-view-tab ${v === id ? "is-active" : ""}" data-promoter-view="${id}">${esc(label)}</button>`;
    const navSection = (
      section: PromoterNavSection,
      label: string,
      body: string,
    ): string => {
      const open = promoterNavExpanded === section;
      return `<div class="promoter-nav-block ${open ? "is-open" : ""}">
        <button type="button" class="promoter-nav-heading" data-promoter-nav-toggle="${section}" aria-expanded="${open ? "true" : "false"}">${esc(label)}</button>
        <div class="promoter-nav-items"${open ? "" : " hidden"}>
          ${body}
        </div>
      </div>`;
    };

    root.innerHTML = `
      <div class="promoter-shell">
        <aside class="promoter-sidebar" aria-label="Promoter portal">
          <div class="promoter-sidebar__brand">
            <p class="promoter-sidebar__eyebrow">Cooper Concierge</p>
            <p class="promoter-sidebar__title">Promoter</p>
          </div>
          <nav class="promoter-sidebar__nav">
            ${navSection("overview", "Overview", `${tab("overview", "Overview")}`)}
            ${navSection("account", "Account", `${tab("profile", "My profile")}${tab("preferences", "Work preferences")}`)}
            ${navSection("work", "Work", `${tab("jobs", "Jobs")}${tab("job_history", "Jobs history")}${tab("tables", "Tables sold")}${tab("table_history", "Tables history")}${tab("clients", "Clients")}`)}
            ${navSection("finance", "Finance", `${tab("invoices", "Invoices")}`)}
          </nav>
          <div class="promoter-sidebar__footer">
            <button class="promoter-sidebar__btn" id="promoter-signout" type="button">Sign out</button>
          </div>
        </aside>
        <div class="promoter-main">
          <header class="promoter-main__header">
            <div>
              <h2 class="promoter-main__title">${esc(vh.title)}</h2>
              <p class="promoter-main__subtitle">${esc(vh.subtitle)}</p>
              ${
                adminMode && adminPromoters.length
                  ? `<div class="cc-field" style="margin-top:0.6rem; max-width:360px">
                      <label>Admin view: promoter account</label>
                      <select id="promoter-admin-target">
                        ${adminPromoters
                          .map(
                            (p) =>
                              `<option value="${esc(p.id)}"${p.id === adminSelectedPromoterId ? " selected" : ""}>${esc(p.displayName || p.id.slice(0, 8))}</option>`,
                          )
                          .join("")}
                      </select>
                    </div>`
                  : ""
              }
            </div>
            <div class="promoter-account">
              <button type="button" class="promoter-account__btn" id="promoter-account-btn" aria-haspopup="menu" aria-expanded="false">Account</button>
              <div class="promoter-account__menu" id="promoter-account-menu" role="menu" hidden>
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="profile">Open Profile</button>
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="preferences">Open Work Preferences</button>
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="jobs">Open Jobs</button>
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="tables">Open Tables Sold</button>
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="clients">Open Clients</button>
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="job_history">Open Jobs History</button>
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="table_history">Open Tables History</button>
                <button type="button" role="menuitem" class="promoter-account__item promoter-account__item--danger" id="promoter-account-signout">Sign out</button>
              </div>
            </div>
          </header>
          <div class="promoter-workspace">
            ${renderWorkspaceBody()}
            <div class="admin-flash" id="promoter-flash" style="margin-top:1rem"></div>
          </div>
        </div>
      </div>
    `;
    applyCollapsibleFormSections(root);
    if (promoterView === "jobs" && profile) {
      bindPromoterJobsEvents({
        root,
        supabase,
        getProfileId: () => profile?.id ?? "",
        getJobs: () => jobs,
        getSelectedJobId: () => selectedPromoterJobId,
        setSelectedJobId: (id) => {
          selectedPromoterJobId = id;
        },
        getFilters: () => promoterJobsFilters,
        setFilters: (f) => {
          promoterJobsFilters = f;
        },
        reload: loadAndRender,
        flash,
        renderDashboard,
      });
    }
    const mountPromoterFormModal = (
      formSelector: string,
      title: string,
      onClose: () => void,
    ): void => {
      const form = root.querySelector(formSelector) as HTMLElement | null;
      if (!form || form.closest(".pp-modal")) return;
      const host = document.createElement("div");
      host.className = "pp-modal-host finx-modal-host";
      host.innerHTML = `<div class="pp-modal__overlay">
        <div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="pp-modal__header">
            <h4 class="pp-modal__title">${esc(title)}</h4>
            <button type="button" class="pp-modal__close" aria-label="Close">×</button>
          </div>
          <div class="pp-modal__body"></div>
        </div>
      </div>`;
      (host.querySelector(".pp-modal__body") as HTMLElement | null)?.append(form);
      host.querySelector(".pp-modal__close")?.addEventListener("click", onClose);
      host.querySelector(".pp-modal__overlay")?.addEventListener("click", (ev) => {
        if (ev.target === ev.currentTarget) onClose();
      });
      root.append(host);
    };
    if (promoterView === "clients" && promoterClientFormOpen) {
      mountPromoterFormModal("#promoter-client-form", "Client details", () => {
        promoterClientFormOpen = false;
        renderDashboard();
      });
    }
    if (promoterView === "clients" && promoterClientAttendanceFormOpen) {
      mountPromoterFormModal("#promoter-client-attendance-form", "Client visit", () => {
        promoterClientAttendanceFormOpen = false;
        selectedClientAttendanceId = null;
        renderDashboard();
      });
    }

    root.querySelectorAll(".promoter-view-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = (btn as HTMLButtonElement).dataset.promoterView as
          | PromoterView
          | undefined;
        if (!id) return;
        promoterView = id;
        promoterNavExpanded =
          id === "overview"
            ? "overview"
            : id === "profile" || id === "preferences"
              ? "account"
              : id === "invoices"
                ? "finance"
                : "work";
        renderDashboard();
      });
    });
    root.querySelectorAll("[data-promoter-nav-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const section = (btn as HTMLButtonElement).dataset
          .promoterNavToggle as PromoterNavSection | undefined;
        if (!section) return;
        promoterNavExpanded = promoterNavExpanded === section ? "overview" : section;
        renderDashboard();
      });
    });

    root.querySelector("#promoter-signout")?.addEventListener("click", () => {
      void signOutAdmin(supabase).then(() => {
        promoterView = "overview";
        renderAuth();
      });
    });
    const accountBtn = root.querySelector("#promoter-account-btn") as HTMLButtonElement | null;
    const accountMenu = root.querySelector("#promoter-account-menu") as HTMLElement | null;
    const setAccountMenu = (open: boolean): void => {
      if (!accountBtn || !accountMenu) return;
      accountBtn.setAttribute("aria-expanded", String(open));
      accountMenu.hidden = !open;
    };
    accountBtn?.addEventListener("click", () => {
      const open = accountBtn.getAttribute("aria-expanded") === "true";
      setAccountMenu(!open);
    });
    accountMenu?.addEventListener("click", (ev) => {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      const v = t.getAttribute("data-promoter-menu-view") as PromoterView | null;
      if (v) {
        promoterView = v;
        renderDashboard();
        return;
      }
      if (t.id === "promoter-account-signout") {
        void signOutAdmin(supabase).then(() => {
          promoterView = "overview";
          renderAuth();
        });
      }
    });
    root.addEventListener("click", (ev) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (accountBtn?.contains(target) || accountMenu?.contains(target)) return;
      setAccountMenu(false);
    });

    const syncPrimaryPhotoPreview = (): void => {
      const firstUrl = root.querySelector(".p-img-url") as HTMLInputElement | null;
      const prev = root.querySelector("#p-image-preview") as HTMLImageElement | null;
      const wrap = root.querySelector("#p-image-preview-wrap") as HTMLElement | null;
      if (!firstUrl || !prev || !wrap) return;
      const url = firstUrl.value.trim();
      if (url && /^https?:\/\//i.test(url)) {
        prev.src = url;
        prev.removeAttribute("hidden");
        wrap.classList.remove("is-empty");
      } else {
        prev.removeAttribute("src");
        prev.setAttribute("hidden", "");
        wrap.classList.add("is-empty");
      }
    };

    if (!promoterInvoicePdfBound) {
      promoterInvoicePdfBound = true;
      root.addEventListener("click", (ev) => {
        const btn = (ev.target as HTMLElement | null)?.closest(
          "button[data-promoter-invoice-pdf]",
        ) as HTMLButtonElement | null;
        if (!btn) return;
        const invoiceId = btn.dataset.invoiceId?.trim();
        if (!invoiceId) return;
        const anonKey =
          (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
          (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
          "";
        void (async () => {
          if (!anonKey.trim()) {
            flash("App is missing Supabase anon key.", true);
            return;
          }
          const { data: sess } = await supabase.auth.getSession();
          const token = sess.session?.access_token ?? "";
          if (!token) {
            flash("Session expired — sign in again.", true);
            return;
          }
          const res = await callPromoterInvoiceEdge(anonKey.trim(), token, invoiceId, "pdf");
          if (!res.ok) {
            flash(res.message || "Could not load PDF.", true);
            return;
          }
          if (res.action !== "pdf") {
            flash("Unexpected invoice response for PDF action.", true);
            return;
          }
          downloadPdfFromBase64(res.pdfBase64, res.filename);
          flash("PDF downloaded.");
        })();
      });
    }

    if (!promoterUiDelegateBound) {
      promoterUiDelegateBound = true;
      root.addEventListener("click", (ev) => {
        const t = ev.target as HTMLElement | null;
        if (!t) return;
        const uploadBtn = t.closest(".p-img-upload-btn");
        if (uploadBtn) {
          const row = uploadBtn.closest(".promoter-profile-img-row");
          const urlInput = row?.querySelector(".p-img-url") as HTMLInputElement | null;
          const fileInput = row?.querySelector(".p-img-file") as HTMLInputElement | null;
          const file = fileInput?.files?.[0];
          if (!file || !urlInput) {
            flash("Choose an image file in that row first.", true);
            return;
          }
          if (!file.type.startsWith("image/")) {
            flash("Please choose an image file (JPEG, PNG, WebP, or GIF).", true);
            return;
          }
          if (file.size > 6 * 1024 * 1024) {
            flash("Image is too large — try under 6MB.", true);
            return;
          }
          const pid = profile?.id;
          if (!pid) return;
          void (async () => {
            const path = `promoter-profiles/${pid}/${safePromoterProfileFileSegment(file.name)}`;
            const { error } = await supabase.storage
              .from(PROMOTER_PROFILE_IMAGE_BUCKET)
              .upload(path, file, { upsert: true, contentType: file.type });
            if (error) {
              flash(`Upload failed: ${error.message}`, true);
              return;
            }
            const pub = supabase.storage
              .from(PROMOTER_PROFILE_IMAGE_BUCKET)
              .getPublicUrl(path);
            urlInput.value = pub.data.publicUrl;
            syncPrimaryPhotoPreview();
            if (fileInput) fileInput.value = "";
            flash("Photo uploaded.");
          })();
          return;
        }
        const rm = t.closest(".p-img-remove-btn") as HTMLButtonElement | null;
        if (rm && !rm.disabled) {
          const wrapRows = root.querySelector("#p-profile-img-rows");
          const rows = wrapRows?.querySelectorAll(".promoter-profile-img-row") ?? [];
          if (rows.length <= 1) return;
          rm.closest(".promoter-profile-img-row")?.remove();
          syncPrimaryPhotoPreview();
        }
      });
      root.addEventListener("input", (ev) => {
        const el = ev.target as HTMLElement | null;
        if (el?.classList.contains("p-img-url")) syncPrimaryPhotoPreview();
      });
    }

    root.querySelector("#p-add-profile-image")?.addEventListener("click", () => {
      const wrap = root.querySelector("#p-profile-img-rows");
      if (!wrap) return;
      const n = wrap.querySelectorAll(".promoter-profile-img-row").length;
      if (n >= 12) return;
      const idx = n;
      wrap.insertAdjacentHTML(
        "beforeend",
        `<div class="promoter-profile-img-row" data-img-row="${idx}">
          <div class="cc-field full">
            <label>Photo ${idx + 1} URL</label>
            <input type="url" class="p-img-url" value="" placeholder="https://…" />
          </div>
          <div class="promoter-profile-upload">
            <input type="file" class="p-img-file" accept="image/jpeg,image/png,image/webp,image/gif" />
            <button type="button" class="cc-btn cc-btn--ghost p-img-upload-btn">Upload</button>
            <button type="button" class="cc-btn cc-btn--ghost p-img-remove-btn">Remove</button>
          </div>
        </div>`,
      );
      const addBtn = root.querySelector("#p-add-profile-image") as HTMLButtonElement | null;
      if (addBtn && wrap.querySelectorAll(".promoter-profile-img-row").length >= 12) {
        addBtn.disabled = true;
      }
    });

    root.querySelector("#p-save-profile")?.addEventListener("click", () => {
      if (!profile) return;
      const displayName = String(
        (root.querySelector("#p-display-name") as HTMLInputElement)?.value || "",
      ).trim();
      const bio = String(
        (root.querySelector("#p-bio") as HTMLTextAreaElement)?.value || "",
      ).trim();
      const urls = [...root.querySelectorAll(".p-img-url")]
        .map((el) => String((el as HTMLInputElement).value || "").trim())
        .filter(Boolean)
        .slice(0, 12);
      const profileImageUrl = urls[0] ?? "";
      const sel = root.querySelector("#p-portfolio-clubs") as HTMLSelectElement | null;
      const portfolio = sel
        ? [...sel.selectedOptions].map((o) => o.value.trim()).filter(Boolean)
        : [];
      const paymentDetails = {
        method: String((root.querySelector("#p-payment-method") as HTMLInputElement | null)?.value || "").trim(),
        beneficiaryName: String((root.querySelector("#p-beneficiary-name") as HTMLInputElement | null)?.value || "").trim(),
        accountNumber: String((root.querySelector("#p-account-number") as HTMLInputElement | null)?.value || "").trim(),
        sortCode: String((root.querySelector("#p-sort-code") as HTMLInputElement | null)?.value || "").trim(),
        iban: String((root.querySelector("#p-iban") as HTMLInputElement | null)?.value || "").trim(),
        swiftBic: String((root.querySelector("#p-swift-bic") as HTMLInputElement | null)?.value || "").trim(),
        reference: String((root.querySelector("#p-payment-reference") as HTMLInputElement | null)?.value || "").trim(),
        payoutEmail: String((root.querySelector("#p-payout-email") as HTMLInputElement | null)?.value || "").trim(),
      };
      const taxDetails = {
        registeredName: String((root.querySelector("#p-tax-registered-name") as HTMLInputElement | null)?.value || "").trim(),
        taxId: String((root.querySelector("#p-tax-id") as HTMLInputElement | null)?.value || "").trim(),
        vatNumber: String((root.querySelector("#p-vat-number") as HTMLInputElement | null)?.value || "").trim(),
        countryCode: String((root.querySelector("#p-tax-country-code") as HTMLInputElement | null)?.value || "").trim().toUpperCase(),
        isVatRegistered:
          String((root.querySelector("#p-is-vat-registered") as HTMLSelectElement | null)?.value || "false").trim() === "true",
        notes: String((root.querySelector("#p-tax-notes") as HTMLTextAreaElement | null)?.value || "").trim(),
      };
      void (async () => {
        const r = await submitPromoterRevision(supabase, profile.id, {
          display_name: displayName,
          bio,
          profile_image_url: profileImageUrl,
          profile_image_urls: urls,
          portfolio_club_slugs: portfolio,
          payment_details: paymentDetails,
          tax_details: taxDetails,
        });
        if (!r.ok) {
          flash(r.message, true);
          return;
        }
        flash("Profile revision submitted for approval.");
      })();
    });
    root.querySelector("#p-save-account-settings")?.addEventListener("click", () => {
      const email = String(
        (root.querySelector("#p-account-email") as HTMLInputElement | null)?.value || "",
      )
        .trim()
        .toLowerCase();
      const username = String(
        (root.querySelector("#p-account-username") as HTMLInputElement | null)?.value || "",
      ).trim();
      const password = String(
        (root.querySelector("#p-account-password") as HTMLInputElement | null)?.value || "",
      ).trim();
      const passwordConfirm = String(
        (root.querySelector("#p-account-password-confirm") as HTMLInputElement | null)?.value || "",
      ).trim();
      if (!promoterAccount.userId) {
        flash("Missing account session context. Reload and try again.", true);
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        flash("Enter a valid email address.", true);
        return;
      }
      if (!username) {
        flash("Username is required.", true);
        return;
      }
      if (password && password.length < 8) {
        flash("New password must be at least 8 characters.", true);
        return;
      }
      if (password && password !== passwordConfirm) {
        flash("Password confirmation does not match.", true);
        return;
      }
      const emailChanged = email !== promoterAccount.email;
      const usernameChanged = username !== promoterAccount.username;
      const passwordChanged = Boolean(password);
      if (!emailChanged && !usernameChanged && !passwordChanged) {
        flash("No account changes to save.");
        return;
      }
      void (async () => {
        const { data: profileRow, error: profileReadError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", promoterAccount.userId)
          .maybeSingle();
        if (profileReadError) {
          flash(`Could not verify profile: ${profileReadError.message}`, true);
          return;
        }
        const role = String(profileRow?.role || "promoter");
        const { error: profileWriteError } = await supabase.from("profiles").upsert(
          {
            id: promoterAccount.userId,
            role,
            display_name: username,
          },
          { onConflict: "id" },
        );
        if (profileWriteError) {
          flash(`Could not save username: ${profileWriteError.message}`, true);
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
            flash(`Could not update account: ${authError.message}`, true);
            return;
          }
        }
        promoterAccount = {
          ...promoterAccount,
          email,
          username,
        };
        flash(
          emailChanged
            ? "Account settings updated. Confirm the new email from your inbox if prompted."
            : "Account settings updated.",
        );
        renderDashboard();
      })();
    });

    root.querySelector("#p-save-availability")?.addEventListener("click", () => {
      if (!profile) return;
      const rows = WEEKDAY_LABELS.map((_, idx) => {
        const chk = root.querySelector(
          `[data-weekday="${idx}"][data-available]`,
        ) as HTMLInputElement | null;
        const st = root.querySelector(
          `[data-weekday="${idx}"][data-start]`,
        ) as HTMLInputElement | null;
        const et = root.querySelector(
          `[data-weekday="${idx}"][data-end]`,
        ) as HTMLInputElement | null;
        return {
          weekday: idx,
          is_available: Boolean(chk?.checked),
          start_time: st?.value || null,
          end_time: et?.value || null,
        };
      });
      void (async () => {
        const r = await savePromoterAvailability(supabase, profile.id, rows);
        if (!r.ok) {
          flash(r.message, true);
          return;
        }
        flash("Availability updated.");
      })();
    });

    root.querySelector("#p-save-preference")?.addEventListener("click", () => {
      if (!profile) return;
      const clubSlug = String(
        (root.querySelector("#p-pref-club") as HTMLSelectElement)?.value || "",
      ).trim();
      const days = parseClubDays(
        String((root.querySelector("#p-pref-days") as HTMLInputElement)?.value || ""),
      );
      const notes = String(
        (root.querySelector("#p-pref-notes") as HTMLTextAreaElement)?.value || "",
      ).trim();
      if (!clubSlug || !days.length) {
        flash("Select a club and at least one day.", true);
        return;
      }
      void (async () => {
        const r = await savePromoterPreference(supabase, profile.id, {
          club_slug: clubSlug,
          weekdays: days,
          notes,
        });
        if (!r.ok) {
          flash(r.message, true);
          return;
        }
        await loadAndRender();
        flash("Preference submitted.");
      })();
    });

    root.querySelector("#p-night-adj-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!profile) return;
      const fd = new FormData(e.target as HTMLFormElement);
      const nightDate = String(fd.get("nightDate") || "").trim();
      const availableOverride = Boolean(fd.get("availableOverride"));
      const startTime = String(fd.get("startTime") || "").trim() || null;
      const endTime = String(fd.get("endTime") || "").trim() || null;
      const notes = String(fd.get("notes") || "").trim();
      void (async () => {
        const r = await upsertPromoterNightAdjustment(supabase, {
          nightDate,
          availableOverride,
          startTime,
          endTime,
          notes,
        });
        if (!r.ok) {
          flash(r.message, true);
          return;
        }
        (e.target as HTMLFormElement).reset();
        await loadAndRender();
        flash("Night change submitted for review.");
      })();
    });

    root.querySelector("#p-table-sale-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!profile) return;
      const fd = new FormData(e.target as HTMLFormElement);
      const saleDate = String(fd.get("saleDate") || "").trim();
      const clubSlug = String(fd.get("clubSlug") || "").trim();
      const clientId = String(fd.get("clientId") || "").trim();
      const promoterJobId = String(fd.get("promoterJobId") || "").trim() || null;
      const tier = String(fd.get("tier") || "other").trim();
      const tableCount = Number(fd.get("tableCount") || 1) || 1;
      const totalMinSpend = Number(fd.get("totalMinSpend") || 0) || 0;
      const notes = String(fd.get("notes") || "").trim();
      const selectedClient = promoterClients.find((c) => c.id === clientId);
      const clientNote = selectedClient
        ? `Client: ${selectedClient.name}${selectedClient.phone ? ` (${selectedClient.phone})` : selectedClient.instagram ? ` (@${selectedClient.instagram.replace(/^@/, "")})` : ""}`
        : "";
      void (async () => {
        const r = await insertPromoterTableSale(supabase, {
          saleDate,
          clubSlug,
          promoterJobId,
          tier,
          tableCount,
          totalMinSpend,
          notes: [clientNote, notes].filter(Boolean).join(" | "),
        });
        if (!r.ok) {
          flash(r.message, true);
          return;
        }
        (e.target as HTMLFormElement).reset();
        const dateIn = (e.target as HTMLFormElement).querySelector(
          "[name=saleDate]",
        ) as HTMLInputElement | null;
        if (dateIn) dateIn.value = new Date().toISOString().slice(0, 10);
        await loadAndRender();
        flash("Table sale logged — pending review.");
      })();
    });
    root.querySelector("#promoter-client-new")?.addEventListener("click", () => {
      promoterClientFormOpen = true;
      selectedClientId = null;
      selectedClientAttendanceId = null;
      void loadAndRender();
    });
    root.querySelector("#promoter-open-client-form")?.addEventListener("click", () => {
      promoterClientFormOpen = true;
      selectedClientId = null;
      selectedClientAttendanceId = null;
      renderDashboard();
    });
    root.querySelector("#promoter-open-attendance-form")?.addEventListener("click", () => {
      promoterClientAttendanceFormOpen = true;
      selectedClientAttendanceId = null;
      renderDashboard();
    });
    root.querySelectorAll("[data-client-id]").forEach((row) => {
      row.addEventListener("click", () => {
        promoterClientFormOpen = true;
        selectedClientId =
          (row as HTMLElement).dataset.clientId?.trim() || null;
        selectedClientAttendanceId = null;
        renderDashboard();
      });
    });
    root.querySelector("#promoter-client-form")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (!profile) return;
      const fd = new FormData(ev.target as HTMLFormElement);
      const id = String(fd.get("id") || "").trim();
      const name = String(fd.get("name") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const phone = String(fd.get("phone") || "").trim();
      const instagram = String(fd.get("instagram") || "").trim();
      const notes = String(fd.get("notes") || "").trim();
      void (async () => {
        const res = await savePromoterClient(supabase, {
          id: id || undefined,
          promoterId: profile.id,
          name,
          email,
          phone,
          instagram,
          notes,
        });
        if (!res.ok) {
          flash(res.message, true);
          return;
        }
        await loadAndRender();
        selectedClientId = res.id;
        flash(res.deduped ? "Existing client matched and updated." : "Client saved.");
      })();
    });
    root.querySelectorAll("[data-client-attendance-id]").forEach((row) => {
      row.addEventListener("click", () => {
        promoterClientAttendanceFormOpen = true;
        selectedClientAttendanceId =
          (row as HTMLElement).dataset.clientAttendanceId?.trim() || null;
        renderDashboard();
      });
    });
    root.querySelectorAll("[data-promoter-attendance-delete]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (!profile) return;
        const id = (btn as HTMLElement).dataset.promoterAttendanceDelete?.trim();
        if (!id) return;
        void (async () => {
          const res = await deletePromoterClientAttendance(supabase, profile.id, id);
          if (!res.ok) {
            flash(res.message, true);
            return;
          }
          await loadAndRender();
          flash("Visit deleted.");
        })();
      });
    });
    root.querySelector("#promoter-client-attendance-new")?.addEventListener("click", () => {
      promoterClientAttendanceFormOpen = true;
      selectedClientAttendanceId = null;
      renderDashboard();
    });
    root.querySelector("#promoter-client-attendance-form")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (!profile || !selectedClientId) return;
      const fd = new FormData(ev.target as HTMLFormElement);
      void (async () => {
        const res = await savePromoterClientAttendance(supabase, {
          id: String(fd.get("attendanceId") || "").trim() || undefined,
          clientId: selectedClientId,
          promoterId: profile.id,
          eventDate: String(fd.get("eventDate") || "").trim(),
          clubSlug: String(fd.get("clubSlug") || "").trim(),
          spendGbp: Number(fd.get("spendGbp") || 0) || 0,
          source: String(fd.get("source") || "").trim() || "manual",
          notes: String(fd.get("notes") || "").trim(),
        });
        if (!res.ok) {
          flash(res.message, true);
          return;
        }
        selectedClientAttendanceId = res.id;
        await loadAndRender();
        flash("Visit saved. Preferences recalculated.");
      })();
    });
    root.querySelector("#promoter-job-type-filter")?.addEventListener("change", (ev) => {
      jobTypeFilter = String((ev.target as HTMLSelectElement).value || "all");
      renderDashboard();
    });
    root.querySelector("#promoter-job-status-filter")?.addEventListener("change", (ev) => {
      jobStatusFilter = String((ev.target as HTMLSelectElement).value || "all");
      renderDashboard();
    });
    root.querySelector("#promoter-table-status-filter")?.addEventListener("change", (ev) => {
      tableStatusFilter = String((ev.target as HTMLSelectElement).value || "all");
      renderDashboard();
    });
  }

  async function loadAndRender(): Promise<void> {
    const gate = await gatePromoterUser(supabase);
    if (gate.ok) {
      adminMode = false;
      await reloadPromoterData(gate.user.id);
      const userMetadata = (gate.user.user_metadata ?? {}) as Record<string, unknown>;
      promoterAccount = {
        userId: gate.user.id,
        email: String(gate.user.email ?? "")
          .trim()
          .toLowerCase(),
        username: String(
          userMetadata.username ?? userMetadata.display_name ?? gate.user.email ?? "",
        ).trim(),
      };
      renderDashboard();
      return;
    }
    const adminGate = await gateAdminUser(supabase);
    if (!adminGate.ok) {
      renderAuth();
      return;
    }
    adminMode = true;
    const promoterRows = await loadPromotersForAdmin(supabase);
    adminPromoters = promoterRows.ok ? promoterRows.rows : [];
    adminSelectedPromoterId =
      adminSelectedPromoterId && adminPromoters.some((p) => p.id === adminSelectedPromoterId)
        ? adminSelectedPromoterId
        : (adminPromoters[0]?.id ?? null);
    const picked = adminPromoters.find((p) => p.id === adminSelectedPromoterId) ?? null;
    await reloadPromoterDataByProfile(picked);
    promoterAccount = {
      userId: adminGate.user.id,
      email: String(adminGate.user.email ?? "")
        .trim()
        .toLowerCase(),
      username: "admin",
    };
    renderDashboard();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      promoterView = "overview";
      renderAuth();
      return;
    }
    void loadAndRender();
  });

  await loadAndRender();
}
