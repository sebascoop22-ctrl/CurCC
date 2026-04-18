/**
 * Supabase Edge Function: notify-promoter-request
 * Deploy: supabase functions deploy notify-promoter-request --no-verify-jwt
 *
 * Sends confirmation to applicant + alert to admin after a row is inserted in promoter_signup_requests.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

async function sendResend(to: string[], subject: string, text: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM") ?? "Cooper Concierge <onboarding@resend.dev>";
  if (!key) {
    console.warn("notify-promoter-request: RESEND_API_KEY not set; skipping email");
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!r.ok) {
    const err = await r.text();
    console.error("Resend error:", r.status, err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: { requestId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const requestId = body.requestId?.trim();
  if (!requestId) {
    return json({ error: "requestId required" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const admin = createClient(url, serviceKey);
  const { data: row, error } = await admin
    .from("promoter_signup_requests")
    .select("id,full_name,email,status,created_at")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    return json({ error: error.message }, 500);
  }
  if (!row || String(row.status) !== "pending") {
    return json({ error: "Request not found or not pending" }, 404);
  }

  const fullName = String(row.full_name ?? "");
  const email = String(row.email ?? "").toLowerCase();
  const site = Deno.env.get("SITE_URL") ?? "https://www.cooperconcierge.co.uk";
  const adminEmail = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "admin@cooperconcierge.co.uk";

  await sendResend(
    [email],
    "We received your promoter access request",
    `Hi ${fullName},\n\nThank you for requesting promoter access with Cooper Concierge. We have received your request and will review it shortly.\n\nYou do not need to reply to this message.\n\n— Cooper Concierge\n${site}`,
  );

  await sendResend(
    [adminEmail],
    `Promoter access request: ${fullName}`,
    `A new promoter access request was submitted.\n\nName: ${fullName}\nEmail: ${email}\nRequest ID: ${requestId}\n\nReview requests in the admin panel under Promoters → Requests.`,
  );

  return json({ ok: true });
});
