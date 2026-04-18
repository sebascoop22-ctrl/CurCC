/** Calls Supabase Edge Functions for promoter onboarding emails + admin decisions. */

function readEnv(name: string): string {
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function supabaseFunctionsBaseUrl(): string | null {
  const url = readEnv("VITE_SUPABASE_URL").replace(/\/$/, "");
  if (!url) return null;
  return `${url}/functions/v1`;
}

/** Fire-and-forget notification emails after a row is inserted (requires deployed function + Resend). */
export async function notifyPromoterRequestSubmitted(
  anonKey: string,
  requestId: string,
): Promise<{ ok: boolean; status: number }> {
  const base = supabaseFunctionsBaseUrl();
  if (!base) return { ok: false, status: 0 };
  try {
    const res = await fetch(`${base}/notify-promoter-request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ requestId }),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type AdminPromoterRequestAction = "approve" | "deny";

export async function adminPromoterRequestDecision(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
  body: {
    requestId: string;
    action: AdminPromoterRequestAction;
    denialReason?: string;
  },
): Promise<{ ok: true } | { ok: false; message: string; status?: number }> {
  const base = supabaseUrl.replace(/\/$/, "") + "/functions/v1";
  let res: Response;
  try {
    res = await fetch(`${base}/admin-promoter-request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Network error",
    };
  }
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      message: json.message || json.error || res.statusText || "Request failed",
      status: res.status,
    };
  }
  return { ok: true };
}
