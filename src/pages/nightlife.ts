import { fetchClubs } from "../data/fetch-data";
import type { Club } from "../types";
import {
  hideFormError,
  showFormError,
  showFormSuccess,
  submitInquiry,
  validateEmail,
} from "../forms";
import "../styles/pages/nightlife.css";

function pillFor(c: Club): string {
  if (c.featured) return "Signature selection";
  return c.venueType === "dining" ? "Chef’s table" : "Private lounge";
}

function getQueryVenue(): string | null {
  const q = new URLSearchParams(window.location.search).get("venue");
  return q ? decodeURIComponent(q) : null;
}

export async function initNightlife(): Promise<void> {
  const clubs = await fetchClubs();
  const grid = document.getElementById("clubs-grid");
  if (!grid) return;

  function renderGrid(): void {
    const cards = clubs
      .map((c) => {
        const img =
          c.images[0] || "/media/nightlife/hero-atmosphere.svg";
        return `
        <article class="club-card lux-card" data-slug="${c.slug}">
          <div class="club-card__media">
            <span class="club-card__pill">${escapeHtml(pillFor(c))}</span>
            <img class="club-card__img" src="${img}" alt="" width="640" height="400" loading="lazy" />
          </div>
          <div class="club-card__body">
            <h3>${escapeHtml(c.name)}</h3>
            <p class="club-card__meta">${escapeHtml(c.locationTag)}</p>
            <p class="club-card__desc">${escapeHtml(c.shortDescription)}</p>
            <a class="club-card__inquire" href="nightlife-map.html?venue=${encodeURIComponent(c.slug)}">Inquire <span aria-hidden="true">→</span></a>
          </div>
        </article>`;
      })
      .join("");
    grid.innerHTML = cards;
  }

  renderGrid();

  const venueParam = getQueryVenue();
  if (venueParam) {
    requestAnimationFrame(() => {
      const card = grid.querySelector(
        `article[data-slug="${CSS.escape(venueParam)}"]`,
      );
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  const form = document.getElementById("nightlife-lead-form") as HTMLFormElement | null;
  const successEl = document.getElementById("nightlife-lead-success");
  const errorEl = document.getElementById("nightlife-lead-error");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const fullName = String(fd.get("full_name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const whenWhere = String(fd.get("when_where") || "").trim();
    let ok = true;
    form.querySelectorAll(".cc-field").forEach((el) => el.classList.remove("cc-field--error"));
    hideFormError(errorEl);
    successEl?.classList.remove("is-visible");
    if (!fullName) ok = false;
    if (!validateEmail(email)) ok = false;
    if (!whenWhere) ok = false;
    if (!ok) {
      if (!fullName) form.querySelector('[name="full_name"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (!validateEmail(email)) form.querySelector('[name="email"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (!whenWhere) form.querySelector('[name="when_where"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      return;
    }
    const btn = form.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;
    btn && (btn.disabled = true);
    void (async () => {
      const result = await submitInquiry(
        { name: fullName, email, whenWhere },
        "nightlife_lead",
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
