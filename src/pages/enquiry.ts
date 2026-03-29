import {
  showFormSuccess,
  submitInquiry,
  validateEmail,
} from "../forms";
import { getSocialLinkItems } from "../site-config";
import "../styles/pages/enquiry.css";

function renderEnquirySocials(): void {
  const el = document.getElementById("enquiry-socials");
  if (!el) return;
  const items = getSocialLinkItems();
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
            `<a href="${s.href}" target="_blank" rel="noopener noreferrer">${s.label}</a>`,
        )
        .join("")}
    </div>`;
}

export function initEnquiry(): void {
  renderEnquirySocials();
  const ctx = new URLSearchParams(window.location.search).get("context");
  const service = document.getElementById("enquiry-service") as HTMLSelectElement | null;
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

  const form = document.getElementById("enquiry-form") as HTMLFormElement | null;
  const successEl = document.getElementById("enquiry-success");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const interest = String(fd.get("service") || "").trim();
    const details = String(fd.get("details") || "").trim();
    let ok = true;
    form.querySelectorAll(".cc-field").forEach((x) => x.classList.remove("cc-field--error"));
    if (!name) ok = false;
    if (!validateEmail(email)) ok = false;
    if (phone.length < 8) ok = false;
    if (!interest) ok = false;
    if (!details) ok = false;
    if (!ok) {
      if (!name) form.querySelector('[name="name"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (!validateEmail(email)) form.querySelector('[name="email"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (phone.length < 8) form.querySelector('[name="phone"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (!interest) form.querySelector('[name="service"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (!details) form.querySelector('[name="details"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      return;
    }
    submitInquiry(
      { name, email, phone, serviceOfInterest: interest, details },
      "general_enquiry",
    );
    showFormSuccess(successEl);
    form.reset();
  });
}
