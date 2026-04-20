/** Calls Supabase Edge Function `promoter-invoice` for PDF download + Resend email. */

import { supabaseFunctionsBaseUrl } from "./promoter-request-edge";

export type PromoterInvoiceEdgeAction = "pdf" | "send";

export type PromoterInvoiceEdgeResult =
  | { ok: true; action: "pdf"; pdfBase64: string; filename: string }
  | { ok: true; action: "send"; emailedTo: string }
  | { ok: false; message: string; status: number };

export async function callPromoterInvoiceEdge(
  anonKey: string,
  accessToken: string,
  invoiceId: string,
  action: PromoterInvoiceEdgeAction,
): Promise<PromoterInvoiceEdgeResult> {
  const base = supabaseFunctionsBaseUrl();
  if (!base) {
    return { ok: false, message: "Supabase URL not configured.", status: 0 };
  }
  const id = invoiceId.trim();
  if (!id) {
    return { ok: false, message: "Missing invoice id.", status: 0 };
  }
  const token = accessToken.trim();
  if (!token) {
    return { ok: false, message: "Not signed in.", status: 401 };
  }
  let res: Response;
  try {
    res = await fetch(`${base}/promoter-invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ invoiceId: id, action }),
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Network error",
      status: 0,
    };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof json.error === "string"
        ? json.error
        : typeof json.message === "string"
          ? json.message
          : res.statusText || "Request failed";
    return { ok: false, message: msg, status: res.status };
  }
  if (json.ok !== true) {
    const msg = typeof json.error === "string" ? json.error : "Request failed.";
    return { ok: false, message: msg, status: res.status };
  }
  if (action === "pdf") {
    const pdfBase64 = typeof json.pdfBase64 === "string" ? json.pdfBase64 : "";
    const filename = typeof json.filename === "string" ? json.filename : "invoice.pdf";
    if (!pdfBase64) {
      return { ok: false, message: "Invalid PDF response.", status: 500 };
    }
    return { ok: true, action: "pdf", pdfBase64, filename };
  }
  const emailedTo = typeof json.emailedTo === "string" ? json.emailedTo : "";
  return { ok: true, action: "send", emailedTo };
}

export function downloadPdfFromBase64(base64: string, filename: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "invoice.pdf";
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}
