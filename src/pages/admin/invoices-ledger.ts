import { escAttr, escHtml } from "../../portal/html";
import { renderStatusBadge } from "../../portal/badge";
import type { PromoterInvoiceLine } from "../../admin/invoices";
import type { PromoterInvoiceAdminRow } from "../../admin/invoices";
import { billingHeadcount, computeJobLedgerAmountGbp } from "../../lib/financial/calculations";
import type {
  InvoiceVerificationLineDiff,
  PromoterInvoice,
  PromoterJob,
  PromoterProfile,
} from "../../types";
import { jobTypeLabel } from "./jobs-shared";
import {
  formatInvoiceGbp,
  lineHasDiff,
  renderInvoiceVerificationBadge,
  renderVerificationDiffRows,
} from "./invoices-shared";

export type InvoicesLedgerFilters = {
  promoterId: string;
};

export function defaultInvoicesLedgerFilters(): InvoicesLedgerFilters {
  return { promoterId: "" };
}

export function renderInvoicesListFiltersHtml(
  filters: InvoicesLedgerFilters,
  promoters: PromoterProfile[],
): string {
  const promoterOpts = [
    `<option value="">All promoters</option>`,
    ...promoters.map(
      (p) =>
        `<option value="${escAttr(p.id)}"${p.id === filters.promoterId ? " selected" : ""}>${escHtml(p.displayName || p.userId)}</option>`,
    ),
  ].join("");
  return `<div class="admin-invoices-ledger-filters">
    <form id="invoices-filter-form" class="admin-invoices-ledger-filters__form">
      <div class="cc-field"><label for="invoices-filter-promoter">Promoter</label>
        <select id="invoices-filter-promoter" name="promoterId">${promoterOpts}</select>
      </div>
      <div class="admin-invoices-ledger-filters__actions">
        <button type="submit" class="cc-btn cc-btn--gold">Apply filter</button>
      </div>
    </form>
  </div>`;
}

export function invoicesDataTableColumns() {
  return [
    {
      key: "promoter",
      label: "Promoter",
      sortable: true,
      accessor: (i: PromoterInvoiceAdminRow) => i.promoterDisplayName,
      render: (i: PromoterInvoiceAdminRow) => escHtml(i.promoterDisplayName),
    },
    {
      key: "period",
      label: "Period",
      sortable: true,
      accessor: (i: PromoterInvoiceAdminRow) => i.periodEnd,
      render: (i: PromoterInvoiceAdminRow) =>
        escHtml(`${i.periodStart.slice(0, 10)} – ${i.periodEnd.slice(0, 10)}`),
    },
    {
      key: "status",
      label: "Invoice",
      sortable: true,
      accessor: (i: PromoterInvoiceAdminRow) => i.status,
      render: (i: PromoterInvoiceAdminRow) => renderStatusBadge(i.status),
    },
    {
      key: "total",
      label: "Total",
      sortable: true,
      accessor: (i: PromoterInvoiceAdminRow) => i.total,
      render: (i: PromoterInvoiceAdminRow) => escHtml(formatInvoiceGbp(i.total)),
    },
    {
      key: "verification",
      label: "Verification",
      sortable: true,
      accessor: (i: PromoterInvoiceAdminRow) => i.verificationStatus,
      render: (i: PromoterInvoiceAdminRow) => renderInvoiceVerificationBadge(i.verificationStatus),
    },
    {
      key: "ledger",
      label: "Ledger",
      sortable: true,
      accessor: (i: PromoterInvoiceAdminRow) => i.ledgerTotalGbp,
      render: (i: PromoterInvoiceAdminRow) =>
        i.ledgerTotalGbp > 0 ? escHtml(formatInvoiceGbp(i.ledgerTotalGbp)) : "—",
    },
  ];
}

export function renderInvoicesDetailPanelHtml(opts: {
  selectedInvoice: PromoterInvoice | null;
  promoters: PromoterProfile[];
  submittedLines: PromoterInvoiceLine[];
  ledgerJobs: PromoterJob[];
  diffLines: InvoiceVerificationLineDiff[];
  invoiceFormOpen: boolean;
  defaultPromoterId: string | null;
}): string {
  const {
    selectedInvoice: inv,
    promoters,
    submittedLines,
    ledgerJobs,
    diffLines,
    invoiceFormOpen,
    defaultPromoterId,
  } = opts;

  const generateBlock = invoiceFormOpen
    ? `<form class="admin-form" id="promoter-invoice-form" data-collapsible="true">
        <h4 class="full">Generate invoice</h4>
        <div class="cc-field"><label>Promoter</label>
          <select name="promoterId">${promoters
            .map(
              (p) =>
                `<option value="${escAttr(p.id)}"${p.id === (inv?.promoterId ?? defaultPromoterId) ? " selected" : ""}>${escHtml(p.displayName || p.userId)}</option>`,
            )
            .join("")}</select>
        </div>
        <div class="cc-field"><label>Period start</label><input name="from" type="date" value="${escAttr(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))}" /></div>
        <div class="cc-field"><label>Period end</label><input name="to" type="date" value="${escAttr(new Date().toISOString().slice(0, 10))}" /></div>
        <div class="admin-actions full">
          <button class="cc-btn cc-btn--gold" type="button" id="promoter-invoice-generate">Generate invoice</button>
        </div>
        <p class="admin-note full">PDF and email use the <code>promoter-invoice</code> Edge Function.</p>
      </form>`
    : `<p class="admin-note">Generate a new statement from completed jobs in the period.</p>
       <button class="pp-btn pp-btn--primary" type="button" id="open-invoice-form">Generate invoice</button>`;

  if (!inv) {
    return `<div class="admin-invoices-detail">${generateBlock}
      <p class="admin-note" style="margin-top:1rem">Select an invoice in the list to verify against the job ledger.</p>
    </div>`;
  }

  const lineByJob = new Map<string, PromoterInvoiceLine>();
  for (const line of submittedLines) {
    if (line.promoterJobId) lineByJob.set(line.promoterJobId, line);
  }

  const submittedRows =
    submittedLines.length === 0
      ? `<tr><td colspan="6" class="admin-note">No submitted lines on this invoice.</td></tr>`
      : submittedLines
          .map((line) => {
            const jobId = line.promoterJobId;
            const totalDiff = jobId ? lineHasDiff(jobId, "line_total", diffLines) : false;
            const qtyDiff = jobId ? lineHasDiff(jobId, "guest_count", diffLines) : false;
            const rowCls = totalDiff || qtyDiff ? "admin-invoice-diff-row--bad" : "";
            return `<tr class="${rowCls}">
              <td>${escHtml(line.description || line.lineType)}</td>
              <td>${line.quantity}</td>
              <td>${escHtml(formatInvoiceGbp(line.unitAmount))}</td>
              <td>${escHtml(formatInvoiceGbp(line.lineTotal))}</td>
              <td>${jobId ? `<code>${escHtml(jobId.slice(0, 8))}…</code>` : "—"}</td>
              <td>${jobId ? `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-invoice-open-job="${escAttr(jobId)}">Job</button>` : "—"}</td>
            </tr>`;
          })
          .join("");

  const ledgerRows =
    ledgerJobs.length === 0
      ? `<tr><td colspan="7" class="admin-note">No completed jobs in this period.</td></tr>`
      : ledgerJobs
          .map((job) => {
            const ledgerAmt = computeJobLedgerAmountGbp({
              shiftFee: job.shiftFee,
              guestlistFee: job.guestlistFee,
              guestsEntered: job.guestsEntered,
              guestsCount: job.guestsCount,
              maleCount: job.maleCount,
              femaleCount: job.femaleCount,
            });
            const headcount = billingHeadcount({
              guestsEntered: job.guestsEntered,
              guestsCount: job.guestsCount,
              maleCount: job.maleCount,
              femaleCount: job.femaleCount,
            });
            const submitted = lineByJob.get(job.id);
            const totalDiff = lineHasDiff(job.id, "line_total", diffLines);
            const qtyDiff = lineHasDiff(job.id, "guest_count", diffLines);
            const bonusWarn = diffLines.some(
              (d) => d.promoterJobId === job.id && d.field === "bonus_valid",
            );
            const rowCls =
              totalDiff || qtyDiff
                ? "admin-invoice-diff-row--bad"
                : bonusWarn
                  ? "admin-invoice-diff-row--warn"
                  : "";
            return `<tr class="${rowCls}">
              <td>${escHtml(job.jobDate)}</td>
              <td>${escHtml(jobTypeLabel(job.jobType))}</td>
              <td>${escHtml(job.clubSlug || "—")}</td>
              <td>${headcount}</td>
              <td>${job.bonusValid ? "yes" : `<span class="admin-invoice-bonus-blocked">no</span>`}</td>
              <td>${escHtml(formatInvoiceGbp(ledgerAmt))}</td>
              <td>${submitted ? escHtml(formatInvoiceGbp(submitted.lineTotal)) : `<span class="admin-invoice-missing">—</span>`}</td>
            </tr>`;
          })
          .join("");

  const totalsMismatch =
    inv.verificationStatus === "mismatch" ||
    (inv.ledgerTotalGbp > 0 &&
      Math.abs(inv.ledgerTotalGbp - (inv.submittedTotalGbp || inv.subtotal)) > 0.01);

  return `<div class="admin-invoices-detail">
    <div class="admin-invoices-detail__header">
      <h4>${escHtml(`${inv.periodStart.slice(0, 10)} – ${inv.periodEnd.slice(0, 10)}`)}</h4>
      ${renderInvoiceVerificationBadge(inv.verificationStatus)}
      ${renderStatusBadge(inv.status)}
    </div>
    <div class="admin-invoices-detail__totals${totalsMismatch ? " admin-invoices-detail__totals--mismatch" : ""}">
      <div><span class="admin-invoices-detail__label">Submitted</span><strong>${escHtml(formatInvoiceGbp(inv.submittedTotalGbp || inv.subtotal))}</strong></div>
      <div><span class="admin-invoices-detail__label">Ledger (jobs)</span><strong>${escHtml(formatInvoiceGbp(inv.ledgerTotalGbp))}</strong></div>
      <div><span class="admin-invoices-detail__label">Invoice total</span><strong>${escHtml(formatInvoiceGbp(inv.total))}</strong></div>
    </div>
    <div class="admin-actions full">
      <button type="button" class="cc-btn cc-btn--gold" data-invoice-verify="${escAttr(inv.id)}">Verify against ledger</button>
      <button type="button" class="cc-btn cc-btn--ghost" data-invoice-manual-ok="${escAttr(inv.id)}">Approve mismatch</button>
      <button type="button" class="cc-btn cc-btn--ghost" data-invoice-regenerate="${escAttr(inv.id)}">Regenerate from ledger</button>
      <button type="button" class="cc-btn cc-btn--ghost" data-invoice-pdf data-invoice-id="${escAttr(inv.id)}">PDF</button>
      <button type="button" class="cc-btn cc-btn--ghost" data-invoice-email data-invoice-id="${escAttr(inv.id)}">Email</button>
    </div>
    <div class="admin-invoices-split full">
      <section class="admin-invoices-split__pane">
        <h5>Submitted lines</h5>
        <div class="promoter-table-wrap">
          <table class="admin-table admin-table--compact">
            <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th><th>Job</th><th></th></tr></thead>
            <tbody>${submittedRows}</tbody>
          </table>
        </div>
      </section>
      <section class="admin-invoices-split__pane">
        <h5>Ledger (completed jobs)</h5>
        <div class="promoter-table-wrap">
          <table class="admin-table admin-table--compact">
            <thead><tr><th>Date</th><th>Type</th><th>Club</th><th>Guests</th><th>Bonus OK</th><th>Ledger £</th><th>Invoiced £</th></tr></thead>
            <tbody>${ledgerRows}</tbody>
          </table>
        </div>
      </section>
    </div>
    ${
      diffLines.length
        ? `<section class="full admin-invoices-diffs">
            <h5>Verification differences</h5>
            <div class="promoter-table-wrap">
              <table class="admin-table admin-table--compact">
                <thead><tr><th>Date</th><th>Field</th><th>Expected</th><th>Actual</th><th>Status</th><th></th></tr></thead>
                <tbody>${renderVerificationDiffRows(diffLines)}</tbody>
              </table>
            </div>
          </section>`
        : ""
    }
    <hr class="full" style="margin:1.25rem 0;border:none;border-top:1px solid var(--portal-border)" />
    ${generateBlock}
  </div>`;
}
