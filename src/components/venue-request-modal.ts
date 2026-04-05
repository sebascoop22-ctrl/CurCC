import type { Club } from "../types";
import { siteConfig } from "../site-config";
import {
  submitInquiry,
  validateEmail,
  validatePhone,
} from "../forms";
import "./venue-request-modal.css";

export type VenueRequestKind = "private_table" | "guestlist";

function formatGuestlistsSummary(club: Club): string {
  if (!club.guestlists?.length) return "";
  return club.guestlists
    .map((g) => {
      const days = g.days.length ? g.days.join(" · ") : "—";
      const rec = g.recurrence === "one_off" ? "One-off" : "Weekly";
      const note = g.notes ? ` — ${g.notes}` : "";
      return `${days} · ${rec}${note}`;
    })
    .join("\n");
}

function formatGuestlistsForPayload(club: Club): string {
  if (!club.guestlists?.length) return "—";
  return club.guestlists
    .map((g) => {
      const days = g.days.join(", ") || "—";
      const rec = g.recurrence === "one_off" ? "one-off" : "weekly";
      return `${days} (${rec})${g.notes ? ` — ${g.notes}` : ""}`;
    })
    .join(" | ");
}

type NotifyMethod = "email" | "phone" | "instagram_dm" | "tiktok_dm";

/**
 * Opens a modal on `host` (e.g. #cc-venue-request-root). Does not navigate away.
 */
export function openVenueRequestModal(opts: {
  host: HTMLElement | null;
  kind: VenueRequestKind;
  club: Club;
}): void {
  const { host, kind, club } = opts;
  if (!host) return;

  host.querySelectorAll(".venue-request-overlay").forEach((el) => el.remove());

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay venue-request-overlay is-open";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "venue-request-title");

  const modal = document.createElement("div");
  modal.className = "modal modal--venue-request";
  modal.addEventListener("click", (e) => e.stopPropagation());

  const title =
    kind === "private_table" ? "Book private table" : "Join the guestlist";
  const formName =
    kind === "private_table"
      ? "nightlife_private_table"
      : "nightlife_guestlist";

  const scheduleText = formatGuestlistsSummary(club);
  const scheduleBlock =
    kind === "guestlist" && scheduleText
      ? `<div class="venue-request-modal__schedule" aria-label="Guestlist schedule"><strong style="color:var(--cc-cream);font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase">On file</strong><ul>${club.guestlists
          .map(
            (g) =>
              `<li>${escapeAttr(
                g.days.length ? g.days.join(" · ") : "—",
              )} · ${g.recurrence === "one_off" ? "One-off" : "Weekly"}${g.notes ? ` — ${escapeAttr(g.notes)}` : ""}</li>`,
          )
          .join("")}</ul></div>`
      : "";

  modal.innerHTML = `
    <button type="button" class="modal__close" data-vr-close aria-label="Close">×</button>
    <h3 id="venue-request-title">${escapeAttr(title)}</h3>
    <p class="venue-request-modal__lede">${escapeAttr(club.name)}${club.locationTag ? ` · ${escapeAttr(club.locationTag)}` : ""}</p>
    ${scheduleBlock}
    <div class="cc-form-error" id="vr-error" role="alert" style="margin-bottom:1rem"></div>
    <form class="venue-request-modal__form" id="vr-form" novalidate>
      <div class="cc-field">
        <label for="vr-name">Your name</label>
        <input id="vr-name" name="name" type="text" autocomplete="name" required placeholder="Full name" />
      </div>
      <fieldset class="cc-notify-fieldset">
        <legend>How should we reach you?</legend>
        <div class="cc-notify-options" id="vr-notify-group">
          <label><input type="radio" name="notify" value="email" checked /> Email</label>
          <label><input type="radio" name="notify" value="phone" /> Phone / SMS</label>
          <label><input type="radio" name="notify" value="instagram_dm" /> Instagram DM</label>
          <label><input type="radio" name="notify" value="tiktok_dm" /> TikTok DM</label>
        </div>
      </fieldset>
      <div class="venue-request-modal__conditional" id="vr-wrap-email">
        <div class="cc-field">
          <label for="vr-email">Email</label>
          <input id="vr-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" />
        </div>
      </div>
      <div class="venue-request-modal__conditional" id="vr-wrap-phone" hidden>
        <div class="cc-field">
          <label for="vr-phone">Phone</label>
          <input id="vr-phone" name="phone" type="tel" autocomplete="tel" placeholder="+44 …" />
        </div>
      </div>
      <div class="venue-request-modal__conditional" id="vr-wrap-ig" hidden>
        <p class="venue-request-modal__hint">Optional: your Instagram handle helps us match your DM.</p>
        <div class="cc-field">
          <label for="vr-ig">Instagram handle</label>
          <input id="vr-ig" name="instagram_handle" type="text" placeholder="@username" />
        </div>
      </div>
      <div class="venue-request-modal__conditional" id="vr-wrap-tt" hidden>
        <p class="venue-request-modal__hint">Optional: your TikTok handle helps us match your DM.</p>
        <div class="cc-field">
          <label for="vr-tt">TikTok handle</label>
          <input id="vr-tt" name="tiktok_handle" type="text" placeholder="@username" />
        </div>
      </div>
      <button type="submit" class="cc-btn cc-btn--gold" id="vr-submit" style="width:100%">Send request</button>
    </form>
    <div class="venue-request-modal__success" id="vr-success" aria-live="polite">
      <p>Thank you — a concierge will follow up shortly.</p>
      <div class="venue-request-modal__social-row" id="vr-success-links"></div>
    </div>
  `;

  overlay.appendChild(modal);
  host.appendChild(overlay);

  const form = modal.querySelector("#vr-form") as HTMLFormElement;
  const errEl = modal.querySelector("#vr-error") as HTMLElement;
  const successEl = modal.querySelector("#vr-success") as HTMLElement;
  const successLinks = modal.querySelector("#vr-success-links") as HTMLElement;
  const wrapEmail = modal.querySelector("#vr-wrap-email") as HTMLElement;
  const wrapPhone = modal.querySelector("#vr-wrap-phone") as HTMLElement;
  const wrapIg = modal.querySelector("#vr-wrap-ig") as HTMLElement;
  const wrapTt = modal.querySelector("#vr-wrap-tt") as HTMLElement;
  const emailIn = modal.querySelector("#vr-email") as HTMLInputElement;
  const phoneIn = modal.querySelector("#vr-phone") as HTMLInputElement;
  const submitBtn = modal.querySelector("#vr-submit") as HTMLButtonElement;

  function showError(msg: string): void {
    errEl.textContent = msg;
    errEl.classList.toggle("is-visible", Boolean(msg));
  }

  function setNotifyUI(method: NotifyMethod): void {
    wrapEmail.hidden = method !== "email";
    wrapPhone.hidden = method !== "phone";
    wrapIg.hidden = method !== "instagram_dm";
    wrapTt.hidden = method !== "tiktok_dm";
    emailIn.required = method === "email";
    phoneIn.required = method === "phone";
    if (method === "email") emailIn.focus();
    else if (method === "phone") phoneIn.focus();
  }

  modal.querySelectorAll('input[name="notify"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const v = (modal.querySelector('input[name="notify"]:checked') as HTMLInputElement)?.value as NotifyMethod;
      if (v) setNotifyUI(v);
    });
  });

  function close(): void {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") close();
  }

  document.addEventListener("keydown", onKey);
  overlay.addEventListener("click", () => close());
  modal.querySelector("[data-vr-close]")?.addEventListener("click", close);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    showError("");
    const name = String(
      (modal.querySelector("#vr-name") as HTMLInputElement).value || "",
    ).trim();
    const method = (modal.querySelector(
      'input[name="notify"]:checked',
    ) as HTMLInputElement)?.value as NotifyMethod;
    const email = emailIn.value.trim();
    const phone = phoneIn.value.trim();
    const ig = (modal.querySelector("#vr-ig") as HTMLInputElement).value.trim();
    const tt = (modal.querySelector("#vr-tt") as HTMLInputElement).value.trim();

    if (!name) {
      showError("Please enter your name.");
      return;
    }
    if (method === "email" && !validateEmail(email)) {
      showError("Please enter a valid email address.");
      return;
    }
    if (method === "phone" && !validatePhone(phone)) {
      showError("Please enter a valid phone number.");
      return;
    }

    const payload: Record<string, string> = {
      name,
      request: kind === "private_table" ? "Private table" : "Guestlist",
      venue: club.name,
      venue_slug: club.slug,
      notify_via: method,
      guestlist_schedule_on_file: formatGuestlistsForPayload(club),
    };
    if (method === "email") payload.email = email;
    if (method === "phone") payload.phone = phone;
    if (method === "instagram_dm" && ig) payload.instagram_handle = ig;
    if (method === "tiktok_dm" && tt) payload.tiktok_handle = tt;

    const inquiryPayload: Record<string, unknown> = { ...payload };
    if (method === "email") inquiryPayload.email = email;
    else inquiryPayload.email = siteConfig.email;
    if (method === "phone") inquiryPayload.phone = phone;

    submitBtn.disabled = true;
    void (async () => {
      const result = await submitInquiry(inquiryPayload, formName);
      submitBtn.disabled = false;
      if (!result.ok) {
        showError(result.error ?? "Something went wrong.");
        return;
      }
      form.hidden = true;
      successEl.classList.add("is-visible");
      successLinks.innerHTML = "";
      if (method === "instagram_dm" && siteConfig.social.instagram) {
        const a = document.createElement("a");
        a.href = siteConfig.social.instagram;
        a.className = "cc-btn cc-btn--ghost";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "Open Instagram";
        successLinks.appendChild(a);
      }
      if (method === "tiktok_dm" && siteConfig.social.tiktok?.trim()) {
        const a = document.createElement("a");
        a.href = siteConfig.social.tiktok.trim();
        a.className = "cc-btn cc-btn--ghost";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "Open TikTok";
        successLinks.appendChild(a);
      }
    })();
  });

  setNotifyUI("email");
  (modal.querySelector("#vr-name") as HTMLInputElement).focus();
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
