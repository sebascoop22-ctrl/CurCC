import {
  fetchClubFlyers,
  fetchClubs,
  fetchGuestlistEventContexts,
  fetchPromoterAssignments,
  groupAssignmentsByClub,
  groupGuestlistContextsByClub,
  groupFlyersByClubSlug,
} from "../data/fetch-data";
import type {
  Club,
  ClubFlyer,
  GuestlistEventContext,
  PromoterShiftAssignment,
} from "../types";
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

/** Coerce API/JSON quirks so card rendering never throws and skips the lead form. */
function normalizeClub(raw: Club): Club {
  const kfUnknown = raw.knownFor as unknown;
  let knownFor: string[] = [];
  if (Array.isArray(kfUnknown)) {
    knownFor = kfUnknown.map((x) => String(x).trim()).filter(Boolean);
  } else if (typeof kfUnknown === "string") {
    knownFor = kfUnknown
      .split(/[;,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const bvd = raw.bestVisitDays as unknown;
  const bestVisitDays = Array.isArray(bvd)
    ? bvd.map((x) => String(x).trim()).filter(Boolean)
    : typeof bvd === "string"
      ? bvd
          .split(/[|,\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const img = raw.images as unknown;
  const images = Array.isArray(img) ? img.map((x) => String(x)) : [];
  const gl = raw.guestlists as unknown;
  const guestlists = Array.isArray(gl) ? (gl as Club["guestlists"]) : [];
  const rev = raw.reviews as unknown;
  const reviews = Array.isArray(rev) ? rev.map(String) : [];
  const am = raw.amenities as unknown;
  const amenities = Array.isArray(am) ? am.map(String) : [];
  return {
    ...raw,
    daysOpen: typeof raw.daysOpen === "string" ? raw.daysOpen : "",
    website: typeof raw.website === "string" ? raw.website : "",
    knownFor,
    bestVisitDays,
    images,
    guestlists,
    reviews,
    amenities,
  };
}

function renderClubTags(c: Club, today: Date): string {
  const open = clubOpenOnDate(c, today);
  const status = open ? "open" : "closed";
  const statusLabel = open ? "Open today" : "Closed today";
  const parts: string[] = [
    `<span class="club-card__tag club-card__tag--status club-card__tag--${status}">${statusLabel}</span>`,
  ];
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
  const hasEntry = entryItems.length > 0;
  const hasTables = tableItems.length > 0;
  if (!hasEntry && !hasTables) return "";
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
  return `<details class="club-card__pricing-details">
      <summary class="club-card__pricing-summary">
        <span class="club-card__pricing-title">Pricing</span>
        <span class="club-card__pricing-chevron" aria-hidden="true"></span>
      </summary>
      <div class="club-card__pricing-body">
        <div class="club-card__pricing-lines">
          ${entryLine}
          ${tablesLine}
        </div>
      </div>
    </details>`;
}

function renderClubActions(
  c: Club,
  assignmentsByClub: Record<string, PromoterShiftAssignment[]>,
  guestlistContextByClub: Record<string, GuestlistEventContext[]>,
): string {
  const mapHref = `/nightlife-map?venue=${encodeURIComponent(c.slug)}`;
  const slugAttr = escapeHtml(c.slug);
  const website =
    c.website.trim() !== ""
      ? `<a class="club-card__web-link" href="${escapeHtml(c.website)}" target="_blank" rel="noopener noreferrer" aria-label="Club website (opens in new tab)">Website <span aria-hidden="true">↗</span></a>`
      : "";
  const assignments = assignmentsByClub[c.slug] ?? [];
  const eventContext = guestlistContextByClub[c.slug]?.[0] ?? null;
  const promoterStrip = assignments.length
    ? `<div class="club-card__promoters">Working tonight: ${assignments
        .map((a) => `<button type="button" class="club-card__promoter-chip" data-promoter-name="${escapeHtml(a.promoterName)}" data-promoter-id="${escapeHtml(a.promoterId)}">${escapeHtml(a.promoterName)}</button>`)
        .join("")}</div>`
    : `<div class="club-card__promoters">No promoter assigned yet tonight.</div>`;
  const guestlistStrip = eventContext
    ? `<div class="club-card__promoters">Guestlist ${eventContext.status}: ${eventContext.attended}/${eventContext.signups} attended (${Math.round(eventContext.conversion * 100)}% conversion)</div>`
    : `<div class="club-card__promoters">Guestlist context unavailable.</div>`;
  return `<div class="club-card__actions">
      ${promoterStrip}
      ${guestlistStrip}
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
  const [clubRows, flyerRows, assignments, guestEvents] = await Promise.all([
    fetchClubs().catch(() => [] as Club[]),
    fetchClubFlyers().catch(() => [] as ClubFlyer[]),
    fetchPromoterAssignments().catch(() => [] as PromoterShiftAssignment[]),
    fetchGuestlistEventContexts().catch(() => [] as GuestlistEventContext[]),
  ]);
  const clubs = clubRows.map(normalizeClub);
  const flyersByClub = groupFlyersByClubSlug(flyerRows);
  const assignmentsByClub = groupAssignmentsByClub(assignments);
  const guestlistContextByClub = groupGuestlistContextsByClub(guestEvents);
  const clubsGrid = document.getElementById("clubs-grid");
  const today = startOfDay(new Date());
  const modeFeaturedBtn = document.getElementById("nightlife-mode-featured");
  const modeFlyersBtn = document.getElementById("nightlife-mode-flyers");
  const flyersPanel = document.getElementById("nightlife-flyers-panel");
  const flyerCard = document.getElementById("nightlife-flyer-card");
  const flyerTitle = document.getElementById("nightlife-flyers-title");
  const flyerPrev = document.getElementById("nightlife-flyer-prev");
  const flyerNext = document.getElementById("nightlife-flyer-next");
  const flyerIndex = document.getElementById("nightlife-flyer-index");
  let selectedClubSlug = "";
  let selectedFlyerIdx = 0;
  let mode: "featured" | "flyers" = "featured";
  const hasAnyFlyers = flyerRows.length > 0;

  function updateFlyerPanel(): void {
    if (!flyersPanel || !flyerCard || !flyerIndex || !flyerTitle) return;
    const rows = flyersByClub[selectedClubSlug] ?? [];
    const has = rows.length > 0;
    if (mode !== "flyers") {
      flyersPanel.hidden = true;
      return;
    }
    flyersPanel.hidden = false;
    if (!has) {
      flyerTitle.textContent = "Club flyers";
      flyerIndex.textContent = "0 / 0";
      flyerCard.innerHTML = `<p class="club-card__desc">No flyers available for this club yet.</p>`;
      return;
    }
    selectedFlyerIdx = ((selectedFlyerIdx % rows.length) + rows.length) % rows.length;
    const flyer = rows[selectedFlyerIdx];
    const club = clubs.find((c) => c.slug === selectedClubSlug);
    flyerTitle.textContent = `${club?.name ?? "Club"} flyer`;
    flyerIndex.textContent = `${selectedFlyerIdx + 1} / ${rows.length}`;
    const img = flyer.imageUrl
      ? `<img src="${escapeHtml(flyer.imageUrl)}" alt="${escapeHtml(flyer.title || "Club flyer")}" loading="lazy" />`
      : "";
    flyerCard.innerHTML = `
      ${img}
      <h4 style="margin:0.65rem 0 0.35rem;color:var(--cc-cream)">${escapeHtml(flyer.title || "Weekly flyer")}</h4>
      <p class="club-card__meta" style="margin-bottom:0.45rem">${escapeHtml(flyer.eventDate)}</p>
      <p class="club-card__desc" style="margin-bottom:0">${escapeHtml(flyer.description || "Club promotion")}</p>
    `;
  }

  function renderGrid(target: HTMLElement): void {
    const cards = clubs
      .map((c) => {
        const flyerImage = flyersByClub[c.slug]?.[0]?.imageUrl?.trim() ?? "";
        const mediaImages = [
          flyerImage,
          ...(c.images ?? []),
        ].filter((x, idx, arr) => Boolean(x) && arr.indexOf(x) === idx);
        const img = mediaImages[0] || "/media/nightlife/hero-atmosphere.svg";
        const imagesJson = escapeHtml(JSON.stringify(mediaImages));
        const hasMany = mediaImages.length > 1;
        return `
        <article class="club-card lux-card" data-slug="${c.slug}">
          <div class="club-card__media" data-images='${imagesJson}' data-image-idx="0">
            <img class="club-card__img" src="${img}" alt="" width="640" height="400" loading="lazy" />
            ${
              hasMany
                ? `<button type="button" class="club-card__img-nav club-card__img-nav--prev" data-img-nav="-1" aria-label="Previous image">‹</button>
                   <button type="button" class="club-card__img-nav club-card__img-nav--next" data-img-nav="1" aria-label="Next image">›</button>`
                : ""
            }
          </div>
          <div class="club-card__body">
            <h3>${escapeHtml(c.name)}</h3>
            <p class="club-card__meta">${escapeHtml(c.locationTag)}</p>
            ${renderClubTags(c, today)}
            <p class="club-card__desc">${escapeHtml(c.shortDescription)}</p>
            <div class="club-card__tail">
              ${renderClubKnownFor(c)}
              ${renderClubPricing(c)}
            ${renderClubActions(c, assignmentsByClub, guestlistContextByClub)}
            </div>
          </div>
        </article>`;
      })
      .join("");
    target.innerHTML = cards;
  }

  if (clubsGrid) {
    renderGrid(clubsGrid);
    selectedClubSlug = clubs[0]?.slug ?? "";
    updateFlyerPanel();

    const requestHost = document.getElementById("cc-venue-request-root");
    clubsGrid.addEventListener("click", (e) => {
      const navBtn = (e.target as HTMLElement).closest("[data-img-nav]") as HTMLElement | null;
      if (navBtn) {
        const media = navBtn.closest(".club-card__media") as HTMLElement | null;
        const img = media?.querySelector(".club-card__img") as HTMLImageElement | null;
        if (!media || !img) return;
        const raw = media.dataset.images || "[]";
        let images: string[] = [];
        try {
          const parsed = JSON.parse(raw) as unknown;
          images = Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
        } catch {
          images = [];
        }
        if (images.length < 2) return;
        const delta = Number(navBtn.dataset.imgNav || "0") || 0;
        const idx = Number(media.dataset.imageIdx || "0") || 0;
        const next = ((idx + delta) % images.length + images.length) % images.length;
        media.dataset.imageIdx = String(next);
        img.src = images[next];
        return;
      }
      const card = (e.target as HTMLElement).closest("article[data-slug]") as HTMLElement | null;
      const clickedSlug = card?.dataset.slug;
      if (clickedSlug) {
        selectedClubSlug = clickedSlug;
        selectedFlyerIdx = 0;
        updateFlyerPanel();
      }
      const promoterChip = (e.target as HTMLElement).closest(
        "[data-promoter-name]",
      ) as HTMLElement | null;
      if (promoterChip) {
        const name = promoterChip.dataset.promoterName || "promoter";
        const to = `/enquiry?context=${encodeURIComponent(`Nightlife promoter request: ${name}`)}`;
        window.location.href = to;
        return;
      }
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
        if (venueParam) {
          selectedClubSlug = venueParam;
          selectedFlyerIdx = 0;
          updateFlyerPanel();
        }
        card?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }
  modeFeaturedBtn?.addEventListener("click", () => {
    mode = "featured";
    modeFeaturedBtn.classList.add("is-active");
    modeFlyersBtn?.classList.remove("is-active");
    modeFeaturedBtn.setAttribute("aria-selected", "true");
    modeFlyersBtn?.setAttribute("aria-selected", "false");
    updateFlyerPanel();
  });
  modeFlyersBtn?.addEventListener("click", () => {
    if (!hasAnyFlyers) return;
    mode = "flyers";
    modeFlyersBtn.classList.add("is-active");
    modeFeaturedBtn?.classList.remove("is-active");
    modeFlyersBtn.setAttribute("aria-selected", "true");
    modeFeaturedBtn?.setAttribute("aria-selected", "false");
    updateFlyerPanel();
  });
  flyerPrev?.addEventListener("click", () => {
    selectedFlyerIdx -= 1;
    updateFlyerPanel();
  });
  flyerNext?.addEventListener("click", () => {
    selectedFlyerIdx += 1;
    updateFlyerPanel();
  });
  if (!hasAnyFlyers && modeFlyersBtn) {
    modeFlyersBtn.setAttribute("disabled", "true");
    modeFlyersBtn.setAttribute("aria-disabled", "true");
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
      showFormError(errorEl, "Please check the highlighted fields.");
      return;
    }
    const btn = form.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    void (async () => {
      try {
        const result = await submitInquiry(
          { name: fullName, email, whenWhere },
          "nightlife_lead",
        );
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
