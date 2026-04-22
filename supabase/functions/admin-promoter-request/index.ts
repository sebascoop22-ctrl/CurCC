/**
 * Supabase Edge Function: admin-promoter-request
 * Deploy: supabase functions deploy admin-promoter-request --no-verify-jwt
 *
 * Approve (create auth user + promoter row + emails) or deny (update row + email).
 * Requires Authorization: Bearer <user JWT> for an admin profile.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Validates the access token via GoTrue (supports ES256); avoid `auth.getUser()` which can throw on ES256 in older supabase-js. */
async function userIdFromAccessToken(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
): Promise<string | null> {
  const base = supabaseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
  });
  if (!res.ok) return null;
  try {
    const body = (await res.json()) as { id?: string };
    return typeof body.id === "string" ? body.id : null;
  } catch {
    return null;
  }
}

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

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint8Array(18);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => chars[b % chars.length]).join("");
}

async function sendResend(to: string[], subject: string, text: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM") ?? "Cooper Concierge <onboarding@resend.dev>";
  if (!key) {
    console.warn("admin-promoter-request: RESEND_API_KEY not set; skipping email");
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
    console.error("Resend error:", r.status, await r.text());
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
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anonKey || !serviceKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const accessToken = authHeader.slice("Bearer ".length).trim();
  const userId = await userIdFromAccessToken(url, anonKey, accessToken);
  if (!userId) {
    return json({ error: "Unauthorized" }, 401);
  }

  const adminDb = createClient(url, serviceKey);
  const { data: prof, error: profErr } = await adminDb
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profErr || !prof || String(prof.role) !== "admin") {
    return json({ error: "Forbidden" }, 403);
  }

  let payload: { requestId?: string; action?: string; denialReason?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const requestId = payload.requestId?.trim();
  const action = payload.action?.trim();
  if (!requestId || (action !== "approve" && action !== "deny")) {
    return json({ error: "requestId and action (approve|deny) required" }, 400);
  }

  const { data: reqRow, error: loadErr } = await adminDb
    .from("promoter_signup_requests")
    .select("id,full_name,email,status")
    .eq("id", requestId)
    .maybeSingle();
  if (loadErr) {
    return json({ error: loadErr.message }, 500);
  }
  if (!reqRow || String(reqRow.status) !== "pending") {
    return json({ error: "Request not found or already processed" }, 400);
  }

  const fullName = String(reqRow.full_name ?? "").trim();
  const email = String(reqRow.email ?? "").trim().toLowerCase();
  const site = Deno.env.get("SITE_URL") ?? "https://www.cooperconcierge.co.uk";
  const portalPath = Deno.env.get("PROMOTER_PORTAL_PATH") ?? "/portal";

  if (action === "deny") {
    const reason = (payload.denialReason ?? "").trim();
    const { error: upErr } = await adminDb
      .from("promoter_signup_requests")
      .update({
        status: "denied",
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
        denial_reason: reason || null,
      })
      .eq("id", requestId);
    if (upErr) {
      return json({ error: upErr.message }, 500);
    }
    await sendResend(
      [email],
      "Update on your Cooper Concierge promoter request",
      `Hi ${fullName},\n\nThank you for your interest in joining Cooper Concierge as a promoter. Unfortunately we are not able to approve your request at this time.${reason ? `\n\nNote: ${reason}` : ""}\n\nIf you have questions, please reply to this thread or contact us through our website.\n\n— Cooper Concierge\n${site}`,
    );
    return json({ ok: true });
  }

  const password = randomPassword();
  const { data: created, error: createErr } = await adminDb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: fullName || email, role: "promoter" },
  });
  if (createErr) {
    const msg = createErr.message ?? "createUser failed";
    if (/already|registered|exists/i.test(msg)) {
      return json(
        {
          error:
            "An account with this email already exists. Remove the duplicate in Auth or use a different email.",
        },
        400,
      );
    }
    return json({ error: msg }, 400);
  }
  const newUserId = created.user?.id;
  if (!newUserId) {
    return json({ error: "User creation returned no id" }, 500);
  }

  const displayName = fullName || email;
  const { error: pErr } = await adminDb.from("profiles").upsert(
    {
      id: newUserId,
      role: "promoter",
      display_name: displayName,
    },
    { onConflict: "id" },
  );
  if (pErr) {
    return json({ error: `profiles: ${pErr.message}` }, 500);
  }

  const { error: prErr } = await adminDb.from("promoters").upsert(
    {
      user_id: newUserId,
      display_name: displayName,
      bio: "",
      profile_image_url: "",
      approval_status: "approved",
      is_approved: true,
    },
    { onConflict: "user_id" },
  );
  if (prErr) {
    return json({ error: `promoters: ${prErr.message}` }, 500);
  }

  const { error: finErr } = await adminDb
    .from("promoter_signup_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      auth_user_id: newUserId,
    })
    .eq("id", requestId);
  if (finErr) {
    return json({ error: finErr.message }, 500);
  }

  const loginUrl = `${site.replace(/\/$/, "")}${portalPath.startsWith("/") ? "" : "/"}${portalPath}`;
  await sendResend(
    [email],
    "Your Cooper Concierge promoter access is approved",
    `Hi ${displayName},\n\nGreat news — your promoter access request has been approved.\n\nYou can sign in to the promoter portal with:\n  Email: ${email}\n  Password: ${password}\n\nPortal: ${loginUrl}\n\nPlease sign in and complete your profile. For security, consider changing your password after first login if the site offers that option.\n\n— Cooper Concierge\n${site}`,
  );

  return json({ ok: true });
});
