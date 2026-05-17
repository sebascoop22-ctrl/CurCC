import type { SupabaseClient } from "@supabase/supabase-js";
import { mapPromoterJobRow, PROMOTER_JOB_SELECT } from "../lib/financial/promoter-job-row";
import type {
  InvoiceVerificationLineDiff,
  InvoiceVerificationResult,
  PromoterInvoice,
  PromoterJob,
} from "../types";

type Raw = Record<string, unknown>;

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseVerificationStatus(v: unknown): PromoterInvoice["verificationStatus"] {
  const x = String(v ?? "pending").trim().toLowerCase();
  if (x === "matched" || x === "mismatch" || x === "manual_ok" || x === "pending") return x;
  return "pending";
}

function mapInvoiceRow(raw: Raw): PromoterInvoice {
  return {
    id: String(raw.id ?? ""),
    promoterId: String(raw.promoter_id ?? ""),
    periodStart: String(raw.period_start ?? "").slice(0, 10),
    periodEnd: String(raw.period_end ?? "").slice(0, 10),
    status: String(raw.status ?? "draft") as PromoterInvoice["status"],
    subtotal: asNumber(raw.subtotal),
    adjustments: asNumber(raw.adjustments),
    total: asNumber(raw.total),
    sentAt: raw.sent_at != null ? String(raw.sent_at) : null,
    sentToEmail: String(raw.sent_to_email ?? ""),
    emailedVia: String(raw.emailed_via ?? ""),
    verificationStatus: parseVerificationStatus(raw.verification_status),
    verificationDetails:
      raw.verification_details && typeof raw.verification_details === "object"
        ? (raw.verification_details as Record<string, unknown>)
        : {},
    ledgerTotalGbp: asNumber(raw.ledger_total_gbp),
    submittedTotalGbp: asNumber(raw.submitted_total_gbp),
  };
}

const PROMOTER_INVOICE_SELECT =
  "id,promoter_id,period_start,period_end,status,subtotal,adjustments,total,sent_at,sent_to_email,emailed_via,verification_status,verification_details,ledger_total_gbp,submitted_total_gbp";

export async function loadPromoterInvoicesDetailed(
  supabase: SupabaseClient,
  promoterId: string,
): Promise<{ ok: true; rows: PromoterInvoice[] } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("promoter_invoices")
    .select(PROMOTER_INVOICE_SELECT)
    .eq("promoter_id", promoterId)
    .order("period_end", { ascending: false });
  if (error) return { ok: false, message: error.message };
  return { ok: true, rows: (data ?? []).map((raw) => mapInvoiceRow(raw as Raw)) };
}

export function parseInvoiceVerificationLineDiffs(raw: unknown): InvoiceVerificationLineDiff[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const r = item as Raw;
    const st = String(r.status ?? "mismatch");
    const status: InvoiceVerificationLineDiff["status"] =
      st === "matched" || st === "warning" ? st : "mismatch";
    return {
      promoterJobId: r.promoter_job_id != null ? String(r.promoter_job_id) : null,
      jobDate: r.job_date != null ? String(r.job_date).slice(0, 10) : null,
      field: String(r.field ?? ""),
      expected: r.expected != null ? asNumber(r.expected) : null,
      actual: r.actual != null ? asNumber(r.actual) : null,
      status,
    };
  });
}

export async function verifyPromoterInvoiceAgainstJobs(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<{ ok: true; result: InvoiceVerificationResult } | { ok: false; message: string }> {
  const id = invoiceId.trim();
  if (!id) return { ok: false, message: "Invoice id is required." };
  const { data, error } = await supabase.rpc("verify_invoice_against_jobs", {
    p_invoice_id: id,
  });
  if (error) return { ok: false, message: error.message };
  const raw = data as Raw | null;
  if (!raw || raw.ok !== true) {
    return {
      ok: false,
      message: typeof raw?.error === "string" ? raw.error : "Verification failed.",
    };
  }
  const details = raw.verification_details as Raw | undefined;
  const lines = parseInvoiceVerificationLineDiffs(raw.lines ?? (details?.lines as unknown));
  return {
    ok: true,
    result: {
      invoiceId: String(raw.invoice_id ?? id),
      status: parseVerificationStatus(raw.status),
      ledgerTotalGbp: asNumber(raw.ledger_total_gbp),
      submittedTotalGbp: asNumber(raw.submitted_total_gbp),
      lines,
    },
  };
}

export type PromoterInvoiceLine = {
  id: string;
  invoiceId: string;
  promoterJobId: string | null;
  lineType: string;
  description: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
};

export type PromoterInvoiceAdminRow = PromoterInvoice & {
  promoterDisplayName: string;
};

function mapInvoiceLineRow(raw: Raw): PromoterInvoiceLine {
  return {
    id: String(raw.id ?? ""),
    invoiceId: String(raw.invoice_id ?? ""),
    promoterJobId: raw.promoter_job_id != null ? String(raw.promoter_job_id) : null,
    lineType: String(raw.line_type ?? "job"),
    description: String(raw.description ?? ""),
    quantity: asNumber(raw.quantity),
    unitAmount: asNumber(raw.unit_amount),
    lineTotal: asNumber(raw.line_total),
  };
}

export async function loadAllInvoicesForAdmin(
  supabase: SupabaseClient,
  opts?: { promoterId?: string; limit?: number },
): Promise<{ ok: true; rows: PromoterInvoiceAdminRow[] } | { ok: false; message: string }> {
  let q = supabase
    .from("promoter_invoices")
    .select(PROMOTER_INVOICE_SELECT)
    .order("period_end", { ascending: false })
    .order("id", { ascending: false });
  const promoterId = opts?.promoterId?.trim();
  if (promoterId) q = q.eq("promoter_id", promoterId);
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 200));
  q = q.limit(limit);
  const { data, error } = await q;
  if (error) return { ok: false, message: error.message };
  const invoices = (data ?? []).map((raw) => mapInvoiceRow(raw as Raw));
  const promoterIds = [...new Set(invoices.map((i) => i.promoterId).filter(Boolean))];
  const nameById = new Map<string, string>();
  if (promoterIds.length) {
    const { data: promoters, error: pErr } = await supabase
      .from("promoters")
      .select("id,display_name,user_id")
      .in("id", promoterIds);
    if (pErr) return { ok: false, message: pErr.message };
    for (const p of promoters ?? []) {
      const r = p as Raw;
      const id = String(r.id ?? "");
      nameById.set(id, String(r.display_name ?? r.user_id ?? id).trim() || id);
    }
  }
  const rows: PromoterInvoiceAdminRow[] = invoices.map((inv) => ({
    ...inv,
    promoterDisplayName: nameById.get(inv.promoterId) ?? inv.promoterId.slice(0, 8),
  }));
  return { ok: true, rows };
}

export async function loadPromoterInvoiceLines(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<{ ok: true; rows: PromoterInvoiceLine[] } | { ok: false; message: string }> {
  const id = invoiceId.trim();
  if (!id) return { ok: false, message: "Invoice id is required." };
  const { data, error } = await supabase
    .from("promoter_invoice_lines")
    .select("id,invoice_id,promoter_job_id,line_type,description,quantity,unit_amount,line_total")
    .eq("invoice_id", id)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, message: error.message };
  return { ok: true, rows: (data ?? []).map((raw) => mapInvoiceLineRow(raw as Raw)) };
}

export async function loadInvoicePeriodJobs(
  supabase: SupabaseClient,
  promoterId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ ok: true; rows: PromoterJob[] } | { ok: false; message: string }> {
  const pid = promoterId.trim();
  const from = periodStart.slice(0, 10);
  const to = periodEnd.slice(0, 10);
  if (!pid || !from || !to) return { ok: false, message: "Promoter and period are required." };
  const { data, error } = await supabase
    .from("promoter_jobs")
    .select(PROMOTER_JOB_SELECT)
    .eq("promoter_id", pid)
    .eq("status", "completed")
    .gte("job_date", from)
    .lte("job_date", to)
    .order("job_date", { ascending: true })
    .order("id", { ascending: true });
  if (error) return { ok: false, message: error.message };
  return { ok: true, rows: (data ?? []).map((raw) => mapPromoterJobRow(raw as Raw)) };
}

export async function setPromoterInvoiceVerificationManualOk(
  supabase: SupabaseClient,
  invoiceId: string,
  notes?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = invoiceId.trim();
  if (!id) return { ok: false, message: "Invoice id is required." };
  const { error } = await supabase
    .from("promoter_invoices")
    .update({
      verification_status: "manual_ok",
      verification_details: {
        manual_ok_at: new Date().toISOString(),
        notes: (notes ?? "").trim(),
      },
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
