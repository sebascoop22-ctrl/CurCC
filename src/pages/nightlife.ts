import { fetchClubs } from "../data/fetch-data";
import type { Club } from "../types";
import {
  openVenueRequestModal,
  type VenueRequestKind,
} from "../components/venue-request-modal";
import {
  hideFormError,
  showFormError,
  showFormSuccess,
  submitInquiry,
  validateEmail,
} from "../forms";
import "../styles/pages/nightlife.css";

const MAP_PIN_SVG = `<svg class="club-card__pin-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 7a2.5 2.5 0 0 1 0 5z"/></svg>`;

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

function renderClubKnownFor(c: Club): string {
  const items = (c.knownFor ?? []).map((x) => x.trim()).filter(Boolean);
  if (!items.length) return "";
  return `<div class="club-card__known">
      <h4 class="club-card__section-title">Known for</h4>
      <ul class="club-card__known-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>`;
}

function renderPriceItem(label: string, value: string): string {
  return `<span class="club-card__price-item"><span class="club-card__price-item-label">${escapeHtml(label)}</span><span class="club-card__price-item-value">${escapeHtml(value)}</span></span>`;
}

function renderClubPricing(c: Club): string {
  const w = c.entryPricingWomen?.trim();
  const m = c.entryPricingMen?.trim();
  const s = c.tablesStandard?.trim();
  const l = c.tablesLuxury?.trim();
  const v = c.tablesVip?.trim();
  const entryItems = [
    w ? renderPriceItem("Women", w) : "",
    m ? renderPriceItem("Men", m) : "",
  ].filter(Boolean);
  const tableItems = [
    s ? renderPriceItem("Standard", s) : "",
    l ? renderPriceItem("Luxury", l) : "",
    v ? renderPriceItem("VIP", v) : "",
  ].filter(Boolean);
  const min = c.minSpend?.trim();
  const hasEntry = entryItems.length > 0;
  const hasTables = tableItems.length > 0;
  const hasMin = Boolean(min);
  if (!hasEntry && !hasTables && !hasMin) return "";
  const entryLine = hasEntry
    ? `<div class="club-card__pricing-line">
        <span class="club-card__pricing-line-label">Entry</span>
        <div class="club-card__pricing-inline">${entryItems.join("")}</div>
      </div>`
    : "";
  const tablesLine = hasTables
    ? `<div class="club-card__pricing-line">
        <span class="club-card__pricing-line-label">Tables</span>
        <div class="club-card__pricing-inline">${tableItems.join("")}</div>
      </div>`
    : "";
  const minLine = hasMin
    ? `<div class="club-card__pricing-line club-card__pricing-line--min">
        <span class="club-card__pricing-line-label">Min. spend</span>
        <p class="club-card__pricing-min-value">${escapeHtml(min!)}</p>
      </div>`
    : "";
  return `<details class="club-card__pricing-details">
      <summary class="club-card__pricing-summary">
        <span class="club-card__pricing-title">Pricing</span>
        <span class="club-card__pricing-chevron" aria-hidden="true"></span>
      </summary>
      <div class="club-card__pricing-body">
        <div class="club-card__pricing-lines">
          ${entryLine}
          ${tablesLine}
          ${minLine}
        </div>
      </div>
    </details>`;
}

function renderClubActions(c: Club): string {
  const mapHref = `nightlife-map.html?venue=${encodeURIComponent(c.slug)}`;
  const slugAttr = escapeHtml(c.slug);
  const website =
    c.website.trim() !== ""
      ? `<a class="club-card__web-link" href="${escapeHtml(c.website)}" target="_blank" rel="noopener noreferrer" aria-label="Club website (opens in new tab)">Website <span aria-hidden="true">↗</span></a>`
      : "";
  return `<div class="club-card__actions">
      <div class="club-card__actions-bar">
        ${website}
        <a class="club-card__map-pin" href="${mapHref}" aria-label="View on map">${MAP_PIN_SVG}</a>
        <div class="club-card__split-book" role="group" aria-label="Guestlist and private table">
          <button type="button" class="club-card__split-book-top" data-vr-kind="guestlist" data-club-slug="${slugAttr}">
            <span class="club-card__split-book-label">Join guestlist</span>
          </button>
          <button type="button" class="club-card__split-book-bottom" data-vr-kind="private_table" data-club-slug="${slugAttr}">
            <span class="club-card__split-book-label">Book private table</span>
          </button>
        </div>
      </div>
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
            <div class="club-card__tail">
              ${renderClubKnownFor(c)}
              ${renderClubPricing(c)}
              ${renderClubActions(c)}
            </div>
          </div>
        </article>`;
      })
      .join("");
    target.innerHTML = cards;
  }

  renderGrid(clubsGrid);

  const requestHost = document.getElementById("cc-venue-request-root");
  clubsGrid.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest(
      "[data-vr-kind]",
    ) as HTMLElement | null;
    if (!t || !requestHost) return;
    const slug = t.dataset.clubSlug;
    const kind = t.dataset.vrKind as VenueRequestKind | undefined;
    if (!slug || (kind !== "private_table" && kind !== "guestlist")) return;
    const club = clubs.find((c) => c.slug === slug);
    if (!club) return;
    openVenueRequestModal({ host: requestHost, kind, club });
  });

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
