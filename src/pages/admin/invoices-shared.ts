import { escAttr, escHtml } from "../../portal/html";
import { renderStatusBadge } from "../../portal/badge";
import type { InvoiceVerificationLineDiff, PromoterInvoice } from "../../types";

export function formatInvoiceGbp(n: number): string {
  return `£${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

export function invoiceVerificationLabel(status: PromoterInvoice["verificationStatus"]): string {
  switch (status) {
    case "matched":
      return "Matched";
    case "mismatch":
      return "Mismatch";
    case "manual_ok":
      return "Manual OK";
    default:
      return "Pending";
  }
}

export function invoiceVerificationBadgeClass(
  status: PromoterInvoice["verificationStatus"],
): string {
  switch (status) {
    case "matched":
      return "pp-badge--success";
    case "mismatch":
      return "pp-badge--danger";
    case "manual_ok":
      return "pp-badge--info";
    default:
      return "pp-badge--muted";
  }
}

export function renderInvoiceVerificationBadge(
  status: PromoterInvoice["verificationStatus"],
): string {
  const label = invoiceVerificationLabel(status);
  const cls = invoiceVerificationBadgeClass(status);
  return `<span class="pp-badge ${cls}"><span class="pp-badge__dot"></span><span class="pp-badge__text">${escHtml(label)}</span></span>`;
}

export function diffFieldLabel(field: string): string {
  switch (field) {
    case "line_total":
      return "Line total";
    case "guest_count":
      return "Guest count";
    case "bonus_valid":
      return "Bonus valid";
    case "missing_invoice_line":
      return "Missing on invoice";
    case "orphan_invoice_line":
      return "Orphan invoice line";
    default:
      return field.replace(/_/g, " ");
  }
}

export function renderVerificationDiffRows(lines: InvoiceVerificationLineDiff[]): string {
  if (!lines.length) {
    return `<tr><td colspan="6" class="admin-note">No line-level differences.</td></tr>`;
  }
  return lines
    .map((d) => {
      const rowClass =
        d.status === "warning"
          ? "admin-invoice-diff-row--warn"
          : d.status === "mismatch"
            ? "admin-invoice-diff-row--bad"
            : "";
      const fmt = (field: string, v: number | null) => {
        if (v == null) return "—";
        if (field === "guest_count") return String(Math.round(v));
        return formatInvoiceGbp(v);
      };
      const expected = fmt(d.field, d.expected);
      const actual = fmt(d.field, d.actual);
      return `<tr class="${rowClass}">
        <td>${d.jobDate ? escHtml(d.jobDate) : "—"}</td>
        <td>${escHtml(diffFieldLabel(d.field))}</td>
        <td>${expected}</td>
        <td>${actual}</td>
        <td>${renderStatusBadge(d.status === "warning" ? "warning" : d.status === "matched" ? "approved" : "rejected")}</td>
        <td>${
          d.promoterJobId
            ? `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-invoice-open-job="${escAttr(d.promoterJobId)}">Job</button>`
            : "—"
        }</td>
      </tr>`;
    })
    .join("");
}

export function lineHasDiff(
  jobId: string | null,
  field: "line_total" | "guest_count",
  lines: InvoiceVerificationLineDiff[],
): boolean {
  if (!jobId) return false;
  return lines.some((d) => d.promoterJobId === jobId && d.field === field && d.status === "mismatch");
}
