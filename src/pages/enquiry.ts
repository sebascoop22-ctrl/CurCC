import {
  hideFormError,
  showFormError,
  showFormSuccess,
  submitInquiry,
  validateEmail,
  validateInstagramHandle,
  validatePhone,
} from "../forms";
import { getSocialLinkItems, whatsappHref } from "../site-config";
import "../styles/pages/enquiry.css";

function renderEnquirySocials(): void {
  const el = document.getElementById("enquiry-socials");
  if (!el) return;
  const items: { label: string; href: string }[] = [];
  let whatsappInserted = false;
  for (const s of getSocialLinkItems()) {
    items.push(s);
    if (s.label === "Instagram") {
      items.push({
        label: "WhatsApp",
        href: whatsappHref("Cooper Concierge enquiry"),
      });
      whatsappInserted = true;
    }
  }
  if (!whatsappInserted) {
    items.push({
      label: "WhatsApp",
      href: whatsappHref("Cooper Concierge enquiry"),
    });
  }
  if (!items.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <p class="enquiry-socials__label">Connect with us</p>
    <div class="enquiry-socials__links">
      ${items
        .map(
          (s) =>
            `<a href="${escapeHref(s.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
              s.label,
            )}</a>`,
        )
        .join("")}
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function escapeHref(s: string): string {
  return s.replace(/"/g, "&quot;");
}

export function initEnquiry(): void {
  renderEnquirySocials();
  const wrapPhone = document.getElementById("eq-wrap-phone");
  const wrapEmail = document.getElementById("eq-wrap-email");
  const wrapIg = document.getElementById("eq-wrap-ig");
  const phoneIn = document.getElementById("eq-phone") as HTMLInputElement | null;
  const emailIn = document.getElementById("eq-email") as HTMLInputElement | null;
  const igIn = document.getElementById("eq-instagram") as HTMLInputElement | null;

  function syncContactFields(): void {
    const v = (
      document.querySelector(
        'input[name="contact_via"]:checked',
      ) as HTMLInputElement | null
    )?.value;
    const method = v === "email" || v === "instagram" ? v : "phone";
    if (wrapPhone) wrapPhone.hidden = method !== "phone";
    if (wrapEmail) wrapEmail.hidden = method !== "email";
    if (wrapIg) wrapIg.hidden = method !== "instagram";
    if (phoneIn) phoneIn.required = method === "phone";
    if (emailIn) emailIn.required = method === "email";
    if (igIn) igIn.required = method === "instagram";
  }

  document.querySelectorAll('input[name="contact_via"]').forEach((r) => {
    r.addEventListener("change", syncContactFields);
  });
  syncContactFields();

  const ctx = new URLSearchParams(window.location.search).get("context");
  const service = document.getElementById("enquiry-service") as HTMLSelectElement | null;
  const detailsEl = document.getElementById("eq-details") as HTMLTextAreaElement | null;
  if (service && ctx) {
    const c = ctx.toLowerCase();
    if (c.includes("table") || c.includes("venue") || c.includes("night"))
      service.value = "nightlife";
    else if (c.includes("fleet") || c.includes("car") || c.includes("chauff"))
      service.value = "chauffeuring";
    else if (c.includes("security") || c.includes("protection"))
      service.value = "security";
    else if (c.includes("dining")) service.value = "dining";
  }
  if (detailsEl && ctx?.trim()) {
    detailsEl.value = ctx.trim();
  }

  const form = document.getElementById("enquiry-form") as HTMLFormElement | null;
  const successEl = document.getElementById("enquiry-success");
  const errorEl = document.getElementById("enquiry-error");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const contactVia = String(
      (form.querySelector('input[name="contact_via"]:checked') as HTMLInputElement | null)
        ?.value || "phone",
    );
    const email = String(fd.get("email") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const instagramRaw = String(fd.get("instagram_handle") || "").trim();
    const interest = String(fd.get("service") || "").trim();
    const details = String(fd.get("details") || "").trim();
    let ok = true;
    form.querySelectorAll(".cc-field").forEach((x) => x.classList.remove("cc-field--error"));
    hideFormError(errorEl);
    successEl?.classList.remove("is-visible");
    if (!name) ok = false;
    if (contactVia === "email" && !validateEmail(email)) ok = false;
    if (contactVia === "phone" && !validatePhone(phone)) ok = false;
    if (contactVia === "instagram" && !validateInstagramHandle(instagramRaw)) ok = false;
    if (!interest) ok = false;
    if (!details) ok = false;
    if (!ok) {
      if (!name) form.querySelector('[name="name"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (contactVia === "email" && !validateEmail(email))
        wrapEmail?.classList.add("cc-field--error");
      if (contactVia === "phone" && !validatePhone(phone))
        wrapPhone?.classList.add("cc-field--error");
      if (contactVia === "instagram" && !validateInstagramHandle(instagramRaw))
        wrapIg?.classList.add("cc-field--error");
      if (!interest) form.querySelector('[name="service"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (!details) form.querySelector('[name="details"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      showFormError(errorEl, "Please check the highlighted fields.");
      return;
    }
    const payload: Record<string, string> = {
      name,
      contact_via: contactVia,
      serviceOfInterest: interest,
      details,
    };
    if (contactVia === "email") payload.email = email;
    if (contactVia === "phone") payload.phone = phone;
    if (contactVia === "instagram") payload.instagram_handle = instagramRaw;
    const btn = form.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    void (async () => {
      try {
        const result = await submitInquiry(payload, "general_enquiry");
        if (!result.ok) {
          showFormError(errorEl, result.error ?? "Something went wrong.");
          return;
        }
        showFormSuccess(successEl);
        form.reset();
      } finally {
        if (btn) btn.disabled = false;
      }
    })();
  });
}
