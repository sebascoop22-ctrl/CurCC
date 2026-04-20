import {
  fetchClubFlyers,
  fetchClubs,
  fetchGuestlistEventContexts,
  groupFlyersByClubSlug,
} from "../data/fetch-data";
import type { Club, ClubFlyer, GuestlistEventContext } from "../types";
import {
  featuredClubsSorted,
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
    videos: videos.length ? videos : undefined,
    hasPartnership: raw.hasPartnership !== false,
    guestlists,
    reviews,
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

  const clubsGrid = document.getElementById("clubs-grid");
  const ssrHydrate = clubsGrid?.dataset.ssrHydrate === "grid";
  if (clubsGrid && !ssrHydrate) {
    clubsGrid.innerHTML = sorted.map((c) => smallClubCardHtml(c)).join("");
  }

  void initNightlifeHeroMap(sorted);
  initNightlifeDiscoverHover();

  const modeFeaturedBtn = document.getElementById("nightlife-mode-featured");
  const modeFlyersBtn = document.getElementById("nightlife-mode-flyers");
  const flyersPanel = document.getElementById("nightlife-flyers-panel");
  const flyerCard = document.getElementById("nightlife-flyer-card");
  const flyerTitle = document.getElementById("nightlife-flyers-title");
  const flyerPrev = document.getElementById("nightlife-flyer-prev");
  const flyerNext = document.getElementById("nightlife-flyer-next");
  const flyerIndex = document.getElementById("nightlife-flyer-index");
  let selectedClubSlug = sorted[0]?.slug ?? "";
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
    const club = sorted.find((c) => c.slug === selectedClubSlug);
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

  updateFlyerPanel();

  document.getElementById("nl-carousel-track")?.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest("[data-slug]") as HTMLElement | null;
    const slug = card?.dataset.slug;
    if (slug) {
      selectedClubSlug = slug;
      selectedFlyerIdx = 0;
      updateFlyerPanel();
    }
  });

  clubsGrid?.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest("[data-slug]") as HTMLElement | null;
    const slug = card?.dataset.slug;
    if (slug) {
      selectedClubSlug = slug;
      selectedFlyerIdx = 0;
      updateFlyerPanel();
    }
  });

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
    if (!selectedClubSlug) selectedClubSlug = sorted[0]?.slug ?? "";
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

  const venueParam = getQueryVenue();
  if (venueParam && clubsGrid) {
    requestAnimationFrame(() => {
      selectedClubSlug = venueParam;
      selectedFlyerIdx = 0;
      updateFlyerPanel();
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
    document.querySelectorAll("[data-slug].nl-card").forEach((el) => {
      const slug = (el as HTMLElement).dataset.slug;
      if (!slug) return;
      const text = strip(slug);
      if (!text) return;
      const hint = document.createElement("p");
      hint.className = "nl-card__hint";
      hint.textContent = text;
      el.querySelector(".nl-card__body")?.appendChild(hint);
    });
  })();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
