import {
  fetchClubFlyers,
  fetchClubs,
  fetchGuestlistEventContexts,
  groupFlyersByClubSlug,
} from "../data/fetch-data";
import type { Club, ClubFlyer, GuestlistEventContext } from "../types";
import {
  featuredClubsSorted,
  clubOpenOnDate,
  sortClubsForDiscovery,
  type ClubWithSortMeta,
} from "../data/club-sort";
import { carouselSlideHtml, smallClubCardHtml } from "../nightlife/card-templates";
import { rankFlyersForHero, renderTopFlyerHostHtml } from "../nightlife/flyer-rank";
import { initNightlifeHeroMap } from "../lib/nightlife-hero-map";
import { initNightlifeDiscoverHover } from "../nightlife/nightlife-discover-hover";
import {
  hideFormError,
  showFormError,
  showFormSuccess,
  submitInquiry,
  validateEmail,
} from "../forms";
import { openVenueRequestModal } from "../components/venue-request-modal";
import "../styles/pages/nightlife.css";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getQueryVenue(): string | null {
  const q = new URLSearchParams(window.location.search).get("venue");
  return q ? decodeURIComponent(q) : null;
}

/** Coerce API/JSON quirks so rendering never throws. */
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
  const vid = raw.videos as unknown;
  const videos = Array.isArray(vid) ? vid.map((x) => String(x)).filter(Boolean) : [];
  const gl = raw.guestlists as unknown;
  const guestlists = Array.isArray(gl) ? (gl as Club["guestlists"]) : [];
  const am = raw.amenities as unknown;
  const amenities = Array.isArray(am) ? am.map(String) : [];
  return {
    ...raw,
    daysOpen: typeof raw.daysOpen === "string" ? raw.daysOpen : "",
    website: typeof raw.website === "string" ? raw.website : "",
    knownFor,
    bestVisitDays,
    images,
    videos: videos.length ? videos : undefined,
    hasPartnership: raw.hasPartnership !== false,
    guestlists,
    amenities,
  };
}

export async function initNightlife(): Promise<void> {
  const [clubRows, flyerRows] = await Promise.all([
    fetchClubs().catch(() => [] as Club[]),
    fetchClubFlyers().catch(() => [] as ClubFlyer[]),
  ]);
  const clubsBase = clubRows.map(normalizeClub);
  const withOrder: ClubWithSortMeta[] = clubsBase.map((c, i) => ({
    ...c,
    _sortOrder: i,
  }));
  const today = startOfDay(new Date());
  const sorted = sortClubsForDiscovery(withOrder, today);
  const featured = featuredClubsSorted(withOrder, today);
  const flyersByClub = groupFlyersByClubSlug(flyerRows);
  const rankedFlyers = rankFlyersForHero(sorted, flyersByClub);

  const flyerHost = document.getElementById("nl-hero-flyer-host");
  if (flyerHost) flyerHost.innerHTML = renderTopFlyerHostHtml(rankedFlyers);

  const carouselTrack = document.getElementById("nl-carousel-track");
  if (carouselTrack) {
    carouselTrack.innerHTML = featured.map((c) => carouselSlideHtml(c)).join("");
  }
  const flyerCarouselTrack = document.getElementById("nl-flyer-carousel-track");
  if (flyerCarouselTrack) {
    flyerCarouselTrack.innerHTML = rankedFlyers
      .map((f) => {
        const slug = escapeHtml(f.clubSlug);
        const date = escapeHtml(f.eventDate);
        const title = escapeHtml(f.title || "Weekly flyer");
        const clubName = escapeHtml(f.clubName || f.clubSlug);
        const image = f.imageUrl?.trim()
          ? `<img src="${escapeHtml(f.imageUrl)}" alt="${title}" loading="lazy" />`
          : `<div class="nl-flyer-slide__placeholder">No flyer image</div>`;
        return `<div class="nl-carousel__slide nl-flyer-slide" data-flyer-slug="${slug}" data-flyer-date="${date}">
          <article class="nl-flyer-slide__card" tabindex="0" role="button" aria-label="Open flyer for ${clubName} on ${date}">
            <div class="nl-flyer-slide__media">${image}</div>
            <div class="nl-flyer-slide__body">
              <p class="nl-flyer-slide__meta">${clubName} · ${date}</p>
              <h3 class="nl-flyer-slide__title">${title}</h3>
            </div>
          </article>
        </div>`;
      })
      .join("");
  }

  const clubsGrid = document.getElementById("clubs-grid");
  const filterToggle = document.getElementById("nl-filter-toggle") as HTMLButtonElement | null;
  const filterPanel = document.getElementById("nl-filter-panel") as HTMLElement | null;
  const filterDateIn = document.getElementById("nl-filter-date") as HTMLInputElement | null;
  const filterLocationSel = document.getElementById("nl-filter-location") as HTMLSelectElement | null;
  const filterResetBtn = document.getElementById("nl-filter-reset") as HTMLButtonElement | null;
  const filterStatus = document.getElementById("nl-filter-status") as HTMLElement | null;
  const fmtYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  let selectedFilterDate = startOfDay(today);
  let selectedFilterLocation = "";
  let guestlistHintBySlug = new Map<string, string>();

  function renderGuestlistHints(): void {
    clubsGrid?.querySelectorAll("[data-slug].nl-card").forEach((el) => {
      const slug = (el as HTMLElement).dataset.slug?.trim() || "";
      if (!slug) return;
      const text = guestlistHintBySlug.get(slug) ?? "";
      if (!text) return;
      const body = el.querySelector(".nl-card__body");
      if (!body || body.querySelector(".nl-card__hint")) return;
      const hint = document.createElement("p");
      hint.className = "nl-card__hint";
      hint.textContent = text;
      body.appendChild(hint);
    });
  }

  function renderClubsGrid(): void {
    if (!clubsGrid) return;
    const filtered = withOrder
      .filter((c) => {
        const loc = (c.locationTag || "").trim();
        if (!selectedFilterLocation) return true;
        return loc.toLowerCase() === selectedFilterLocation.toLowerCase();
      })
      .sort((a, b) => {
        const aOpen = clubOpenOnDate(a, selectedFilterDate) ? 1 : 0;
        const bOpen = clubOpenOnDate(b, selectedFilterDate) ? 1 : 0;
        const aRecommended = a.featured ? 1 : 0;
        const bRecommended = b.featured ? 1 : 0;
        const aBucket = aOpen ? (aRecommended ? 0 : 1) : aRecommended ? 2 : 3;
        const bBucket = bOpen ? (bRecommended ? 0 : 1) : bRecommended ? 2 : 3;
        if (aBucket !== bBucket) return aBucket - bBucket;
        const ar = a._sortOrder ?? 999999;
        const br = b._sortOrder ?? 999999;
        if (ar !== br) return ar - br;
        return a.name.localeCompare(b.name, "en");
      });
    clubsGrid.innerHTML = filtered.map((c) => smallClubCardHtml(c)).join("");
    renderGuestlistHints();

    if (!filterStatus) return;
    const dateLabel = selectedFilterDate.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
    const locLabel = selectedFilterLocation || "All locations";
    filterStatus.textContent = `Showing ${filtered.length} venues • ${locLabel} • ${dateLabel} (open + recommended first)`;
  }

  if (filterLocationSel) {
    const locations = Array.from(
      new Set(
        withOrder
          .map((c) => (c.locationTag || "").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "en"));
    filterLocationSel.innerHTML = `<option value="">All locations</option>${locations
      .map((loc) => `<option value="${escapeHtml(loc)}">${escapeHtml(loc)}</option>`)
      .join("")}`;
  }
  if (filterDateIn) {
    filterDateIn.value = fmtYmd(selectedFilterDate);
  }
  function setFilterPanelOpen(open: boolean): void {
    filterToggle?.setAttribute("aria-expanded", String(open));
    filterToggle?.setAttribute("aria-label", open ? "Close venue filters" : "Open venue filters");
    if (filterPanel) filterPanel.hidden = !open;
    if (filterStatus) filterStatus.hidden = !open;
    if (filterDateIn) filterDateIn.disabled = !open;
    if (filterLocationSel) filterLocationSel.disabled = !open;
    if (filterResetBtn) filterResetBtn.disabled = !open;
  }
  setFilterPanelOpen(false);
  renderClubsGrid();

  filterToggle?.addEventListener("click", () => {
    const open = filterToggle.getAttribute("aria-expanded") === "true";
    setFilterPanelOpen(!open);
  });
  filterDateIn?.addEventListener("change", () => {
    const raw = filterDateIn.value.trim();
    if (raw) {
      selectedFilterDate = startOfDay(new Date(`${raw}T00:00:00`));
      renderClubsGrid();
    }
  });
  filterLocationSel?.addEventListener("change", () => {
    selectedFilterLocation = String(filterLocationSel.value || "").trim();
    renderClubsGrid();
  });
  filterResetBtn?.addEventListener("click", () => {
    selectedFilterDate = startOfDay(today);
    selectedFilterLocation = "";
    if (filterDateIn) filterDateIn.value = fmtYmd(selectedFilterDate);
    if (filterLocationSel) filterLocationSel.value = "";
    renderClubsGrid();
  });

  void initNightlifeHeroMap(sorted);
  initNightlifeDiscoverHover();

  const requestHost = document.getElementById("cc-venue-request-root") as HTMLElement | null;
  const featuredCarousel = document.getElementById("nl-carousel-track");
  const flyerCarousel = document.getElementById("nl-flyer-carousel-track");

  function closeFlyerModal(): void {
    document.querySelectorAll(".flyer-modal-overlay").forEach((el) => el.remove());
    document.body.classList.remove("no-scroll");
  }

  function openFlyerModal(flyer: ClubFlyer, club: Club | undefined): void {
    closeFlyerModal();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay flyer-modal-overlay is-open";
    const modal = document.createElement("div");
    modal.className = "modal modal--flyer";
    modal.addEventListener("click", (e) => e.stopPropagation());

    const eventLabel = flyer.title?.trim() || "Weekly flyer event";
    const eventDesc = flyer.description?.trim() || "Event details on request.";
    const venueLabel = club
      ? `${club.name}${club.locationTag?.trim() ? ` · ${club.locationTag.trim()}` : ""}`
      : flyer.clubSlug;
    const pricingBits = [
      club?.entryPricingWomen?.trim() ? `Women: ${club.entryPricingWomen.trim()}` : "",
      club?.entryPricingMen?.trim() ? `Men: ${club.entryPricingMen.trim()}` : "",
      club?.minSpend?.trim() ? `Min spend: ${club.minSpend.trim()}` : "",
    ].filter(Boolean);
    const pricing = pricingBits.length
      ? pricingBits.join(" · ")
      : "Pricing varies by date and table tier.";
    const hasPerformer =
      /\b(perform|dj|lineup|artist|live)\b/i.test(eventDesc) ||
      /\b(perform|dj|lineup|artist|live)\b/i.test(eventLabel);
    const performers = hasPerformer
      ? eventDesc
      : "Performers/lineup announced by the venue for this date.";
    const imageUrl = flyer.imageUrl?.trim() || flyer.imagePath?.trim() || "";
    const clubHref = `/club/${encodeURIComponent(flyer.clubSlug)}`;

    modal.innerHTML = `
      <button type="button" class="modal__close" data-flyer-close aria-label="Close">×</button>
      <div class="flyer-modal__layout">
        <div class="flyer-modal__media">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(eventLabel)}" loading="lazy" />` : `<div class="flyer-modal__placeholder">No flyer image</div>`}</div>
        <div class="flyer-modal__info">
          <h3>${escapeHtml(eventLabel)}</h3>
          <p class="flyer-modal__meta"><strong>When:</strong> ${escapeHtml(flyer.eventDate || "Date TBC")}</p>
          <p class="flyer-modal__meta"><strong>Where:</strong> ${escapeHtml(venueLabel)}</p>
          <p class="flyer-modal__meta"><strong>Pricing:</strong> ${escapeHtml(pricing)}</p>
          <p class="flyer-modal__meta"><strong>Performing / Event:</strong> ${escapeHtml(performers)}</p>
          <p class="flyer-modal__desc">${escapeHtml(eventDesc)}</p>
          <div class="flyer-modal__actions">
            <button type="button" class="cc-btn cc-btn--gold" data-flyer-attend>Attend event</button>
            <a class="cc-btn cc-btn--ghost" href="${escapeHtml(clubHref)}">Go to club page</a>
          </div>
        </div>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.classList.add("no-scroll");

    const close = () => closeFlyerModal();
    overlay.addEventListener("click", close);
    modal.querySelector("[data-flyer-close]")?.addEventListener("click", close);
    modal.querySelector("[data-flyer-attend]")?.addEventListener("click", () => {
      if (club && requestHost) {
        closeFlyerModal();
        const clubDates = (flyersByClub[club.slug] ?? [])
          .map((f) => f.eventDate?.trim())
          .filter(Boolean) as string[];
        openVenueRequestModal({
          host: requestHost,
          kind: "guestlist",
          club,
          clubOptions: sorted.map((c) => ({
            slug: c.slug,
            name: c.name,
            locationTag: c.locationTag,
          })),
          dateOptions: Array.from(new Set(clubDates)),
          preferredDate: flyer.eventDate,
        });
      }
    });
  }

  function openTopFlyerFromHost(): void {
    if (!flyerHost) return;
    const hit = flyerHost.querySelector("[data-top-flyer-slug]") as HTMLElement | null;
    const slug = hit?.dataset.topFlyerSlug?.trim() || "";
    const date = hit?.dataset.topFlyerDate?.trim() || "";
    if (!slug) return;
    const rows = flyersByClub[slug] ?? [];
    if (!rows.length) return;
    const selected =
      rows.find((f) => (date ? f.eventDate === date : true)) ??
      rows[0];
    const club = sorted.find((c) => c.slug === slug) ?? clubRows.find((c) => c.slug === slug);
    if (!club) return;
    openFlyerModal(selected, club);
  }

  document.getElementById("nl-carousel-track")?.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest("[data-slug]") as HTMLElement | null;
    const slug = card?.dataset.slug;
    if (slug) return;
  });

  clubsGrid?.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest("[data-slug]") as HTMLElement | null;
    const slug = card?.dataset.slug;
    if (slug) return;
  });
  flyerHost?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest("[data-top-flyer-slug]")) return;
    openTopFlyerFromHost();
  });
  flyerHost?.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest("[data-top-flyer-slug]")) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    openTopFlyerFromHost();
  });
  function bindCarouselNav(
    track: HTMLElement | null,
    prevBtn: HTMLElement | null,
    nextBtn: HTMLElement | null,
  ): void {
    if (!track || !prevBtn || !nextBtn) return;
    const move = (dir: -1 | 1) => {
      const card = track.querySelector(".nl-carousel__slide") as HTMLElement | null;
      const amount = card ? Math.max(card.offsetWidth + 16, 260) : 320;
      track.parentElement?.scrollBy({ left: dir * amount, behavior: "smooth" });
    };
    prevBtn.addEventListener("click", () => move(-1));
    nextBtn.addEventListener("click", () => move(1));
  }
  bindCarouselNav(
    featuredCarousel,
    document.getElementById("nl-carousel-prev"),
    document.getElementById("nl-carousel-next"),
  );
  bindCarouselNav(
    flyerCarousel,
    document.getElementById("nl-flyer-carousel-prev"),
    document.getElementById("nl-flyer-carousel-next"),
  );
  flyerCarousel?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement | null;
    const card = target?.closest("[data-flyer-slug]") as HTMLElement | null;
    if (!card) return;
    const slug = card.dataset.flyerSlug?.trim() || "";
    const date = card.dataset.flyerDate?.trim() || "";
    if (!slug) return;
    const rows = flyersByClub[slug] ?? [];
    if (!rows.length) return;
    const selected = rows.find((f) => (date ? f.eventDate === date : true)) ?? rows[0];
    const club = sorted.find((c) => c.slug === slug);
    openFlyerModal(selected, club);
  });
  flyerCarousel?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const target = e.target as HTMLElement | null;
    const card = target?.closest("[data-flyer-slug]") as HTMLElement | null;
    if (!card) return;
    e.preventDefault();
    const slug = card.dataset.flyerSlug?.trim() || "";
    const date = card.dataset.flyerDate?.trim() || "";
    if (!slug) return;
    const rows = flyersByClub[slug] ?? [];
    if (!rows.length) return;
    const selected = rows.find((f) => (date ? f.eventDate === date : true)) ?? rows[0];
    const club = sorted.find((c) => c.slug === slug);
    openFlyerModal(selected, club);
  });

  const venueParam = getQueryVenue();
  if (venueParam && clubsGrid) {
    requestAnimationFrame(() => {
      clubsGrid
        .querySelector(`[data-slug="${CSS.escape(venueParam)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
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
      if (!fullName)
        form.querySelector('[name="full_name"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (!validateEmail(email))
        form.querySelector('[name="email"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      if (!whenWhere)
        form.querySelector('[name="when_where"]')?.closest(".cc-field")?.classList.add("cc-field--error");
      showFormError(errorEl, "Please check the highlighted fields.");
      return;
    }
    const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
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

  void (async () => {
    const guestEvents = await fetchGuestlistEventContexts().catch(
      () => [] as GuestlistEventContext[],
    );
    if (!guestEvents.length) return;
    const bySlug = new Map<string, GuestlistEventContext[]>();
    for (const ev of guestEvents) {
      const k = ev.clubSlug.trim();
      if (!k) continue;
      if (!bySlug.has(k)) bySlug.set(k, []);
      bySlug.get(k)!.push(ev);
    }
    const strip = (slug: string) => {
      const ev = bySlug.get(slug)?.[0];
      if (!ev) return "";
      return `Guestlist ${ev.status}: ${ev.attended}/${ev.signups} attended (${Math.round(ev.conversion * 100)}% conversion)`;
    };
    guestlistHintBySlug = new Map();
    for (const club of withOrder) {
      const slug = club.slug?.trim();
      if (!slug) continue;
      const text = strip(slug);
      if (text) guestlistHintBySlug.set(slug, text);
    }
    renderGuestlistHints();
  })();
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
