import { siteConfig } from "./site-config";

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
    lines.push(`${k}: ${String(v)}`);
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

  const accessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY?.trim();
  if (!accessKey) {
    console.warn(
      "[Cooper Concierge] VITE_WEB3FORMS_ACCESS_KEY is not set; inquiry not emailed.",
    );
    return { ok: true, simulated: true };
  }

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
    if (data.success) return { ok: true };
    return {
      ok: false,
      error:
        typeof data.message === "string"
          ? data.message
          : "Could not send your message. Please try again or use WhatsApp.",
    };
  } catch {
    return {
      ok: false,
      error: "Network error. Check your connection and try again.",
    };
  }
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
