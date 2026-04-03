import { fetchCars } from "../data/fetch-data";
import type { Car } from "../types";
import {
  hideFormError,
  showFormError,
  showFormSuccess,
  submitInquiry,
  validateEmail,
} from "../forms";
import "../styles/pages/chauffeuring.css";

export async function initChauffeuring(): Promise<void> {
  const mount = document.getElementById("fleet-bento");
  if (!mount) return;
  const cars = await fetchCars().catch(() => [] as Car[]);
  mount.innerHTML = cars
    .map((car) => {
      const bgImage =
        car.images[0] != null
          ? `background-image: url(${JSON.stringify(car.images[0])})`
          : "";
      const specs = car.specsHover
        .map((s) => `• ${escapeHtml(s)}`)
        .join("<br/>");
      return `<article class="fleet-tile" style="${bgImage}" tabindex="0">
        <div class="fleet-tile__body">
          <span class="role">${escapeHtml(car.roleLabel)}</span>
          <h3>${escapeHtml(car.name)}</h3>
          <p class="fleet-tile__hover">${specs}</p>
        </div>
      </article>`;
    })
    .join("");

  mount.querySelectorAll(".fleet-tile").forEach((el) => {
    el.addEventListener("click", () => el.classList.toggle("is-tapped"));
  });

  const form = document.getElementById("fleet-form") as HTMLFormElement | null;
  const successEl = document.getElementById("fleet-success");
  const errorEl = document.getElementById("fleet-error");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const preference = String(fd.get("fleet_preference") || "").trim();
    let ok = true;
    form.querySelectorAll(".cc-field").forEach((x) => x.classList.remove("cc-field--error"));
    hideFormError(errorEl);
    successEl?.classList.remove("is-visible");
    if (!name) ok = false;
    if (!validateEmail(email)) ok = false;
    if (phone.length < 8) ok = false;
    if (!preference) ok = false;
    if (!ok) {
      if (!name) form.querySelector('[name="name"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (!validateEmail(email)) form.querySelector('[name="email"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (phone.length < 8) form.querySelector('[name="phone"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (!preference) form.querySelector('[name="fleet_preference"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      return;
    }
    const btn = form.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;
    btn && (btn.disabled = true);
    void (async () => {
      const result = await submitInquiry(
        { name, email, phone, fleetPreference: preference },
        "fleet_request",
      );
      btn && (btn.disabled = false);
      if (!result.ok) {
        showFormError(errorEl, result.error ?? "Something went wrong.");
        return;
      }
      showFormSuccess(successEl);
      form.reset();
    })();
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
