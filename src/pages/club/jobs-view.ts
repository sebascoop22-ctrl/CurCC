import { escAttr, escHtml } from "../../portal/html";
import { renderStatusBadge } from "../../portal/badge";
import type { ClubPortalJobRow, JobDisputeRow } from "../../admin/clubs";
import type { FinancialClubPaymentRate } from "../../types";
import { billingHeadcount } from "../../lib/financial/calculations";
import { formatGbp, jobTypeLabel } from "../../lib/financial/job-display";
import {
  computeJobDisplayFinancials,
  displayConciergeGbp,
} from "../admin/jobs-shared";

export function venueTypeLabel(t: string | null | undefined): string {
  if (t === "high_end") return "High-end (tables + guestlist)";
  if (t === "regional_ticket") return "Regional (tickets)";
  return "—";
}

export function headcountSummary(job: ClubPortalJobRow): string {
  const entered = billingHeadcount(job);
  return `${entered} entered · ${job.guestsJoined} joined · ${job.maleCount}M / ${job.femaleCount}F`;
}

export function buildClubDisputeEvidence(job: ClubPortalJobRow): Record<string, unknown> {
  return {
    job_date: job.jobDate,
    job_type: job.jobType,
    guests_joined: job.guestsJoined,
    guests_entered: job.guestsEntered,
    guests_count: job.guestsCount,
    male_count: job.maleCount,
    female_count: job.femaleCount,
    tickets_sold: job.ticketsSold,
    gross_spend_gbp: job.grossSpendGbp,
    concierge_cut_gbp: job.conciergeCutGbp,
    bonus_valid: job.bonusValid,
    admin_confirmed: job.adminConfirmed,
    paid: job.paid,
  };
}

export function disputeDescriptionWithHeadcount(
  job: ClubPortalJobRow,
  note: string,
  reasonCode: string,
): string {
  const base = note.trim() || "Club requested dispute review.";
  const hc = headcountSummary(job);
  return `${base}\n\nRecorded headcount: ${hc}. Reason: ${reasonCode.replace(/_/g, " ")}.`;
}

function openDisputesForJob(disputes: JobDisputeRow[], jobId: string): JobDisputeRow[] {
  return disputes.filter(
    (d) =>
      d.promoter_job_id === jobId &&
      (d.status === "open" || d.status === "under_review"),
  );
}

export function renderClubJobDetailHtml(
  job: ClubPortalJobRow | null,
  rates: FinancialClubPaymentRate[],
  disputes: JobDisputeRow[],
): string {
  if (!job) {
    return `<p class="admin-note">Select a job to review headcount, concierge totals, and raise a dispute.</p>`;
  }
  const fin = computeJobDisplayFinancials(job, rates);
  const concierge = displayConciergeGbp(job, fin);
  const open = openDisputesForJob(disputes, job.id);
  const ratioNote = !job.bonusValid
    ? `<p class="admin-note club-job-detail__warn">Bonus blocked — male/female ratio did not meet venue rules.</p>`
    : "";
  return `<div class="club-job-detail" data-job-id="${escAttr(job.id)}">
    <header class="club-job-detail__header">
      <h4>${escHtml(jobTypeLabel(job.jobType))} · ${escHtml(job.jobDate)} · ${escHtml(job.promoterDisplayName)}</h4>
      <p class="admin-note">${escHtml(headcountSummary(job))}</p>
    </header>
    <div class="club-job-detail__flags">
      ${renderStatusBadge(job.status)}
      ${job.adminConfirmed ? `<span class="club-job-flag club-job-flag--ok">Admin confirmed</span>` : `<span class="club-job-flag">Awaiting confirm</span>`}
      ${job.paid ? `<span class="club-job-flag club-job-flag--paid">Paid</span>` : ""}
    </div>
    <div class="club-job-payout">
      <h4>Concierge total (read-only)</h4>
      <p class="club-job-payout__amount">${escHtml(formatGbp(concierge))}</p>
      <p class="admin-note">VAT-exclusive net spend and commission follow venue master rules. Cooper admin confirms final billing.</p>
      ${ratioNote}
    </div>
    <div class="club-job-detail__grid">
      <div><span class="club-job-detail__label">Client (job)</span><strong>${escHtml(job.clientName || "—")}</strong></div>
      <div><span class="club-job-detail__label">Tickets sold</span><strong>${job.ticketsSold}</strong></div>
      <div><span class="club-job-detail__label">Gross spend</span><strong>${escHtml(formatGbp(job.grossSpendGbp))}</strong></div>
    </div>
    ${
      open.length
        ? `<p class="admin-note">Open dispute${open.length > 1 ? "s" : ""}: ${open.map((d) => escHtml(d.reason_code)).join(", ")}</p>`
        : ""
    }
    <form class="admin-form club-job-dispute-form" id="club-job-dispute-form">
      <h4 class="full">Raise dispute</h4>
      <div class="cc-field full"><label>Reason</label>
        <select name="reasonCode">
          <option value="headcount_mismatch">Headcount mismatch</option>
          <option value="ratio_issue">Sex ratio / bonus issue</option>
          <option value="wrong_job_type">Wrong job type</option>
          <option value="club_dispute">Other</option>
        </select>
      </div>
      <div class="cc-field full"><label>Details</label>
        <textarea name="description" rows="3" placeholder="Explain what should be corrected. Headcount fields are attached automatically."></textarea>
      </div>
      <div class="admin-actions full">
        <button type="button" class="cc-btn cc-btn--ghost" data-job-action="${escAttr(job.id)}" data-decision="approve">Approve job</button>
        <button type="button" class="cc-btn cc-btn--ghost" data-job-action="${escAttr(job.id)}" data-decision="deny">Deny job</button>
        <button type="submit" class="cc-btn cc-btn--gold">Submit dispute</button>
      </div>
    </form>
  </div>`;
}

export function renderClubJobsWorkspaceHtml(opts: {
  jobs: ClubPortalJobRow[];
  selectedJobId: string | null;
  rates: FinancialClubPaymentRate[];
  disputes: JobDisputeRow[];
}): string {
  const { jobs, selectedJobId, rates, disputes } = opts;
  const selected = selectedJobId ? jobs.find((j) => j.id === selectedJobId) ?? null : null;
  const rows =
    jobs.length === 0
      ? `<tr><td colspan="7" class="admin-note">No jobs mapped to this club.</td></tr>`
      : jobs
          .map((j) => {
            const entered = billingHeadcount(j);
            const open = openDisputesForJob(disputes, j.id).length > 0;
            const fin = computeJobDisplayFinancials(j, rates);
            const cut = displayConciergeGbp(j, fin);
            return `<tr class="club-job-row${j.id === selectedJobId ? " is-selected" : ""}" data-club-job-id="${escAttr(j.id)}">
              <td>${escHtml(j.jobDate)}</td>
              <td>${escHtml(j.promoterDisplayName)}</td>
              <td>${escHtml(jobTypeLabel(j.jobType))}${!j.bonusValid ? ` <span class="pp-badge pp-badge--warning"><span class="pp-badge__dot"></span><span class="pp-badge__text">Ratio</span></span>` : ""}</td>
              <td>${entered}</td>
              <td>${renderStatusBadge(j.status)}</td>
              <td>${escHtml(formatGbp(cut))}</td>
              <td>${open ? `<span class="pp-badge pp-badge--warning"><span class="pp-badge__dot"></span><span class="pp-badge__text">Dispute</span></span>` : "—"}</td>
            </tr>`;
          })
          .join("");
  return `<div class="club-jobs-layout">
    <div class="club-panel">
      <p class="promoter-panel__title">Jobs at your venue</p>
      <p class="admin-note">Read-only view of promoter jobs for your club slug only. Client names on jobs are visible; full CRM records are not.</p>
      <div class="club-table-wrap">
        <table class="club-jobs-table">
          <thead><tr><th>Date</th><th>Promoter</th><th>Type</th><th>Entered</th><th>Status</th><th>Concierge</th><th>Dispute</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    <div class="club-panel club-jobs-detail-panel">
      ${renderClubJobDetailHtml(selected, rates, disputes)}
    </div>
  </div>`;
}
