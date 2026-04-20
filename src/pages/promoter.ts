import { gatePromoterUser, signInPromoter, signOutAdmin } from "../admin/auth";
import {
  insertPromoterGuestlistEntry,
  insertPromoterTableSale,
  loadPromoterAvailability,
  loadPromoterByUser,
  loadPromoterGuestlistEntriesForJobs,
  loadPromoterInvoices,
  loadPromoterJobs,
  loadPromoterNightAdjustments,
  loadPromoterPreferences,
  loadPromoterTableSales,
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

type PromoterView = "overview" | "profile" | "preferences" | "jobs" | "tables" | "invoices";

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
  invoices: {
    title: "Invoices",
    subtitle:
      "Period statements from completed earnings. Download a PDF anytime; your coordinator can also email a copy to your login address.",
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
        `<tr><td>${esc(j.jobDate)}</td><td>${esc(j.clubSlug ?? "—")}</td><td>${esc(j.service)}</td><td>${esc(j.status)}</td><td>${j.guestsCount}</td><td>${money(j.shiftFee)} + ${money(j.guestlistFee)}/guest</td></tr>`,
    )
    .join("");
}

export async function initPromoterPortal(): Promise<void> {
  const root = document.getElementById("promoter-root");
  if (!root) return;
  const supabase = getSupabaseClient();
  if (!supabase) {
    root.innerHTML = `<div class="admin-card"><p>Supabase is not configured.</p></div>`;
    return;
  }

  let profile: PromoterProfile | null = null;
  let availability: PromoterAvailabilitySlot[] = [];
  let preferences: PromoterClubPreference[] = [];
  let jobs: PromoterJob[] = [];
  let guestlistEntries: PromoterGuestlistEntry[] = [];
  let nightAdjustments: PromoterNightAdjustment[] = [];
  let tableSales: PromoterTableSale[] = [];
  let invoices: PromoterInvoice[] = [];
  let promoterView: PromoterView = "overview";
  let promoterUiDelegateBound = false;
  let promoterInvoicePdfBound = false;
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
    if (!p.ok || !p.row) {
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
    profile = p.row;
    const [a, pref, j, inv, na, ts] = await Promise.all([
      loadPromoterAvailability(supabase, p.row.id),
      loadPromoterPreferences(supabase, p.row.id),
      loadPromoterJobs(supabase, p.row.id),
      loadPromoterInvoices(supabase, p.row.id),
      loadPromoterNightAdjustments(supabase, p.row.id),
      loadPromoterTableSales(supabase, p.row.id),
    ]);
    availability = a.ok ? a.rows : [];
    preferences = pref.ok ? pref.rows : [];
    jobs = j.ok ? j.rows : [];
    invoices = inv.ok ? inv.rows : [];
    nightAdjustments = na.ok ? na.rows : [];
    tableSales = ts.ok ? ts.rows : [];
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
    if (!profile) return "";
    const v = promoterView;

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
            <h4 class="full">Profile revision</h4>
            <p class="promoter-main__subtitle full" style="margin-top:0">The team reviews each submission. Use photos you are allowed to publish.</p>
            <div class="cc-field"><label>Display name</label><input id="p-display-name" value="${esc(profile.displayName)}" /></div>
            <div class="cc-field full"><label>Bio</label><textarea id="p-bio" rows="6" placeholder="Experience, venues, languages…">${esc(profile.bio)}</textarea></div>
            <h4 class="full">Payment details</h4>
            <div class="cc-field"><label>Method</label><input id="p-payment-method" value="${esc(profile.paymentDetails.method)}" placeholder="bank_transfer / card / cash" /></div>
            <div class="cc-field"><label>Beneficiary</label><input id="p-beneficiary-name" value="${esc(profile.paymentDetails.beneficiaryName)}" /></div>
            <div class="cc-field"><label>Account no</label><input id="p-account-number" value="${esc(profile.paymentDetails.accountNumber)}" /></div>
            <div class="cc-field"><label>Sort code</label><input id="p-sort-code" value="${esc(profile.paymentDetails.sortCode)}" /></div>
            <div class="cc-field"><label>IBAN</label><input id="p-iban" value="${esc(profile.paymentDetails.iban)}" /></div>
            <div class="cc-field"><label>SWIFT/BIC</label><input id="p-swift-bic" value="${esc(profile.paymentDetails.swiftBic)}" /></div>
            <div class="cc-field"><label>Reference</label><input id="p-payment-reference" value="${esc(profile.paymentDetails.reference)}" /></div>
            <div class="cc-field"><label>Payout email</label><input id="p-payout-email" value="${esc(profile.paymentDetails.payoutEmail)}" /></div>
            <h4 class="full">Tax details</h4>
            <div class="cc-field"><label>Registered name</label><input id="p-tax-registered-name" value="${esc(profile.taxDetails.registeredName)}" /></div>
            <div class="cc-field"><label>Tax ID</label><input id="p-tax-id" value="${esc(profile.taxDetails.taxId)}" /></div>
            <div class="cc-field"><label>VAT number</label><input id="p-vat-number" value="${esc(profile.taxDetails.vatNumber)}" /></div>
            <div class="cc-field"><label>Tax country</label><input id="p-tax-country-code" value="${esc(profile.taxDetails.countryCode)}" /></div>
            <div class="cc-field"><label>VAT registered</label><select id="p-is-vat-registered"><option value="true"${profile.taxDetails.isVatRegistered ? " selected" : ""}>yes</option><option value="false"${!profile.taxDetails.isVatRegistered ? " selected" : ""}>no</option></select></div>
            <div class="cc-field full"><label>Tax notes</label><textarea id="p-tax-notes" rows="3">${esc(profile.taxDetails.notes)}</textarea></div>
            <h4 class="full">Photos (up to 12)</h4>
            <div id="p-profile-img-rows">${imgRows}</div>
            <div class="admin-actions full">
              <button type="button" class="cc-btn cc-btn--ghost" id="p-add-profile-image"${baseUrls.length >= 12 ? " disabled" : ""}>Add another photo</button>
            </div>
            <p class="promoter-upload-hint full">JPEG, PNG, WebP or GIF (about 6MB each). The first photo is your main thumbnail.</p>
            <div id="p-image-preview-wrap" class="promoter-image-preview-wrap${previewFirst ? "" : " is-empty"}">
              <img id="p-image-preview" class="promoter-image-preview__img"${previewSrc} alt="Primary photo preview" referrerpolicy="no-referrer"${previewFirst ? "" : " hidden"} />
            </div>
            <h4 class="full">Clubs to highlight</h4>
            <p class="promoter-main__subtitle full" style="margin-top:0">Choose venues for your public-facing profile (Ctrl/Command + click for multiple).</p>
            <div class="cc-field full">
              <label for="p-portfolio-clubs">Venues</label>
              <select id="p-portfolio-clubs" multiple size="8" class="promoter-portfolio-select">${clubOpts}</select>
            </div>
            <div class="admin-actions full">
              <button class="cc-btn cc-btn--gold" id="p-save-profile" type="button">Submit profile for approval</button>
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
              <button class="cc-btn cc-btn--gold" id="p-save-availability" type="button">Save availability</button>
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
              <button class="cc-btn cc-btn--ghost" id="p-save-preference" type="button">Submit preference</button>
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
      const hist =
        tableSales.length === 0
          ? "<tr><td colspan=\"8\">No rows yet.</td></tr>"
          : tableSales
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
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Club</th><th>Channel</th><th>Tier</th><th>Tables</th><th>Min spend</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>${hist}</tbody>
            </table>
          </div>
        </div>`;
    }

    if (v === "jobs") {
      const upcoming = jobs.filter((j) => j.status === "assigned");
      const completed = jobs.filter((j) => j.status === "completed");
      const cancelled = jobs.filter((j) => j.status === "cancelled");
      return `
        <div class="promoter-job-section">
          <h4>Upcoming</h4>
          <p class="promoter-job-hint">Assigned shifts you have not completed yet.</p>
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Club</th><th>Service</th><th>Status</th><th>Guests</th><th>Earnings basis</th></tr></thead>
              <tbody>${jobsTableRows(upcoming, 6, "No upcoming jobs.")}</tbody>
            </table>
          </div>
        </div>
        <div class="promoter-job-section">
          <h4>Completed</h4>
          <p class="promoter-job-hint">Finished shifts — totals feed your overview earnings figure.</p>
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Club</th><th>Service</th><th>Status</th><th>Guests</th><th>Earnings basis</th></tr></thead>
              <tbody>${jobsTableRows(completed, 6, "No completed jobs yet.")}</tbody>
            </table>
          </div>
        </div>
        <div class="promoter-job-section">
          <h4>Cancelled</h4>
          <p class="promoter-job-hint">Assignments that were called off or removed.</p>
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Club</th><th>Service</th><th>Status</th><th>Guests</th><th>Earnings basis</th></tr></thead>
              <tbody>${jobsTableRows(cancelled, 6, "No cancelled jobs.")}</tbody>
            </table>
          </div>
        </div>`;
    }

    /* invoices */
    const invBody =
      invoices.length === 0
        ? "<tr><td colspan='5'>No invoices generated yet.</td></tr>"
        : invoices
            .map((i) => {
              const sent =
                i.sentAt && i.sentToEmail
                  ? `${esc(i.sentAt.slice(0, 10))} · ${esc(i.sentToEmail)}`
                  : "—";
              return `<tr>
              <td>${esc(i.periodStart)} to ${esc(i.periodEnd)}</td>
              <td>${esc(i.status)}</td>
              <td>${money(i.total)}</td>
              <td>${sent}</td>
              <td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-promoter-invoice-pdf data-invoice-id="${esc(i.id)}">PDF</button></td>
            </tr>`;
            })
            .join("");
    return `
      <div class="promoter-panel">
        <p class="promoter-panel__title">Statements</p>
        <p class="promoter-main__subtitle" style="margin-top:0">PDF uses the same Cooper invoice function as admin (deploy the <code>promoter-invoice</code> Edge Function).</p>
        <div class="promoter-table-wrap">
          <table>
            <thead><tr><th>Period</th><th>Status</th><th>Total</th><th>Emailed</th><th>PDF</th></tr></thead>
            <tbody>${invBody}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderDashboard(): void {
    if (!profile) {
      renderAuth();
      return;
    }
    const v = promoterView;
    const vh = PROMOTER_VIEW_HEADINGS[v];
    const tab = (id: PromoterView, label: string) =>
      `<button type="button" class="promoter-view-tab ${v === id ? "is-active" : ""}" data-promoter-view="${id}">${esc(label)}</button>`;

    root.innerHTML = `
      <div class="promoter-shell">
        <aside class="promoter-sidebar" aria-label="Promoter portal">
          <div class="promoter-sidebar__brand">
            <p class="promoter-sidebar__eyebrow">Cooper Concierge</p>
            <p class="promoter-sidebar__title">Promoter</p>
          </div>
          <nav class="promoter-sidebar__nav">
            ${tab("overview", "Overview")}
            ${tab("profile", "My profile")}
            ${tab("preferences", "Work preferences")}
            ${tab("jobs", "Jobs")}
            ${tab("tables", "Tables")}
            ${tab("invoices", "Invoices")}
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
            </div>
          </header>
          <div class="promoter-workspace">
            ${renderWorkspaceBody()}
            <div class="admin-flash" id="promoter-flash" style="margin-top:1rem"></div>
          </div>
        </div>
      </div>
    `;

    root.querySelectorAll(".promoter-view-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = (btn as HTMLButtonElement).dataset.promoterView as
          | PromoterView
          | undefined;
        if (!id) return;
        promoterView = id;
        renderDashboard();
      });
    });

    root.querySelector("#promoter-signout")?.addEventListener("click", () => {
      void signOutAdmin(supabase).then(() => {
        promoterView = "overview";
        renderAuth();
      });
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
      const promoterJobId = String(fd.get("promoterJobId") || "").trim() || null;
      const tier = String(fd.get("tier") || "other").trim();
      const tableCount = Number(fd.get("tableCount") || 1) || 1;
      const totalMinSpend = Number(fd.get("totalMinSpend") || 0) || 0;
      const notes = String(fd.get("notes") || "").trim();
      void (async () => {
        const r = await insertPromoterTableSale(supabase, {
          saleDate,
          clubSlug,
          promoterJobId,
          tier,
          tableCount,
          totalMinSpend,
          notes,
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

    root.querySelectorAll("form.promoter-gl-add-form").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!profile) return;
        const jobId = (form as HTMLFormElement).dataset.addGlJob?.trim();
        if (!jobId) return;
        const fd = new FormData(form as HTMLFormElement);
        const guestName = String(fd.get("guestName") || "").trim();
        const guestContact = String(fd.get("guestContact") || "").trim();
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
  }

  async function loadAndRender(): Promise<void> {
    const gate = await gatePromoterUser(supabase);
    if (!gate.ok) {
      renderAuth();
      return;
    }
    await reloadPromoterData(gate.user.id);
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
