import type { SupabaseClient } from "@supabase/supabase-js";
import { generateInvoiceForPromoter } from "../../admin/promoters";
import {
  setPromoterInvoiceVerificationManualOk,
  verifyPromoterInvoiceAgainstJobs,
  type PromoterInvoiceAdminRow,
} from "../../admin/invoices";
import type { InvoiceVerificationLineDiff } from "../../types";
import type { InvoicesLedgerFilters } from "./invoices-ledger";

export type InvoicesBindCtx = {
  adminRoot: HTMLElement;
  supabase: SupabaseClient;
  getSelectedInvoiceId: () => string | null;
  setSelectedInvoiceId: (id: string | null) => void;
  getFilters: () => InvoicesLedgerFilters;
  setFilters: (f: InvoicesLedgerFilters) => void;
  getInvoices: () => PromoterInvoiceAdminRow[];
  setDiffLines: (lines: InvoiceVerificationLineDiff[]) => void;
  reloadInvoices: () => Promise<void>;
  reloadPromoters: () => Promise<void>;
  flash: (msg: string, kind?: "ok" | "error") => void;
  renderDashboard: () => void;
  openJobsView: (jobId: string) => void;
  getView: () => string;
};

function readFiltersFromDom(adminRoot: HTMLElement): InvoicesLedgerFilters {
  const form = adminRoot.querySelector("#invoices-filter-form") as HTMLFormElement | null;
  const fd = form ? new FormData(form) : null;
  return {
    promoterId: String(fd?.get("promoterId") ?? "").trim(),
  };
}

export function bindInvoicesLedgerEvents(ctx: InvoicesBindCtx): void {
  const { adminRoot } = ctx;

  adminRoot.querySelector("#invoices-filter-form")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    ctx.setFilters(readFiltersFromDom(adminRoot));
    void ctx.reloadInvoices().then(() => ctx.renderDashboard());
  });

  adminRoot.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement | null;
    if (!t || ctx.getView() !== "invoices") return;

    const jobBtn = t.closest("button[data-invoice-open-job]") as HTMLButtonElement | null;
    if (jobBtn) {
      const jobId = jobBtn.dataset.invoiceOpenJob?.trim();
      if (jobId) ctx.openJobsView(jobId);
      return;
    }

    const verifyBtn = t.closest("button[data-invoice-verify]") as HTMLButtonElement | null;
    if (verifyBtn) {
      const invoiceId = verifyBtn.dataset.invoiceVerify?.trim();
      if (!invoiceId) return;
      void (async () => {
        const res = await verifyPromoterInvoiceAgainstJobs(ctx.supabase, invoiceId);
        if (!res.ok) {
          ctx.flash(res.message, "error");
          return;
        }
        ctx.setDiffLines(res.result.lines);
        await ctx.reloadInvoices();
        ctx.flash(
          res.result.status === "matched"
            ? "Invoice matches the job ledger."
            : `Verification: ${res.result.status} (ledger ${res.result.ledgerTotalGbp.toFixed(2)} vs submitted ${res.result.submittedTotalGbp.toFixed(2)}).`,
        );
        ctx.renderDashboard();
      })();
      return;
    }

    const manualBtn = t.closest("button[data-invoice-manual-ok]") as HTMLButtonElement | null;
    if (manualBtn) {
      const invoiceId = manualBtn.dataset.invoiceManualOk?.trim();
      if (!invoiceId) return;
      const notes = window.prompt("Optional note for manual approval:") ?? "";
      void (async () => {
        const res = await setPromoterInvoiceVerificationManualOk(ctx.supabase, invoiceId, notes);
        if (!res.ok) {
          ctx.flash(res.message, "error");
          return;
        }
        await ctx.reloadInvoices();
        ctx.flash("Invoice marked manual OK.");
        ctx.renderDashboard();
      })();
      return;
    }

    const regenBtn = t.closest("button[data-invoice-regenerate]") as HTMLButtonElement | null;
    if (regenBtn) {
      const invoiceId = regenBtn.dataset.invoiceRegenerate?.trim();
      if (!invoiceId) return;
      const inv = ctx.getInvoices().find((i) => i.id === invoiceId);
      if (!inv) {
        ctx.flash("Invoice not found.", "error");
        return;
      }
      if (
        !window.confirm(
          `Regenerate invoice for ${inv.periodStart} – ${inv.periodEnd}? This runs generate_promoter_invoice for the same period.`,
        )
      ) {
        return;
      }
      void (async () => {
        const res = await generateInvoiceForPromoter(
          ctx.supabase,
          inv.promoterId,
          inv.periodStart,
          inv.periodEnd,
        );
        if (!res.ok) {
          ctx.flash(res.message, "error");
          return;
        }
        ctx.setSelectedInvoiceId(res.invoiceId);
        await ctx.reloadInvoices();
        const verify = await verifyPromoterInvoiceAgainstJobs(ctx.supabase, res.invoiceId);
        if (verify.ok) ctx.setDiffLines(verify.result.lines);
        ctx.flash("Invoice regenerated from ledger jobs.");
        ctx.renderDashboard();
      })();
    }
  });
}

export { readFiltersFromDom as readInvoicesFiltersFromDom };
