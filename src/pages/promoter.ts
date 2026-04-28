import {
  gateAdminUser,
  gatePromoterUser,
  signInPromoter,
  signOutAdmin,
} from "../admin/auth";
import {
  deletePromoterClientAttendance,
  insertPromoterGuestlistEntry,
  insertPromoterTableSale,
  loadPromoterAvailability,
  loadPromoterByUser,
  loadPromotersForAdmin,
  loadPromoterGuestlistEntriesForJobs,
  loadPromoterInvoices,
  loadPromoterJobs,
  loadPromoterNightAdjustments,
  loadPromoterPreferences,
  loadPromoterClients,
  loadPromoterClientAttendances,
  loadPromoterTableSales,
  insertPromoterJobSelf,
  savePromoterClient,
  savePromoterClientAttendance,
  savePromoterAvailability,
  savePromoterPreference,
  submitPromoterRevision,
  upsertPromoterNightAdjustment,
} from "../admin/promoters";
import { fetchClubs } from "../data/fetch-data";
import {
  callPromoterInvoiceEdge,
  downloadPdfFromBase64,
} from "../lib/promoter-invoice-edge";
import { notifyPromoterRequestSubmitted } from "../lib/promoter-request-edge";
import { renderStatusBadge } from "../portal/badge";
import { mountDataTable } from "../portal/data-table";
import { getSupabaseClient } from "../lib/supabase";
import type {
  Club,
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

function jobsTableRows(
  rows: PromoterJob[],
  emptyColspan: number,
  emptyMessage: string,
): string {
  if (!rows.length) {
    return `<tr><td colspan="${emptyColspan}">${esc(emptyMessage)}</td></tr>`;
  }
  return rows
    .map(
      (j) =>
        `<tr><td>${esc(j.jobDate)}</td><td>${esc(j.clubSlug ?? "—")}</td><td>${esc(j.service)}</td><td>${esc(j.clientName || "—")}</td><td>${esc(j.clientContact || "—")}</td><td>${esc(j.status)}</td><td>${j.guestsCount}</td><td>${money(j.shiftFee)} + ${money(j.guestlistFee)}/guest</td></tr>`,
    )
    .join("");
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
  let promoterAccount = {
    userId: "",
    email: "",
    username: "",
  };
  let promoterUiDelegateBound = false;
  let promoterInvoicePdfBound = false;
  let createJobClients: Array<{
    mode: "existing" | "blank" | "new";
    clientId?: string;
    name: string;
    contact: string;
    newEmail?: string;
    newPhone?: string;
  }> = [];
  let adminMode = false;
  let adminPromoters: PromoterProfile[] = [];
  let adminSelectedPromoterId: string | null = null;
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
    const c = await loadPromoterClients(supabase, profile.id);
    promoterClients = c.ok ? c.rows : [];
    if (!selectedClientId || !promoterClients.some((x) => x.id === selectedClientId)) {
      selectedClientId = promoterClients[0]?.id ?? null;
    }
    promoterClientAttendances = [];
    selectedClientAttendanceId = null;
    if (selectedClientId) {
      const at = await loadPromoterClientAttendances(
        supabase,
        profile.id,
        selectedClientId,
      );
      promoterClientAttendances = at.ok ? at.rows : [];
    }
    const assignedGlJobIds = jobs
      .filter(
        (job) =>
          job.status === "assigned" &&
          String(job.service || "guestlist").toLowerCase() === "guestlist",
      )
      .map((job) => job.id);
    const gl = await loadPromoterGuestlistEntriesForJobs(supabase, assignedGlJobIds);
    guestlistEntries = gl.ok ? gl.rows : [];
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
            key: "total",
            label: "Total",
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
      const rows = jobs.filter((j) => j.status !== "assigned");
      return `
      <div class="promoter-panel">
        <p class="promoter-panel__title">Jobs history</p>
        <div class="promoter-table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Club</th><th>Service</th><th>Client</th><th>Contact</th><th>Status</th><th>Guests</th><th>Comp</th></tr></thead>
            <tbody>${jobsTableRows(rows, 8, "No completed/cancelled jobs yet.")}</tbody>
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
        </div>`;
    }

    if (v === "jobs") {
      const filtered = jobs.filter((j) => {
        const service = String(j.service || "").toLowerCase();
        const serviceOk = jobTypeFilter === "all" ? true : service === jobTypeFilter;
        const statusOk = jobStatusFilter === "all" ? true : j.status === jobStatusFilter;
        return serviceOk && statusOk;
      });
      const upcoming = filtered.filter((j) => j.status === "assigned");
      const completed = filtered.filter((j) => j.status === "completed");
      const cancelled = filtered.filter((j) => j.status === "cancelled");
      const serviceOpts = Array.from(
        new Set(jobs.map((j) => String(j.service || "other").toLowerCase()).filter(Boolean)),
      );
      return `
        <div class="promoter-panel">
          <p class="promoter-panel__title">Create new job or guestlist</p>
          <form class="admin-form" id="promoter-create-job-form" data-collapsible="true">
            <h4 class="full">Job Details</h4>
            <div class="cc-field pp-col-3"><label>Date</label><input type="date" name="jobDate" required value="${esc(new Date().toISOString().slice(0, 10))}" /></div>
            <div class="cc-field pp-col-5"><label>Club</label><select name="clubSlug" required>${clubs.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join("")}</select></div>
            <div class="cc-field pp-col-2"><label>Service</label>
              <select name="service">
                <option value="guestlist">guestlist</option>
                <option value="table_sale">table_sale</option>
                <option value="tickets">tickets</option>
                <option value="other">other</option>
              </select>
            </div>
            <div class="cc-field pp-col-2"><label>Job Status</label>
              <select name="status">
                <option value="assigned">assigned (upcoming)</option>
                <option value="completed">completed (already happened)</option>
              </select>
            </div>
            <div class="cc-field pp-col-4"><label>Client Mode</label>
              <select name="clientMode">
                <option value="existing">Select Existing Client</option>
                <option value="blank">Create Blank Client</option>
                <option value="new">Create New Client</option>
              </select>
            </div>
            <h4 class="full">Client Assignment</h4>
            <div class="cc-field full" id="promoter-job-find-client-block"><label>Find Client</label>
              <input name="clientSearch" type="text" placeholder="Type client name/email/phone" />
              <select name="existingClientId" style="margin-top:0.4rem">
                <option value="">(none)</option>
                ${promoterClients.map((c) => `<option value="${esc(c.id)}">${esc(c.name || c.email || c.phone || c.id.slice(0, 8))}</option>`).join("")}
              </select>
            </div>
            <div class="cc-field pp-col-4" id="promoter-job-new-client-name" hidden><label>New Client Name</label><input name="newClientName" placeholder="Client full name" /></div>
            <div class="cc-field pp-col-4" id="promoter-job-new-client-email" hidden><label>New Client Email</label><input name="newClientEmail" type="email" placeholder="client@example.com" /></div>
            <div class="cc-field pp-col-4" id="promoter-job-new-client-phone" hidden><label>New Client Phone</label><input name="newClientPhone" placeholder="+44…" /></div>
            <div class="admin-actions full">
              <button type="button" class="cc-btn cc-btn--ghost" id="promoter-job-add-client">Add Client</button>
            </div>
            <div class="full promoter-table-wrap">
              <table>
                <thead><tr><th>Type</th><th>Name</th><th>Contact</th><th>Remove</th></tr></thead>
                <tbody id="promoter-job-clients-body">${
                  createJobClients.length
                    ? createJobClients
                        .map(
                          (c, idx) =>
                            `<tr><td>${esc(c.mode === "existing" ? "existing" : c.mode === "blank" ? "blank" : "new profile")}</td><td>${esc(c.name || "New client")}</td><td>${esc(c.contact || "—")}</td><td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-promoter-job-remove-client="${idx}">Remove</button></td></tr>`,
                        )
                        .join("")
                    : "<tr><td colspan='4'>No clients added yet.</td></tr>"
                }</tbody>
              </table>
            </div>
            <h4 class="full">Compensation & Notes</h4>
            <div class="cc-field pp-col-4"><label>Guest Count</label><input type="number" name="guestsCount" min="0" step="1" value="0" /></div>
            <div class="cc-field pp-col-4"><label>Shift Fee (£)</label><input type="number" name="shiftFee" min="0" step="0.01" value="0" /></div>
            <div class="cc-field pp-col-4"><label>Guestlist Fee (£/guest)</label><input type="number" name="guestlistFee" min="0" step="0.01" value="0" /></div>
            <div class="cc-field full"><label>Notes (Internal)</label><textarea name="notes" rows="2" placeholder="Internal notes for this job"></textarea></div>
            <div class="admin-actions full">
              <button type="submit" class="cc-btn cc-btn--gold">Create job</button>
              <button type="button" class="cc-btn cc-btn--ghost" id="promoter-create-guestlist-job">Create Quick Guestlist Shift</button>
            </div>
          </form>
        </div>
        <div class="promoter-panel">
          <p class="promoter-panel__title">Job filters</p>
          <div class="admin-actions">
            <label class="cc-field" style="max-width:220px">
              <span>Type</span>
              <select id="promoter-job-type-filter">
                <option value="all" ${jobTypeFilter === "all" ? "selected" : ""}>All</option>
                ${serviceOpts.map((s) => `<option value="${esc(s)}" ${jobTypeFilter === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
              </select>
            </label>
            <label class="cc-field" style="max-width:220px">
              <span>Status</span>
              <select id="promoter-job-status-filter">
                <option value="all" ${jobStatusFilter === "all" ? "selected" : ""}>All</option>
                <option value="assigned" ${jobStatusFilter === "assigned" ? "selected" : ""}>Assigned</option>
                <option value="completed" ${jobStatusFilter === "completed" ? "selected" : ""}>Completed</option>
                <option value="cancelled" ${jobStatusFilter === "cancelled" ? "selected" : ""}>Cancelled</option>
              </select>
            </label>
          </div>
        </div>
        <div class="promoter-job-section">
          <h4>Upcoming</h4>
          <p class="promoter-job-hint">Assigned shifts you have not completed yet.</p>
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Club</th><th>Service</th><th>Client</th><th>Contact</th><th>Status</th><th>Guests</th><th>Earnings basis</th></tr></thead>
              <tbody>${jobsTableRows(upcoming, 8, "No upcoming jobs.")}</tbody>
            </table>
          </div>
        </div>
        <div class="promoter-job-section">
          <h4>Completed</h4>
          <p class="promoter-job-hint">Finished shifts — totals feed your overview earnings figure.</p>
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Club</th><th>Service</th><th>Client</th><th>Contact</th><th>Status</th><th>Guests</th><th>Earnings basis</th></tr></thead>
              <tbody>${jobsTableRows(completed, 8, "No completed jobs yet.")}</tbody>
            </table>
          </div>
        </div>
        <div class="promoter-job-section">
          <h4>Cancelled</h4>
          <p class="promoter-job-hint">Assignments that were called off or removed.</p>
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Club</th><th>Service</th><th>Client</th><th>Contact</th><th>Status</th><th>Guests</th><th>Earnings basis</th></tr></thead>
              <tbody>${jobsTableRows(cancelled, 8, "No cancelled jobs.")}</tbody>
            </table>
          </div>
        </div>`;
    }

    /* invoices */
    return `
      <div class="promoter-panel">
        <p class="promoter-panel__title">Statements</p>
        <p class="promoter-main__subtitle" style="margin-top:0">PDF uses the same Cooper invoice function as admin (deploy the <code>promoter-invoice</code> Edge Function).</p>
        <div id="promoter-invoices-table"></div>
      </div>`;
  }

  function applyCollapsibleFormSections(scope: ParentNode): void {
    const blocks = Array.from(
      scope.querySelectorAll<HTMLElement>(".admin-form[data-collapsible='true']"),
    );
    for (const block of blocks) {
      if (block.dataset.collapsibleReady === "1") continue;
      const headings = Array.from(
        block.querySelectorAll<HTMLElement>(":scope > h4.full"),
      );
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
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="profile">Edit profile</button>
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="preferences">Work preferences</button>
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="jobs">Manage jobs</button>
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="tables">Manage tables sold</button>
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="clients">Manage clients</button>
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="job_history">Jobs history</button>
                <button type="button" role="menuitem" class="promoter-account__item" data-promoter-menu-view="table_history">Tables history</button>
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
    root.querySelector("#promoter-create-guestlist-job")?.addEventListener("click", () => {
      const form = root.querySelector("#promoter-create-job-form") as HTMLFormElement | null;
      if (!form) return;
      const svc = form.querySelector("[name=service]") as HTMLSelectElement | null;
      const guests = form.querySelector("[name=guestsCount]") as HTMLInputElement | null;
      if (svc) svc.value = "guestlist";
      if (guests && Number(guests.value || 0) <= 0) guests.value = "1";
    });
    root.querySelector("#promoter-create-job-form")?.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const form = ev.target as HTMLFormElement;
      const fd = new FormData(form);
      const jobDate = String(fd.get("jobDate") || "").trim();
      const clubSlug = String(fd.get("clubSlug") || "").trim();
      const service = String(fd.get("service") || "guestlist").trim();
      const status = String(fd.get("status") || "assigned").trim() as
        | "assigned"
        | "completed"
        | "cancelled";
      const guestsCount = Number(fd.get("guestsCount") || 0) || 0;
      const shiftFee = Number(fd.get("shiftFee") || 0) || 0;
      const guestlistFee = Number(fd.get("guestlistFee") || 0) || 0;
      const notes = String(fd.get("notes") || "").trim();
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
            const c = await savePromoterClient(supabase, {
              promoterId: profile?.id || "",
              name: "New client",
              email: "",
              phone: "",
              instagram: "",
              notes: "",
            });
            if (!c.ok) {
              flash(c.message, true);
              return;
            }
            resolvedClients.push({ name: "New client", contact: "" });
            continue;
          }
          const c = await savePromoterClient(supabase, {
            promoterId: profile?.id || "",
            name: item.name.trim() || "New client",
            email: String(item.newEmail || "").trim(),
            phone: String(item.newPhone || "").trim(),
            instagram: "",
            notes: "",
          });
          if (!c.ok) {
            flash(c.message, true);
            return;
          }
          resolvedClients.push({
            name: item.name.trim() || "New client",
            contact: String(item.newPhone || item.newEmail || "").trim(),
          });
        }
        const clientName = resolvedClients.map((c) => c.name).filter(Boolean).join("; ");
        const clientContact = resolvedClients.map((c) => c.contact).filter(Boolean).join("; ");
        const res = await insertPromoterJobSelf(supabase, {
          clubSlug,
          jobDate,
          service,
          status,
          clientName,
          clientContact,
          guestsCount,
          shiftFee,
          guestlistFee,
          notes,
        });
        if (!res.ok) {
          flash(res.message, true);
          return;
        }
        createJobClients = [];
        await loadAndRender();
        flash(service === "guestlist" ? "Guestlist shift created." : "Job created.");
      })();
    });
    root.querySelector("#promoter-job-add-client")?.addEventListener("click", () => {
      const form = root.querySelector("#promoter-create-job-form") as HTMLFormElement | null;
      if (!form) return;
      const fd = new FormData(form);
      const mode = String(fd.get("clientMode") || "existing").trim();
      if (mode === "existing") {
        const existingId = String(fd.get("existingClientId") || "").trim();
        const existing = promoterClients.find((c) => c.id === existingId);
        if (!existing) {
          flash("Select a client from the find results first.", true);
          return;
        }
        createJobClients.push({
          mode: "existing",
          clientId: existing.id,
          name: String(existing.name || "").trim() || "Client",
          contact: String(existing.phone || existing.email || existing.instagram || "").trim(),
        });
      } else if (mode === "blank") {
        createJobClients.push({ mode: "blank", name: "New client", contact: "" });
      } else {
        const newName = String(fd.get("newClientName") || "").trim();
        const newEmail = String(fd.get("newClientEmail") || "").trim();
        const newPhone = String(fd.get("newClientPhone") || "").trim();
        if (!newName) {
          flash("New client name is required.", true);
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
    root.querySelectorAll("[data-promoter-job-remove-client]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(
          (btn as HTMLElement).getAttribute("data-promoter-job-remove-client") || "-1",
        );
        if (idx < 0 || idx >= createJobClients.length) return;
        createJobClients.splice(idx, 1);
        renderDashboard();
      });
    });
    root.querySelector("[name=clientMode]")?.addEventListener("change", (ev) => {
      const mode = String((ev.target as HTMLSelectElement).value || "existing").trim();
      const findBlock = root.querySelector("#promoter-job-find-client-block") as HTMLElement | null;
      const newName = root.querySelector("#promoter-job-new-client-name") as HTMLElement | null;
      const newEmail = root.querySelector("#promoter-job-new-client-email") as HTMLElement | null;
      const newPhone = root.querySelector("#promoter-job-new-client-phone") as HTMLElement | null;
      const showNew = mode === "new";
      if (findBlock) findBlock.hidden = mode !== "existing";
      if (newName) newName.hidden = !showNew;
      if (newEmail) newEmail.hidden = !showNew;
      if (newPhone) newPhone.hidden = !showNew;
    });
    root.querySelector("[name=clientSearch]")?.addEventListener("input", (ev) => {
      const q = String((ev.target as HTMLInputElement).value || "").trim().toLowerCase();
      const sel = root.querySelector("[name=existingClientId]") as HTMLSelectElement | null;
      if (!sel) return;
      const filtered = promoterClients.filter((c) => {
        const hay = `${c.name || ""} ${c.email || ""} ${c.phone || ""}`.toLowerCase();
        return !q || hay.includes(q);
      });
      sel.innerHTML = `<option value="">(none)</option>${filtered
        .map((c) => `<option value="${esc(c.id)}">${esc(c.name || c.email || c.phone || c.id.slice(0, 8))}</option>`)
        .join("")}`;
    });
    root.querySelector("#promoter-admin-target")?.addEventListener("change", (ev) => {
      const id = String((ev.target as HTMLSelectElement).value || "").trim();
      if (!id || id === adminSelectedPromoterId) return;
      adminSelectedPromoterId = id;
      void loadAndRender();
    });

    root.querySelectorAll("form.promoter-gl-add-form").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!profile) return;
        const jobId = (form as HTMLFormElement).dataset.addGlJob?.trim();
        if (!jobId) return;
        const fd = new FormData(form as HTMLFormElement);
        const guestName = String(fd.get("guestName") || "").trim();
        const guestContact = String(fd.get("guestContact") || "").trim();
        const duplicate = guestlistEntries.some(
          (x) =>
            x.promoterJobId === jobId &&
            x.guestName.trim().toLowerCase() === guestName.toLowerCase() &&
            x.guestContact.trim().toLowerCase() === guestContact.toLowerCase(),
        );
        if (duplicate) {
          flash("Guest already exists for this job.");
          return;
        }
        void (async () => {
          const r = await insertPromoterGuestlistEntry(supabase, {
            jobId,
            guestName,
            guestContact,
          });
          if (!r.ok) {
            flash(r.message, true);
            return;
          }
          (form as HTMLFormElement).reset();
          await loadAndRender();
          flash("Guest submitted for review.");
        })();
      });
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
