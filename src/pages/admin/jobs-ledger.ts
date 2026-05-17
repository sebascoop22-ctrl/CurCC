import { escAttr, escHtml } from "../../portal/html";
import { renderStatusBadge } from "../../portal/badge";
import type { ClientRow } from "../../admin/clients";
import type {
  Club,
  FinancialClubPaymentRate,
  PromoterJob,
  PromoterJobAdminRow,
  PromoterJobType,
  PromoterProfile,
} from "../../types";
import {
  ADMIN_JOB_TYPES,
  computeJobDisplayFinancials,
  computeJobLedgerKpis,
  displayConciergeGbp,
  displayPromoterGbp,
  filterJobsRows,
  formatGbp,
  jobTypeCalModifier,
  jobTypeLabel,
  truncateDisplay,
  type JobComputedFinancials,
  type JobsLedgerFilters,
} from "./jobs-shared";

export type ClubEntry = { club: Club };

export function isoLocalYmd(y: number, m: number, d: number): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${y}-${p(m + 1)}-${p(d)}`;
}

function triStateOptions(
  name: string,
  label: string,
  value: "" | "yes" | "no",
): string {
  const opts = [
    { v: "", l: "Any" },
    { v: "yes", l: "Yes" },
    { v: "no", l: "No" },
  ];
  return `<div class="cc-field"><label for="jobs-filter-${name}">${escHtml(label)}</label>
    <select id="jobs-filter-${name}" name="${escAttr(name)}">${opts
      .map(
        (o) =>
          `<option value="${escAttr(o.v)}"${o.v === value ? " selected" : ""}>${escHtml(o.l)}</option>`,
      )
      .join("")}</select></div>`;
}

export function renderJobsListFiltersHtml(
  filters: JobsLedgerFilters,
  promoters: PromoterProfile[],
  clubEntries: ClubEntry[],
  kpis: ReturnType<typeof computeJobLedgerKpis>,
  monthLabel: string,
): string {
  const promoterOpts = promoters
    .map(
      (p) =>
        `<option value="${escAttr(p.id)}"${p.id === filters.promoterId ? " selected" : ""}>${escHtml(truncateDisplay(p.displayName || p.userId, 28))}</option>`,
    )
    .join("");
  const clubOpts = clubEntries
    .map(
      (c) =>
        `<option value="${escAttr(c.club.slug)}"${c.club.slug === filters.clubSlug ? " selected" : ""}>${escHtml(truncateDisplay(c.club.name, 24))}</option>`,
    )
    .join("");
  const typeOpts = ADMIN_JOB_TYPES.map(
    (t) =>
      `<option value="${escAttr(t)}"${filters.jobType === t ? " selected" : ""}>${escHtml(jobTypeLabel(t))}</option>`,
  ).join("");
  const statusOpts = ["assigned", "completed", "cancelled"]
    .map(
      (s) =>
        `<option value="${escAttr(s)}"${filters.status === s ? " selected" : ""}>${escHtml(s)}</option>`,
    )
    .join("");

  return `<div class="admin-jobs-ledger-filters">
    <p class="admin-note admin-jobs-ledger-filters__month">${escHtml(monthLabel)}</p>
    <div class="admin-jobs-ledger-kpis" aria-label="Job KPIs">
      <span class="admin-jobs-ledger-kpi"><strong>${kpis.total}</strong> jobs</span>
      <span class="admin-jobs-ledger-kpi"><strong>${kpis.confirmed}</strong> confirmed</span>
      <span class="admin-jobs-ledger-kpi"><strong>${kpis.paid}</strong> paid</span>
      ${
        kpis.bonusBlocked > 0
          ? `<span class="admin-jobs-ledger-kpi admin-jobs-ledger-kpi--warn"><strong>${kpis.bonusBlocked}</strong> bonus blocked</span>`
          : ""
      }
    </div>
    <form class="admin-form admin-jobs-ledger-filters__form" id="jobs-ledger-filters">
      <div class="cc-field"><label for="jobs-filter-promoter">Promoter</label>
        <select id="jobs-filter-promoter" name="promoterId">
          <option value="">All promoters</option>${promoterOpts}
        </select>
      </div>
      <div class="cc-field"><label for="jobs-filter-club">Club</label>
        <select id="jobs-filter-club" name="clubSlug">
          <option value="">All clubs</option>${clubOpts}
        </select>
      </div>
      <div class="cc-field"><label for="jobs-filter-job-type">Type</label>
        <select id="jobs-filter-job-type" name="jobType">
          <option value="">All types</option>${typeOpts}
        </select>
      </div>
      <div class="cc-field"><label for="jobs-filter-status">Status</label>
        <select id="jobs-filter-status" name="status">
          <option value="">Any status</option>${statusOpts}
        </select>
      </div>
      ${triStateOptions("adminConfirmed", "Confirmed", filters.adminConfirmed)}
      ${triStateOptions("paid", "Paid", filters.paid)}
      ${triStateOptions("bonusValid", "Bonus valid", filters.bonusValid)}
      <div class="admin-actions admin-jobs-ledger-filters__actions">
        <button type="button" class="cc-btn cc-btn--gold cc-btn--small" id="jobs-filter-apply">Apply</button>
        <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" id="jobs-filter-reset">Reset</button>
      </div>
    </form>
  </div>`;
}

export function buildAdminJobsCalendarHtml(
  year: number,
  month: number,
  rows: PromoterJobAdminRow[],
  rates: FinancialClubPaymentRate[],
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
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDay = today.getDate();
  const head = headers
    .map((h) => `<div class="admin-jobs__cal-hd">${escHtml(h)}</div>`)
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
      .map((j) => {
        const fin = computeJobDisplayFinancials(j, rates);
        const bonusBad = !fin.bonusValid;
        const cls = [
          "admin-jobs__cal-pill",
          jobTypeCalModifier(j.jobType),
          `admin-jobs__cal-pill--${escAttr(j.status)}`,
          bonusBad ? "admin-jobs__cal-pill--bonus-invalid" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const title = `${j.promoterDisplayName} · ${j.clubSlug ?? "—"} · ${jobTypeLabel(j.jobType)}${bonusBad ? " · bonus blocked" : ""}`;
        return `<button type="button" class="${cls}" data-open-job-edit="${escAttr(j.id)}" title="${escAttr(title)}">${escHtml(truncateDisplay(j.promoterDisplayName, 11))}</button>`;
      })
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

function jobTypeSelectHtml(value: PromoterJobType): string {
  return ADMIN_JOB_TYPES.map(
    (t) =>
      `<option value="${escAttr(t)}"${t === value ? " selected" : ""}>${escHtml(jobTypeLabel(t))}</option>`,
  ).join("");
}

function clubSelectOptionsHtml(clubEntries: ClubEntry[], slug: string | null): string {
  return `<option value="">${escHtml("(none)")}</option>${clubEntries
    .map(
      (c) =>
        `<option value="${escAttr(c.club.slug)}"${(slug ?? "") === c.club.slug ? " selected" : ""}>${escHtml(c.club.name)}</option>`,
    )
    .join("")}`;
}

function clubRateFieldHtml(
  slug: string | null,
  rates: FinancialClubPaymentRate[],
  jobType: PromoterJobType,
  jobDate: string,
  selectedRateId: string | null,
): string {
  if (!slug?.trim() || !rates.length) return "";
  const forClub = rates.filter(
    (r) => r.isActive && (r.clubSlug?.trim() === slug || !r.clubSlug?.trim()),
  );
  if (!forClub.length) return "";
  return `<div class="cc-field full"><label>Payment rate</label>
    <select name="clubPaymentRateId">
      <option value="">Auto (venue default)</option>
      ${forClub
        .map(
          (r) =>
            `<option value="${escAttr(r.id)}"${r.id === selectedRateId ? " selected" : ""}>${escHtml(truncateDisplay(r.venueOrServiceName || r.id.slice(0, 8), 32))}</option>`,
        )
        .join("")}
    </select>
    <p class="admin-note">Defaults from venue master for ${escHtml(jobDate)} · ${escHtml(jobTypeLabel(jobType))}.</p>
  </div>`;
}

function headcountFieldsHtml(job: PromoterJob, readOnly: boolean): string {
  const ro = readOnly ? " readonly" : "";
  return `<h4 class="admin-subhead">Headcount</h4>
    <div class="admin-jobs-detail__grid">
      <div class="cc-field"><label>Joined</label><input name="guestsJoined" type="number" min="0" step="1" value="${job.guestsJoined}"${ro} /></div>
      <div class="cc-field"><label>Entered</label><input name="guestsEntered" type="number" min="0" step="1" value="${job.guestsEntered}"${ro} /></div>
      <div class="cc-field"><label>Male</label><input name="maleCount" type="number" min="0" step="1" value="${job.maleCount}"${ro} /></div>
      <div class="cc-field"><label>Female</label><input name="femaleCount" type="number" min="0" step="1" value="${job.femaleCount}"${ro} /></div>
      <div class="cc-field"><label>Guests (billing)</label><input name="guestsCount" type="number" min="0" step="1" value="${job.guestsCount}"${ro} /></div>
    </div>
    ${
      readOnly
        ? ""
        : `<div class="admin-actions"><button type="button" class="cc-btn cc-btn--ghost" id="admin-job-refresh-headcount">Refresh from guestlist</button></div>`
    }`;
}

function typeSpecificFieldsHtml(job: PromoterJob, readOnly: boolean): string {
  const ro = readOnly ? " readonly" : "";
  switch (job.jobType) {
    case "table":
    case "venue_hire":
      return `<h4 class="admin-subhead">Spend (gross inc. VAT)</h4>
        <div class="cc-field"><label>Gross £</label><input name="grossSpendGbp" type="number" min="0" step="0.01" value="${job.grossSpendGbp}"${ro} /></div>
        <p class="admin-note">Net = gross ÷ 1.20; concierge cut = 10% of net.</p>`;
    case "ticket":
      return `<h4 class="admin-subhead">Tickets</h4>
        <div class="cc-field"><label>Tickets sold</label><input name="ticketsSold" type="number" min="0" step="1" value="${job.ticketsSold}"${ro} /></div>`;
    default:
      return `<h4 class="admin-subhead">Legacy fees</h4>
        <div class="admin-jobs-detail__grid">
          <div class="cc-field"><label>Shift fee (£)</label><input name="shiftFee" type="number" step="0.01" value="${job.shiftFee}"${ro} /></div>
          <div class="cc-field"><label>Per guest (£)</label><input name="guestlistFee" type="number" step="0.01" value="${job.guestlistFee}"${ro} /></div>
        </div>`;
  }
}

function financialSnapshotHtml(job: PromoterJob, fin: JobComputedFinancials): string {
  const concierge = displayConciergeGbp(job, fin);
  const promoter = displayPromoterGbp(job, fin);
  return `<h4 class="admin-subhead">Financial snapshot</h4>
    <dl class="admin-jobs-detail__stats">
      <div><dt>Concierge</dt><dd>${escHtml(formatGbp(concierge))}</dd></div>
      <div><dt>Promoter</dt><dd>${escHtml(formatGbp(promoter))}</dd></div>
      <div><dt>Net / guestlist rev.</dt><dd>${escHtml(formatGbp(fin.netSpendGbp || fin.guestlistRevenueGbp))}</dd></div>
      <div><dt>Bonus</dt><dd>${escHtml(formatGbp(fin.bonusGbp))}</dd></div>
    </dl>
  ${
    fin.hasRateOverride
      ? `<p class="admin-note admin-jobs-detail__override">Manual rate override is set on this job.</p>`
      : `<p class="admin-note">Computed from venue master; saved to job when marked completed.</p>`
  }`;
}

function ratioCheckHtml(fin: JobComputedFinancials): string {
  const ok = fin.bonusValid;
  return `<h4 class="admin-subhead">Ratio check</h4>
    <p class="admin-jobs-detail__ratio admin-jobs-detail__ratio--${ok ? "ok" : "fail"}">
      ${ok ? "Pass — bonus eligible." : `Fail — bonus blocked.${fin.sexRatioReason ? ` ${escHtml(fin.sexRatioReason)}` : ""}`}
    </p>`;
}

export function renderJobDetailHtml(
  job: PromoterJobAdminRow,
  clubEntries: ClubEntry[],
  clients: ClientRow[],
  _promoters: PromoterProfile[],
  rates: FinancialClubPaymentRate[],
): string {
  const readOnly = job.status === "completed";
  const fin = computeJobDisplayFinancials(job, rates);
  const clientOpts = `<option value="">${escHtml("— None —")}</option>${clients
    .map(
      (c) =>
        `<option value="${escAttr(c.id)}"${c.id === job.clientId ? " selected" : ""}>${escHtml(truncateDisplay(c.name || c.email || c.phone || c.id.slice(0, 8), 28))}</option>`,
    )
    .join("")}`;
  const flags = [
    job.adminConfirmed
      ? `<span class="admin-list-badge admin-list-badge--completed">Confirmed</span>`
      : `<span class="admin-list-badge admin-list-badge--assigned">Unconfirmed</span>`,
    job.paid
      ? `<span class="admin-list-badge admin-list-badge--completed">Paid</span>`
      : `<span class="admin-list-badge admin-list-badge--pending">Unpaid</span>`,
    fin.bonusValid
      ? `<span class="admin-list-badge admin-list-badge--completed">Bonus OK</span>`
      : `<span class="admin-list-badge admin-list-badge--cancelled">Bonus blocked</span>`,
    renderStatusBadge(job.status),
    `<span class="admin-list-badge">${escHtml(jobTypeLabel(job.jobType))}</span>`,
  ].join(" ");

  return `<div class="admin-jobs-detail">
    <header class="admin-jobs-detail__header">
      <h4 class="admin-subhead" style="margin-top:0">${escHtml(job.promoterDisplayName)} · ${escHtml(job.jobDate)}</h4>
      <div class="admin-jobs-detail__badges">${flags}</div>
      <p class="admin-note">
        Club: <code>${escHtml(job.clubSlug ?? "—")}</code>
        · Promoter id: <code>${escHtml(job.promoterId.slice(0, 8))}…</code>
        ${job.clientId ? ` · Client linked` : job.clientName ? ` · ${escHtml(job.clientName)}` : ""}
      </p>
    </header>
    ${
      readOnly
        ? `<p class="admin-note">Completed job — limited edits. Delete only if you must undo linked earnings.</p>
           <input type="hidden" id="admin-job-edit-id" value="${escAttr(job.id)}" />
           <div class="admin-actions">
             <button type="button" class="cc-btn cc-btn--ghost" id="admin-job-edit-delete">Delete job</button>
           </div>`
        : `<form class="admin-form" id="admin-job-edit-form">
            <input type="hidden" name="jobId" value="${escAttr(job.id)}" />
            <h4 class="admin-subhead">Summary</h4>
            <div class="admin-jobs-detail__grid">
              <div class="cc-field"><label>Club</label><select name="clubSlug">${clubSelectOptionsHtml(clubEntries, job.clubSlug)}</select></div>
              ${clubRateFieldHtml(job.clubSlug, rates, job.jobType, job.jobDate, job.clubPaymentRateId ?? null)}
              <div class="cc-field"><label>Type</label><select name="jobType">${jobTypeSelectHtml(job.jobType)}</select></div>
              <div class="cc-field"><label>Date</label><input name="jobDate" type="date" value="${escAttr(job.jobDate)}" required /></div>
              <div class="cc-field"><label>Status</label>
                <select name="status">
                  <option value="assigned"${job.status === "assigned" ? " selected" : ""}>assigned</option>
                  <option value="cancelled"${job.status === "cancelled" ? " selected" : ""}>cancelled</option>
                </select>
              </div>
              <div class="cc-field"><label>Client</label><select name="clientId">${clientOpts}</select></div>
            </div>
            <div class="admin-jobs-detail__flags">
              <label class="admin-check-row"><input type="checkbox" name="adminConfirmed"${job.adminConfirmed ? " checked" : ""} /> Admin confirmed</label>
              <label class="admin-check-row"><input type="checkbox" name="paid"${job.paid ? " checked" : ""} /> Paid</label>
            </div>
            ${headcountFieldsHtml(job, false)}
            ${typeSpecificFieldsHtml(job, false)}
            ${financialSnapshotHtml(job, fin)}
            ${ratioCheckHtml(fin)}
            <h4 class="admin-subhead">Notes</h4>
            <div class="cc-field full"><textarea name="notes">${escHtml(job.notes)}</textarea></div>
            <div class="admin-actions">
              <button type="button" class="cc-btn cc-btn--gold" id="admin-job-edit-save">Save</button>
              <button type="button" class="cc-btn cc-btn--ghost" id="admin-job-edit-complete">Mark completed</button>
              <button type="button" class="cc-btn cc-btn--ghost" id="admin-job-quick-confirm"${job.adminConfirmed ? " disabled" : ""}>Quick confirm</button>
              <button type="button" class="cc-btn cc-btn--ghost" id="admin-job-mark-paid"${job.paid ? " disabled" : ""}>Mark paid</button>
              <button type="button" class="cc-btn cc-btn--ghost" id="admin-job-edit-delete">Delete</button>
            </div>
          </form>`
    }
    ${readOnly ? `${financialSnapshotHtml(job, fin)}${ratioCheckHtml(fin)}` : ""}
  </div>`;
}

export type CreateJobClientRow = {
  mode: "existing" | "blank" | "new";
  name: string;
  contact: string;
  newEmail?: string;
  newPhone?: string;
};

export function renderJobsCreateSectionHtml(
  promoters: PromoterProfile[],
  clubEntries: ClubEntry[],
  clients: ClientRow[],
  selectedPromoterId: string | null,
  createJobClients: CreateJobClientRow[],
): string {
  const clientRows = createJobClients.length
    ? createJobClients
        .map(
          (c, idx) =>
            `<tr><td>${escHtml(c.mode === "existing" ? "existing" : c.mode === "blank" ? "blank" : "new profile")}</td><td>${escHtml(c.name || "New client")}</td><td>${escHtml(c.contact || "—")}</td><td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-admin-job-remove-client="${idx}">Remove</button></td></tr>`,
        )
        .join("")
    : "<tr><td colspan='4'>No clients added yet.</td></tr>";

  return `<section class="admin-jobs__create" aria-label="Create job">
    <h4 class="admin-jobs__create-title">Create job</h4>
    <form class="admin-form admin-jobs__create-form" id="promoter-job-form">
      <div class="cc-field"><label>Promoter</label>
        <select name="promoterId">${promoters
          .map(
            (p) =>
              `<option value="${escAttr(p.id)}"${p.id === (selectedPromoterId ?? "") ? " selected" : ""}>${escHtml(p.displayName || p.userId)}</option>`,
          )
          .join("")}</select>
      </div>
      <div class="cc-field"><label>Club</label>
        <select name="clubSlug">
          <option value="">(none)</option>
          ${clubEntries.map((c) => `<option value="${escAttr(c.club.slug)}">${escHtml(c.club.name)}</option>`).join("")}
        </select>
      </div>
      <div class="cc-field"><label>Date</label><input name="jobDate" type="date" value="${escAttr(new Date().toISOString().slice(0, 10))}" required /></div>
      <div class="cc-field"><label>Type</label><select name="jobType">${jobTypeSelectHtml("guestlist")}</select></div>
      <div class="cc-field"><label>Status</label>
        <select name="status">
          <option value="assigned">assigned (upcoming)</option>
          <option value="completed">completed (already happened)</option>
        </select>
      </div>
      <div class="cc-field"><label>Client</label>
        <select name="clientId">
          <option value="">(none)</option>
          ${clients.map((c) => `<option value="${escAttr(c.id)}">${escHtml(truncateDisplay(c.name || c.email || c.phone || c.id.slice(0, 8), 28))}</option>`).join("")}
        </select>
      </div>
      <div class="cc-field"><label>Client mode (multi)</label>
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
          ${clients.map((c) => `<option value="${escAttr(c.id)}">${escHtml(truncateDisplay(c.name || c.email || c.phone || c.id.slice(0, 8), 28))}</option>`).join("")}
        </select>
      </div>
      <div class="cc-field" id="admin-job-new-client-name" hidden><label>New client name</label><input name="newClientName" placeholder="Client full name" /></div>
      <div class="cc-field" id="admin-job-new-client-email" hidden><label>New client email</label><input name="newClientEmail" type="email" /></div>
      <div class="cc-field" id="admin-job-new-client-phone" hidden><label>New client phone</label><input name="newClientPhone" /></div>
      <div class="admin-actions full">
        <button class="cc-btn cc-btn--ghost" type="button" id="admin-job-add-client">+ Add client</button>
      </div>
      <div class="full promoter-table-wrap">
        <table>
          <thead><tr><th>Type</th><th>Name</th><th>Contact</th><th>Remove</th></tr></thead>
          <tbody id="admin-job-clients-body">${clientRows}</tbody>
        </table>
      </div>
      <div class="admin-jobs-detail__grid">
        <div class="cc-field"><label>Shift fee (£)</label><input name="shiftFee" type="number" step="0.01" value="0" /></div>
        <div class="cc-field"><label>Per guest (£)</label><input name="guestFee" type="number" step="0.01" value="0" /></div>
        <div class="cc-field"><label>Guests count</label><input name="guestCount" type="number" step="1" value="0" /></div>
        <div class="cc-field"><label>Gross spend (£)</label><input name="grossSpendGbp" type="number" step="0.01" value="0" /></div>
        <div class="cc-field"><label>Tickets sold</label><input name="ticketsSold" type="number" step="1" value="0" /></div>
      </div>
      <div class="cc-field full"><label>Notes</label><textarea name="notes" rows="3"></textarea></div>
      <div class="admin-actions">
        <button class="cc-btn cc-btn--gold" type="button" id="promoter-job-create">Create job</button>
      </div>
    </form>
  </section>`;
}

export function renderJobsViewHtml(opts: {
  jobsCalendarYear: number;
  jobsCalendarMonth: number;
  jobsCalendarRows: PromoterJobAdminRow[];
  jobsCalendarOpen: boolean;
  jobsCreateOpen: boolean;
  selectedJobId: string | null;
  clubEntries: ClubEntry[];
  clients: ClientRow[];
  promoters: PromoterProfile[];
  selectedPromoterId: string | null;
  createJobClients: CreateJobClientRow[];
  rates: FinancialClubPaymentRate[];
  filters: JobsLedgerFilters;
  listSearch: string;
}): string {
  const {
    jobsCalendarYear,
    jobsCalendarMonth,
    jobsCalendarRows,
    jobsCalendarOpen,
    jobsCreateOpen,
    selectedJobId,
    clubEntries,
    clients,
    promoters,
    selectedPromoterId,
    createJobClients,
    rates,
    filters,
    listSearch,
  } = opts;

  const monthLabel = new Date(jobsCalendarYear, jobsCalendarMonth, 1).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const filtered = filterJobsRows(jobsCalendarRows, filters, listSearch);
  const selectedJob = selectedJobId
    ? jobsCalendarRows.find((j) => j.id === selectedJobId)
    : undefined;

  const calHtml = buildAdminJobsCalendarHtml(
    jobsCalendarYear,
    jobsCalendarMonth,
    filtered,
    rates,
  );

  let detailHtml = "";
  if (selectedJob) {
    detailHtml = renderJobDetailHtml(selectedJob, clubEntries, clients, promoters, rates);
  } else if (jobsCreateOpen) {
    detailHtml = renderJobsCreateSectionHtml(
      promoters,
      clubEntries,
      clients,
      selectedPromoterId,
      createJobClients,
    );
  } else {
    detailHtml = `<p class="admin-note">Select a job from the list, open the calendar, or click <strong>Add new</strong> to create one.</p>`;
  }

  return `<div class="admin-jobs">
    ${
      jobsCalendarOpen
        ? `<section class="admin-jobs__calendar" aria-label="Job calendar">
            <div class="admin-jobs__cal-toolbar">
              <button type="button" class="cc-btn cc-btn--ghost" id="jobs-cal-prev" aria-label="Previous month">←</button>
              <h4 class="admin-jobs__cal-title">${escHtml(monthLabel)}</h4>
              <button type="button" class="cc-btn cc-btn--ghost" id="jobs-cal-next" aria-label="Next month">→</button>
            </div>
            ${calHtml}
            <p class="admin-note">Pills are coloured by job type; striped pills mean bonus blocked (ratio fail).</p>
          </section>`
        : ""
    }
    ${detailHtml}
  </div>`;
}

export function jobsDataTableColumns(
  rates: FinancialClubPaymentRate[],
): Array<{
  key: string;
  label: string;
  sortable?: boolean;
  accessor?: (j: PromoterJobAdminRow) => string | number;
  render?: (j: PromoterJobAdminRow) => string;
  align?: "left" | "right";
  width?: string;
}> {
  return [
    {
      key: "date",
      label: "Date",
      sortable: true,
      accessor: (j) => j.jobDate,
    },
    {
      key: "club",
      label: "Club",
      sortable: true,
      accessor: (j) => j.clubSlug ?? "",
      render: (j) => escHtml(truncateDisplay(j.clubSlug ?? "—", 14)),
    },
    {
      key: "promoter",
      label: "Promoter",
      sortable: true,
      accessor: (j) => j.promoterDisplayName,
      render: (j) => escHtml(truncateDisplay(j.promoterDisplayName, 18)),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      accessor: (j) => j.jobType,
      render: (j) => escHtml(jobTypeLabel(j.jobType)),
    },
    {
      key: "headcount",
      label: "Joined/Entered",
      render: (j) => escHtml(`${j.guestsJoined}/${j.guestsEntered}`),
    },
    {
      key: "mf",
      label: "M/F",
      render: (j) => escHtml(`${j.maleCount}/${j.femaleCount}`),
    },
    {
      key: "concierge",
      label: "Concierge £",
      align: "right",
      render: (j) => {
        const fin = computeJobDisplayFinancials(j, rates);
        return escHtml(formatGbp(displayConciergeGbp(j, fin)));
      },
    },
    {
      key: "promoterCut",
      label: "Promoter £",
      align: "right",
      render: (j) => {
        const fin = computeJobDisplayFinancials(j, rates);
        return escHtml(formatGbp(displayPromoterGbp(j, fin)));
      },
    },
    {
      key: "confirmed",
      label: "Conf.",
      render: (j) =>
        j.adminConfirmed
          ? `<span class="admin-list-badge admin-list-badge--completed">Y</span>`
          : `<span class="admin-list-badge admin-list-badge--pending">—</span>`,
    },
    {
      key: "paid",
      label: "Paid",
      render: (j) =>
        j.paid
          ? `<span class="admin-list-badge admin-list-badge--completed">Y</span>`
          : `<span class="admin-list-badge admin-list-badge--pending">—</span>`,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (j) => j.status,
      render: (j) => renderStatusBadge(j.status),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: "120px",
      render: (j) => {
        const confirmBtn = j.adminConfirmed
          ? ""
          : `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-job-quick-confirm="${escAttr(j.id)}">Confirm</button>`;
        const paidBtn = j.paid
          ? ""
          : `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-job-mark-paid="${escAttr(j.id)}">Paid</button>`;
        return `${confirmBtn}${paidBtn}
          <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-open-job-edit="${escAttr(j.id)}">Open</button>`;
      },
    },
  ];
}
