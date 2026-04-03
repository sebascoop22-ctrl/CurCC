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

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Whether the venue lists `d`'s weekday in `days_open` (Thu-Sat, Wed|Fri, daily, etc.). */
function clubOpenOnDate(club: Club, d: Date): boolean {
  const open = club.daysOpen.toLowerCase();
  if (!open || open.includes("daily")) return true;
  const abbr = DOW[d.getDay()].toLowerCase().slice(0, 3);
  return open.includes(abbr);
}

function getQueryVenue(): string | null {
  const q = new URLSearchParams(window.location.search).get("venue");
  return q ? decodeURIComponent(q) : null;
}

function renderClubTags(c: Club, today: Date): string {
  const open = clubOpenOnDate(c, today);
  const status = open ? "open" : "closed";
  const statusLabel = open ? "Open today" : "Closed today";
  const parts: string[] = [
    `<span class="club-card__tag club-card__tag--status club-card__tag--${status}">${statusLabel}</span>`,
  ];
  if (c.featured) {
    parts.push(
      `<span class="club-card__tag club-card__tag--featured">Featured</span>`,
    );
  }
  const tagsRow = `<div class="club-card__tags-row">${parts.join("")}</div>`;
  if (!c.bestVisitDays.length) return tagsRow;
  const best = c.bestVisitDays
    .map(
      (d) =>
        `<span class="club-card__tag club-card__tag--best">${escapeHtml(d)}</span>`,
    )
    .join("");
  return `${tagsRow}<div class="club-card__best-nights"><span class="club-card__best-label">Best nights</span><div class="club-card__tags-row club-card__tags-row--best">${best}</div></div>`;
}

function renderClubGuide(c: Club): string {
  const kf = c.knownFor?.trim() ?? "";
  const en = c.entryPricing?.trim() ?? "";
  const tb = c.tablesPricing?.trim() ?? "";
  if (!kf && !en && !tb) return "";
  const rows: string[] = [];
  if (kf) {
    rows.push(
      `<div class="club-card__guide-row"><span class="club-card__guide-label">Known for</span><span class="club-card__guide-value">${escapeHtml(kf)}</span></div>`,
    );
  }
  if (en) {
    rows.push(
      `<div class="club-card__guide-row"><span class="club-card__guide-label">Guestlist &amp; entry</span><span class="club-card__guide-value">${escapeHtml(en)}</span></div>`,
    );
  }
  if (tb) {
    rows.push(
      `<div class="club-card__guide-row"><span class="club-card__guide-label">Tables</span><span class="club-card__guide-value">${escapeHtml(tb)}</span></div>`,
    );
  }
  return `<div class="club-card__guide">${rows.join("")}</div>`;
}

function renderClubActions(c: Club): string {
  const mapHref = `nightlife-map.html?venue=${encodeURIComponent(c.slug)}`;
  const inquireHref = `enquiry.html?context=${encodeURIComponent(`Private table — ${c.name}`)}`;
  const website =
    c.website.trim() !== ""
      ? `<a class="club-card__link club-card__link--ghost" href="${escapeHtml(c.website)}" target="_blank" rel="noopener noreferrer">Club website <span aria-hidden="true">↗</span></a>`
      : "";
  return `<div class="club-card__actions">
      ${website}
      <a class="club-card__link club-card__link--ghost" href="${mapHref}">View on map</a>
      <a class="club-card__link club-card__link--primary" href="${inquireHref}">Inquire <span aria-hidden="true">→</span></a>
    </div>`;
}

export async function initNightlife(): Promise<void> {
  const clubs = await fetchClubs();
  const clubsGrid = document.getElementById("clubs-grid");
  if (!clubsGrid) return;

  const today = startOfDay(new Date());

  function renderGrid(target: HTMLElement): void {
    const cards = clubs
      .map((c) => {
        const img =
          c.images[0] || "/media/nightlife/hero-atmosphere.svg";
        return `
        <article class="club-card lux-card" data-slug="${c.slug}">
          <div class="club-card__media">
            <img class="club-card__img" src="${img}" alt="" width="640" height="400" loading="lazy" />
          </div>
          <div class="club-card__body">
            <h3>${escapeHtml(c.name)}</h3>
            <p class="club-card__meta">${escapeHtml(c.locationTag)}</p>
            ${renderClubTags(c, today)}
            <p class="club-card__desc">${escapeHtml(c.shortDescription)}</p>
            ${renderClubGuide(c)}
            ${renderClubActions(c)}
          </div>
        </article>`;
      })
      .join("");
    target.innerHTML = cards;
  }

  renderGrid(clubsGrid);

  const venueParam = getQueryVenue();
  if (venueParam) {
    requestAnimationFrame(() => {
      const card = clubsGrid.querySelector(
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
