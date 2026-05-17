import { escAttr, escHtml } from "../../portal/html";
import { renderStatusBadge } from "../../portal/badge";
import type { Club, PromoterGuestlistEntry, PromoterJob } from "../../types";
import { formatGbp, jobTypeLabel, PROMOTER_JOB_TYPES } from "../../lib/financial/job-display";
import {
  computeJobDisplayFinancials,
  displayPromoterGbp,
} from "../admin/jobs-shared";
import type { JobComputedFinancials } from "../admin/jobs-shared";
import type { FinancialClubPaymentRate } from "../../types";

export type PromoterJobsFilters = {
  jobType: string;
  status: string;
  dateFrom: string;
  dateTo: string;
};

export function defaultPromoterJobsFilters(): PromoterJobsFilters {
  return { jobType: "", status: "", dateFrom: "", dateTo: "" };
}

export function filterPromoterJobs(
  jobs: PromoterJob[],
  filters: PromoterJobsFilters,
): PromoterJob[] {
  return jobs.filter((j) => {
    if (filters.jobType && j.jobType !== filters.jobType) return false;
    if (filters.status && j.status !== filters.status) return false;
    const d = j.jobDate.slice(0, 10);
    if (filters.dateFrom && d < filters.dateFrom) return false;
    if (filters.dateTo && d > filters.dateTo) return false;
    return true;
  });
}

function clientLabel(
  job: PromoterJob,
  clients: Array<{ id: string; name: string; email: string; phone: string }>,
): string {
  if (job.clientId) {
    const c = clients.find((x) => x.id === job.clientId);
    if (c) return c.name || c.email || c.phone || "Client";
  }
  return job.clientName?.trim() || "—";
}

export function renderPromoterJobListRow(
  job: PromoterJob,
  clients: Array<{ id: string; name: string; email: string; phone: string }>,
  selected: boolean,
): string {
  const bonusBadge = !job.bonusValid
    ? `<span class="pp-badge pp-badge--warning"><span class="pp-badge__dot"></span><span class="pp-badge__text">Ratio</span></span>`
    : "";
  const flags = [
    job.adminConfirmed
      ? `<span class="promoter-job-flag promoter-job-flag--ok">Confirmed</span>`
      : "",
    job.paid ? `<span class="promoter-job-flag promoter-job-flag--paid">Paid</span>` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<tr class="promoter-job-row${selected ? " is-selected" : ""}" data-promoter-job-id="${escAttr(job.id)}">
    <td>${escHtml(job.jobDate)}</td>
    <td>${escHtml(job.clubSlug ?? "—")}</td>
    <td>${escHtml(jobTypeLabel(job.jobType))} ${bonusBadge}</td>
    <td>${escHtml(clientLabel(job, clients))}</td>
    <td>${renderStatusBadge(job.status)}</td>
    <td>${flags || "—"}</td>
  </tr>`;
}

function headcountFormHtml(job: PromoterJob, editable: boolean): string {
  const ro = editable ? "" : " readonly";
  const dis = editable ? "" : " disabled";
  return `<form class="admin-form promoter-job-headcount-form" data-job-id="${escAttr(job.id)}">
    <h4 class="full">Headcount</h4>
    <div class="promoter-job-detail__grid">
      <div class="cc-field"><label>Joined</label><input name="guestsJoined" type="number" min="0" step="1" value="${job.guestsJoined}"${ro}${dis} /></div>
      <div class="cc-field"><label>Entered</label><input name="guestsEntered" type="number" min="0" step="1" value="${job.guestsEntered}"${ro}${dis} /></div>
      <div class="cc-field"><label>Male</label><input name="maleCount" type="number" min="0" step="1" value="${job.maleCount}"${ro}${dis} /></div>
      <div class="cc-field"><label>Female</label><input name="femaleCount" type="number" min="0" step="1" value="${job.femaleCount}"${ro}${dis} /></div>
      <div class="cc-field"><label>Guests (billing)</label><input name="guestsCount" type="number" min="0" step="1" value="${job.guestsCount}"${ro}${dis} /></div>
    </div>
    ${
      job.jobType === "table" || job.jobType === "venue_hire"
        ? `<div class="cc-field"><label>Gross spend (£)</label><input name="grossSpendGbp" type="number" min="0" step="0.01" value="${job.grossSpendGbp}"${ro}${dis} /></div>`
        : ""
    }
    ${
      job.jobType === "ticket"
        ? `<div class="cc-field"><label>Tickets sold</label><input name="ticketsSold" type="number" min="0" step="1" value="${job.ticketsSold}"${ro}${dis} /></div>`
        : ""
    }
    ${
      editable
        ? `<div class="admin-actions full"><button type="submit" class="cc-btn cc-btn--gold">Save headcount</button>
           <button type="button" class="cc-btn cc-btn--ghost" data-promoter-job-complete="${escAttr(job.id)}">Mark completed</button></div>`
        : ""
    }
  </form>`;
}

function payoutSummaryHtml(job: PromoterJob, fin: JobComputedFinancials): string {
  const payout = displayPromoterGbp(job, fin);
  return `<div class="promoter-job-payout">
    <h4>Expected payout (estimate)</h4>
    <p class="promoter-job-payout__amount">${escHtml(formatGbp(payout))}</p>
    <p class="admin-note">Read-only estimate from venue rules and your fees. Admin confirms final amounts.</p>
    ${
      !fin.bonusValid
        ? `<p class="admin-note promoter-job-payout__warn">Bonus blocked — check male/female ratio for this venue.</p>`
        : fin.bonusGbp > 0
          ? `<p class="admin-note">Includes up to ${escHtml(formatGbp(fin.bonusGbp))} bonus if ratio passes.</p>`
          : ""
    }
  </div>`;
}

function guestlistPanelHtml(
  job: PromoterJob,
  entries: PromoterGuestlistEntry[],
): string {
  if (job.jobType !== "guestlist" || job.status !== "assigned") return "";
  const rows =
    entries.length === 0
      ? `<tr><td colspan="4" class="admin-note">No guests submitted yet.</td></tr>`
      : entries
          .map(
            (e) =>
              `<tr><td>${escHtml(e.guestName)}</td><td>${escHtml(e.guestContact || "—")}</td>
              <td><span class="promoter-gl-status promoter-gl-status--${escAttr(e.approvalStatus)}">${escHtml(e.approvalStatus)}</span></td>
              <td>${escHtml(e.createdAt.slice(0, 10))}</td></tr>`,
          )
          .join("");
  return `<div class="promoter-panel" style="margin-top:1rem">
    <h4>Guestlist — ${escHtml(job.jobDate)} · ${escHtml(job.clubSlug ?? "")}</h4>
    <p class="admin-note">Names are reviewed by admin before they count toward billing.</p>
    <form class="admin-form promoter-gl-add-form" data-add-gl-job="${escAttr(job.id)}">
      <div class="cc-field"><label>Name</label><input name="guestName" required /></div>
      <div class="cc-field"><label>Contact</label><input name="guestContact" placeholder="Phone or email" /></div>
      <div class="admin-actions"><button type="submit" class="cc-btn cc-btn--gold">Add guest</button></div>
    </form>
    <div class="promoter-table-wrap" style="margin-top:0.75rem">
      <table><thead><tr><th>Name</th><th>Contact</th><th>Status</th><th>Added</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>
  </div>`;
}

export function renderPromoterJobDetailHtml(
  job: PromoterJob | null,
  clients: Array<{ id: string; name: string; email: string; phone: string }>,
  rates: FinancialClubPaymentRate[],
  guestlistEntries: PromoterGuestlistEntry[],
): string {
  if (!job) {
    return `<p class="admin-note">Select a job from the list to view headcount, payout estimate, and guestlist.</p>`;
  }
  const editable = job.status === "assigned";
  const fin = computeJobDisplayFinancials(job, rates);
  const flags = [
    job.adminConfirmed ? "Admin confirmed" : "Awaiting admin confirm",
    job.paid ? "Paid" : "Not paid yet",
    fin.bonusValid ? "Bonus eligible" : "Bonus blocked (ratio)",
  ];
  return `<div class="promoter-job-detail">
    <header class="promoter-job-detail__header">
      <h4>${escHtml(jobTypeLabel(job.jobType))} · ${escHtml(job.jobDate)} · ${escHtml(job.clubSlug ?? "—")} · ${escHtml(clientLabel(job, clients))}</h4>
      <div class="promoter-job-detail__flags">${flags.map((f) => `<span class="admin-note">${escHtml(f)}</span>`).join(" · ")}</div>
    </header>
    ${payoutSummaryHtml(job, fin)}
    ${headcountFormHtml(job, editable)}
    ${guestlistPanelHtml(job, guestlistEntries.filter((e) => e.promoterJobId === job.id))}
  </div>`;
}

export function renderPromoterJobsViewHtml(opts: {
  jobs: PromoterJob[];
  filters: PromoterJobsFilters;
  selectedJobId: string | null;
  clients: Array<{ id: string; name: string; email: string; phone: string }>;
  clubs: Club[];
  rates: FinancialClubPaymentRate[];
  guestlistEntries: PromoterGuestlistEntry[];
}): string {
  const { jobs, filters, selectedJobId, clients, clubs, rates, guestlistEntries } = opts;
  const filtered = filterPromoterJobs(jobs, filters);
  const selected = selectedJobId
    ? jobs.find((j) => j.id === selectedJobId) ?? null
    : null;
  const typeOpts = PROMOTER_JOB_TYPES.map(
    (t) =>
      `<option value="${escAttr(t)}"${filters.jobType === t ? " selected" : ""}>${escHtml(jobTypeLabel(t))}</option>`,
  ).join("");
  const clientOpts = clients
    .map(
      (c) =>
        `<option value="${escAttr(c.id)}">${escHtml(c.name || c.email || c.phone || c.id.slice(0, 8))}</option>`,
    )
    .join("");
  const listRows =
    filtered.length === 0
      ? `<tr><td colspan="6" class="admin-note">No jobs match filters.</td></tr>`
      : filtered
          .map((j) => renderPromoterJobListRow(j, clients, j.id === selectedJobId))
          .join("");

  return `<div class="promoter-jobs-layout">
    <div class="promoter-panel">
      <p class="promoter-panel__title">Create job</p>
      <form class="admin-form" id="promoter-create-job-form" data-collapsible="true">
        <div class="cc-field pp-col-3"><label>Date</label><input type="date" name="jobDate" required value="${escAttr(new Date().toISOString().slice(0, 10))}" /></div>
        <div class="cc-field pp-col-4"><label>Club</label><select name="clubSlug" required>${clubs.map((c) => `<option value="${escAttr(c.slug)}">${escHtml(c.name)}</option>`).join("")}</select></div>
        <div class="cc-field pp-col-3"><label>Job type</label>
          <select name="jobType">${PROMOTER_JOB_TYPES.map((t) => `<option value="${escAttr(t)}">${escHtml(jobTypeLabel(t))}</option>`).join("")}</select>
        </div>
        <div class="cc-field pp-col-3"><label>Status</label>
          <select name="status"><option value="assigned">Upcoming</option><option value="completed">Completed</option></select>
        </div>
        <div class="cc-field pp-col-5"><label>Client</label>
          <select name="clientId"><option value="">(none)</option>${clientOpts}</select>
        </div>
        <div class="cc-field pp-col-3"><label>Shift fee (£)</label><input type="number" name="shiftFee" min="0" step="0.01" value="0" /></div>
        <div class="cc-field pp-col-3"><label>Per guest (£)</label><input type="number" name="guestlistFee" min="0" step="0.01" value="0" /></div>
        <div class="cc-field pp-col-3"><label>Guest count</label><input type="number" name="guestsCount" min="0" step="1" value="0" /></div>
        <div class="cc-field full"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
        <div class="admin-actions full">
          <button type="submit" class="cc-btn cc-btn--gold">Create job</button>
        </div>
      </form>
    </div>
    <div class="promoter-panel">
      <p class="promoter-panel__title">Your jobs</p>
      <form id="promoter-jobs-filter-form" class="promoter-jobs-filters">
        <div class="cc-field"><label>Type</label><select name="jobType"><option value="">All</option>${typeOpts}</select></div>
        <div class="cc-field"><label>Status</label>
          <select name="status">
            <option value="">All</option>
            <option value="assigned"${filters.status === "assigned" ? " selected" : ""}>Assigned</option>
            <option value="completed"${filters.status === "completed" ? " selected" : ""}>Completed</option>
            <option value="cancelled"${filters.status === "cancelled" ? " selected" : ""}>Cancelled</option>
          </select>
        </div>
        <div class="cc-field"><label>From</label><input type="date" name="dateFrom" value="${escAttr(filters.dateFrom)}" /></div>
        <div class="cc-field"><label>To</label><input type="date" name="dateTo" value="${escAttr(filters.dateTo)}" /></div>
        <div class="promoter-jobs-filters__actions"><button type="submit" class="cc-btn cc-btn--ghost">Apply</button></div>
      </form>
      <div class="promoter-table-wrap">
        <table class="promoter-jobs-table">
          <thead><tr><th>Date</th><th>Club</th><th>Type</th><th>Client</th><th>Status</th><th>Office</th></tr></thead>
          <tbody>${listRows}</tbody>
        </table>
      </div>
    </div>
    <div class="promoter-panel promoter-jobs-detail-panel">
      ${renderPromoterJobDetailHtml(selected, clients, rates, guestlistEntries)}
    </div>
  </div>`;
}
