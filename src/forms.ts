import { siteConfig } from "./site-config";
import { getSupabaseClient } from "./lib/supabase";

const WEB3FORMS_URL = "https://api.web3forms.com/submit";

const FORM_LABELS: Record<string, string> = {
  home_lead: "Home — lead invite",
  general_enquiry: "General enquiry",
  nightlife_lead: "Nightlife lead",
  nightlife_private_table: "Nightlife — private table",
  nightlife_guestlist: "Nightlife — guestlist",
  fleet_request: "Chauffeuring — fleet request",
  security_consult: "Security — consultation",
};

function formatMessage(
  payload: Record<string, unknown>,
  formName: string,
): string {
  const lines: string[] = [`Form: ${FORM_LABELS[formName] ?? formName}`, ""];
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined || v === null || v === "") continue;
    const value =
      typeof v === "object" ? JSON.stringify(v) : String(v);
    lines.push(`${k}: ${value}`);
  }
  lines.push("", `— cooperconcierge.co.uk · ${formName}`);
  return lines.join("\n");
}

function resolveSenderEmail(payload: Record<string, unknown>): string {
  const raw = payload.email;
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s;
  return siteConfig.email;
}

function resolveSenderName(payload: Record<string, unknown>): string {
  const raw = payload.name ?? payload.fullName;
  const s = typeof raw === "string" ? raw.trim() : "";
  return s || "Website visitor";
}

export type SubmitInquiryResult = {
  ok: boolean;
  error?: string;
  simulated?: boolean;
};

type InquiryChannelResult = {
  attempted: boolean;
  ok: boolean;
  error?: string;
};

function compactString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function resolveClientKey(payload: Record<string, unknown>): string {
  const siteMail = siteConfig.email.trim().toLowerCase();
  const rawEmail = compactString(payload.email).toLowerCase();
  const email = rawEmail && rawEmail !== siteMail ? rawEmail : "";
  if (email) return `email:${email}`;
  const phoneDigits = compactString(payload.phone).replace(/\D/g, "");
  if (phoneDigits) return `phone:${phoneDigits}`;
  const ig = normalizeInstagramHandle(
    compactString(payload.instagram_handle ?? payload.instagram),
  );
  if (ig) return `instagram:${ig}`;
  const name = compactString(payload.name || payload.fullName).toLowerCase();
  if (name) return `name:${name}`;
  return "";
}

function resolveService(payload: Record<string, unknown>, formName: string): string {
  const direct = compactString(payload.serviceOfInterest || payload.service);
  if (direct) return direct.toLowerCase();
  if (formName.includes("nightlife")) return "nightlife";
  if (formName.includes("fleet") || formName.includes("chauff")) return "chauffeuring";
  if (formName.includes("security")) return "security";
  return "general";
}

function sanitizePayloadForJsonb(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
}

async function submitToSupabase(
  payload: Record<string, unknown>,
  formName: string,
): Promise<InquiryChannelResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { attempted: false, ok: false };

  const name = compactString(payload.name || payload.fullName);
  const email = compactString(payload.email).toLowerCase();
  const phone = compactString(payload.phone);
  const clientKey = resolveClientKey(payload);
  const guestsForRpc =
    formName === "nightlife_guestlist" && Array.isArray(payload.guestlistGuests)
      ? payload.guestlistGuests
      : [];

  const { data: enquiryId, error } = await supabase.rpc(
    "submit_website_enquiry",
    {
      p_form_name: formName,
      p_form_label: FORM_LABELS[formName] ?? formName,
      p_service: resolveService(payload, formName),
      p_client_key: clientKey,
      p_name: name,
      p_email: email,
      p_phone: phone,
      p_payload: sanitizePayloadForJsonb(payload),
      p_guests: guestsForRpc,
    },
  );

  if (error || !enquiryId) {
    return {
      attempted: true,
      ok: false,
      error: error?.message || "Could not save your enquiry right now.",
    };
  }
  return { attempted: true, ok: true };
}

/**
 * Sends the inquiry to enquiries@cooperconcierge.co.uk via Web3Forms.
 * Set VITE_WEB3FORMS_ACCESS_KEY in .env (create a key at web3forms.com for your domain).
 */
export async function submitInquiry(
  payload: Record<string, unknown>,
  formName: string,
): Promise<SubmitInquiryResult> {
  try {
    sessionStorage.setItem(
      `cc_last_${formName}`,
      JSON.stringify({ at: new Date().toISOString(), payload }),
    );
  } catch {
    /* ignore quota */
  }

  const supabaseResult = await submitToSupabase(payload, formName);

  const accessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY?.trim() || "";
  let emailResult: InquiryChannelResult = { attempted: false, ok: false };
  if (accessKey) {
    const name = resolveSenderName(payload);
    const email = resolveSenderEmail(payload);
    const message = formatMessage(payload, formName);
    const subject = `Cooper Concierge — ${FORM_LABELS[formName] ?? formName}`;
    try {
      const res = await fetch(WEB3FORMS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: accessKey,
          subject,
          name,
          email,
          message,
          from_name: name,
          replyto: email !== siteConfig.email ? email : undefined,
          botcheck: "",
        }),
      });
      const data = (await res.json()) as { success?: boolean; message?: string };
      emailResult = data.success
        ? { attempted: true, ok: true }
        : {
            attempted: true,
            ok: false,
            error:
              typeof data.message === "string"
                ? data.message
                : "Could not send your message. Please try again or use WhatsApp.",
          };
    } catch {
      emailResult = {
        attempted: true,
        ok: false,
        error: "Network error. Check your connection and try again.",
      };
    }
  } else {
    console.warn(
      "[Cooper Concierge] VITE_WEB3FORMS_ACCESS_KEY is not set; inquiry email fallback is disabled.",
    );
  }

  if (supabaseResult.ok || emailResult.ok) {
    return {
      ok: true,
      simulated: !supabaseResult.attempted && !emailResult.attempted,
    };
  }

  if (!supabaseResult.attempted && !emailResult.attempted) {
    return { ok: true, simulated: true };
  }

  return {
    ok: false,
    error:
      supabaseResult.error ||
      emailResult.error ||
      "Could not submit your enquiry. Please try again.",
  };
}

export function showFormSuccess(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.add("is-visible");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function hideFormError(el: HTMLElement | null): void {
  el?.classList.remove("is-visible");
}

export function showFormError(el: HTMLElement | null, message: string): void {
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-visible");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function validateEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Loose phone check: enough digits for a reachable number */
export function validatePhone(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 8;
}

export function normalizeInstagramHandle(v: string): string {
  return v.trim().replace(/^@+/u, "").toLowerCase();
}

/** Instagram username rules (simplified): letters, numbers, . and _ */
export function validateInstagramHandle(v: string): boolean {
  const h = normalizeInstagramHandle(v);
  return h.length >= 1 && h.length <= 30 && /^[a-z0-9._]+$/i.test(h);
}
