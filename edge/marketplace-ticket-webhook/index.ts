/**
 * Phase 10 placeholder: external marketplace ticket webhook.
 * Deploy: supabase functions deploy marketplace-ticket-webhook --no-verify-jwt
 *
 * Expects future HMAC/signature verification. Until marketplace design is final,
 * returns 501 with guidance — do not insert rows without auth.
 */
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-marketplace-signature",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "POST only" }, 405);
  }

  const secret = Deno.env.get("MARKETPLACE_WEBHOOK_SECRET");
  if (!secret) {
    return json(
      {
        ok: false,
        error: "not_configured",
        message:
          "Set MARKETPLACE_WEBHOOK_SECRET and implement signature verification before enabling ticket sync.",
      },
      501,
    );
  }

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  return json(
    {
      ok: false,
      error: "not_implemented",
      message:
        "Webhook stub only. Insert into external_ticket_sales after marketplace contract is signed.",
      received: body,
    },
    501,
  );
});
