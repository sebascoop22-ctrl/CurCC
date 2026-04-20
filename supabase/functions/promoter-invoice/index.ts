/**
 * Supabase Edge Function: promoter-invoice
 * Deploy: supabase functions deploy promoter-invoice --no-verify-jwt
 *
 * POST JSON: { invoiceId: string, action: "pdf" | "send" }
 * Header: Authorization: Bearer <user access JWT>
 *
 * - pdf: admin or owning promoter — returns { ok, pdfBase64, filename }
 * - send: admin only — emails PDF via Resend when INVOICE_EMAIL_PROVIDER=resend (default) and RESEND_API_KEY is set
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY (optional for pdf-only),
 * RESEND_FROM, INVOICE_EMAIL_PROVIDER (resend | disabled), SITE_URL (optional)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

type LineRow = {
  description: string;
  quantity: number;
  unit_amount: number;
  line_total: number;
};

async function buildInvoicePdf(params: {
  invoiceRef: string;
  displayName: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  subtotal: number;
  adjustments: number;
  total: number;
  lines: LineRow[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 790;
  const lh = 14;
  const margin = 48;
  const draw = (text: string, size = 11, bold = false) => {
    if (y < 72) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
    page.drawText(text.length > 95 ? `${text.slice(0, 92)}…` : text, {
      x: margin,
      y,
      size,
      font: bold ? fontBold : font,
    });
    y -= lh;
  };

  draw("Cooper Concierge", 16, true);
  draw("Promoter earnings statement", 12, true);
  y -= 6;
  draw(`Payee: ${params.displayName}`);
  draw(`Period: ${params.periodStart} to ${params.periodEnd}`);
  draw(`Reference: ${params.invoiceRef}`);
  draw(`Status: ${params.status}`);
  y -= 8;
  draw("Line items", 11, true);
  draw("—".repeat(62), 9);
  if (!params.lines.length) {
    draw("(No line rows for this invoice.)", 9);
  } else {
    for (const ln of params.lines) {
      const desc = ln.description.replace(/\s+/g, " ").trim() || "(no description)";
      draw(
        `${desc.slice(0, 56)} | qty ${ln.quantity} | £${ln.unit_amount.toFixed(2)} | £${ln.line_total.toFixed(2)}`,
        9,
      );
    }
  }
  y -= 8;
  draw(`Subtotal: £${params.subtotal.toFixed(2)}`);
  draw(`Adjustments: £${params.adjustments.toFixed(2)}`);
  draw(`Total due: £${params.total.toFixed(2)}`, 12, true);
  y -= 12;
  draw("Generated electronically. Questions: reply to this thread if emailed.", 8);
  return pdf.save();
}

async function sendResendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  pdfBytes: Uint8Array;
  filename: string;
}): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM") ?? "Cooper Concierge <onboarding@resend.dev>";
  if (!key) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      attachments: [
        {
          filename: opts.filename,
          content: uint8ToBase64(opts.pdfBytes),
        },
      ],
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Resend ${r.status}: ${err}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json({ error: "Missing Authorization bearer token." }, 401);
  }

  let body: { invoiceId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const invoiceId = body.invoiceId?.trim();
  const action = body.action?.trim();
  if (!invoiceId) {
    return json({ error: "invoiceId required" }, 400);
  }
  if (action !== "pdf" && action !== "send") {
    return json({ error: 'action must be "pdf" or "send"' }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    return json({ error: "Invalid or expired session." }, 401);
  }
  const uid = userData.user.id;

  const { data: inv, error: invErr } = await admin
    .from("promoter_invoices")
    .select(
      "id,promoter_id,period_start,period_end,status,subtotal,adjustments,total,sent_at,sent_to_email,emailed_via",
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (invErr || !inv) {
    return json({ error: "Invoice not found." }, 404);
  }

  const promoterId = String(inv.promoter_id ?? "");

  const { data: profile } = await admin.from("profiles").select("role").eq("id", uid).maybeSingle();
  const isAdmin = String(profile?.role ?? "") === "admin";

  const { data: promRow } = await admin
    .from("promoters")
    .select("id,display_name,user_id")
    .eq("user_id", uid)
    .maybeSingle();

  const isOwner = promRow?.id != null && String(promRow.id) === promoterId;

  if (!isAdmin && !isOwner) {
    return json({ error: "Forbidden." }, 403);
  }
  if (action === "send" && !isAdmin) {
    return json({ error: "Only admins can email invoices." }, 403);
  }

  const { data: promMeta } = await admin
    .from("promoters")
    .select("display_name,user_id")
    .eq("id", promoterId)
    .maybeSingle();

  const displayName = String(promMeta?.display_name ?? "").trim() || "Promoter";
  const promoterUserId = promMeta?.user_id != null ? String(promMeta.user_id) : "";

  const { data: linesRaw, error: linesErr } = await admin
    .from("promoter_invoice_lines")
    .select("description,quantity,unit_amount,line_total")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  if (linesErr) {
    return json({ error: linesErr.message }, 500);
  }

  const lines: LineRow[] = (linesRaw ?? []).map((r: Record<string, unknown>) => ({
    description: String(r.description ?? ""),
    quantity: Number(r.quantity ?? 1) || 1,
    unit_amount: Number(r.unit_amount ?? 0) || 0,
    line_total: Number(r.line_total ?? 0) || 0,
  }));

  const pdfBytes = await buildInvoicePdf({
    invoiceRef: invoiceId.replace(/-/g, "").slice(0, 12).toUpperCase(),
    displayName,
    periodStart: String(inv.period_start ?? "").slice(0, 10),
    periodEnd: String(inv.period_end ?? "").slice(0, 10),
    status: String(inv.status ?? "draft"),
    subtotal: Number(inv.subtotal ?? 0) || 0,
    adjustments: Number(inv.adjustments ?? 0) || 0,
    total: Number(inv.total ?? 0) || 0,
    lines,
  });

  const filename = `cooper-invoice-${String(inv.period_start ?? "").slice(0, 10)}-${String(inv.period_end ?? "").slice(0, 10)}.pdf`;

  if (action === "pdf") {
    return json({
      ok: true,
      action: "pdf",
      pdfBase64: uint8ToBase64(pdfBytes),
      filename,
    });
  }

  const provider = (Deno.env.get("INVOICE_EMAIL_PROVIDER") ?? "resend").toLowerCase().trim();
  if (provider === "disabled") {
    return json(
      {
        error:
          "Email sending is disabled (INVOICE_EMAIL_PROVIDER=disabled). Use PDF download or change provider.",
      },
      503,
    );
  }
  if (provider !== "resend") {
    return json(
      { error: `Unknown INVOICE_EMAIL_PROVIDER "${provider}". Use "resend" or "disabled".` },
      400,
    );
  }

  if (!promoterUserId) {
    return json({ error: "Promoter has no linked auth user; cannot resolve email." }, 400);
  }

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(promoterUserId);
  if (authErr || !authUser?.user?.email) {
    return json({ error: "Could not read promoter email from auth." }, 400);
  }
  const toEmail = String(authUser.user.email).toLowerCase().trim();
  const site = Deno.env.get("SITE_URL") ?? "https://www.cooperconcierge.co.uk";

  try {
    await sendResendEmail({
      to: toEmail,
      subject: `Cooper Concierge — earnings statement (${String(inv.period_start ?? "").slice(0, 10)} to ${String(inv.period_end ?? "").slice(0, 10)})`,
      text:
        `Hi ${displayName},\n\nPlease find your Cooper Concierge earnings statement attached as a PDF for the period ${String(inv.period_start ?? "").slice(0, 10)} to ${String(inv.period_end ?? "").slice(0, 10)}.\n\nTotal shown on the statement: £${(Number(inv.total ?? 0) || 0).toFixed(2)}.\n\n— Cooper Concierge\n${site}`,
      pdfBytes,
      filename,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email send failed.";
    return json({ error: msg }, 502);
  }

  const nowIso = new Date().toISOString();
  const { error: upErr } = await admin
    .from("promoter_invoices")
    .update({
      sent_at: nowIso,
      sent_to_email: toEmail,
      emailed_via: "resend",
    })
    .eq("id", invoiceId);

  if (upErr) {
    return json({ error: `Email sent but DB update failed: ${upErr.message}` }, 500);
  }

  return json({ ok: true, action: "send", emailedTo: toEmail });
});
