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
import "../styles/pages/map.css";

function iconForVenue(t: Club["venueType"]): string {
  return t === "dining" ? "🍽" : "🍸";
}

function getQueryVenue(): string | null {
  const q = new URLSearchParams(window.location.search).get("venue");
  return q ? decodeURIComponent(q) : null;
}

export async function initNightlifeMap(): Promise<void> {
  const { default: maplibregl } = await import("maplibre-gl");
  await import("maplibre-gl/dist/maplibre-gl.css");

  const [clubs, flyers, assignments, guestContexts] = await Promise.all([
    fetchClubs().catch(() => [] as Club[]),
    fetchClubFlyers().catch(() => [] as ClubFlyer[]),
    fetchPromoterAssignments().catch(() => [] as PromoterShiftAssignment[]),
    fetchGuestlistEventContexts().catch(() => [] as GuestlistEventContext[]),
  ]);
  const hasAnyFlyers = flyers.length > 0;
  const flyersByClub = groupFlyersByClubSlug(flyers);
  const assignmentsByClub = groupAssignmentsByClub(assignments);
  const guestContextByClub = groupGuestlistContextsByClub(guestContexts);
  const mapEl = document.getElementById("venue-map");
  if (!mapEl) return;

  const requestHost = document.getElementById("cc-venue-request-root");

  const sidebar = document.getElementById("map-sidebar");
  const toggle = document.getElementById("map-sidebar-toggle");
  toggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("is-expanded");
    const open = sidebar?.classList.contains("is-expanded");
    toggle.setAttribute("aria-expanded", String(!!open));
  });
  if (window.innerWidth >= 900) sidebar?.classList.add("is-expanded");

  /** Default London overview when no venue is selected — keep in sync with recenter fallback */
  const defaultMapCenter: [number, number] = [-0.165, 51.505];
  const defaultMapZoom = 13.0;

  const map = new maplibregl.Map({
    container: mapEl,
    style: {
      version: 8,
      sources: {
        carto: {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap &copy; CARTO',
        },
      },
      layers: [{ id: "carto", type: "raster", source: "carto" }],
    },
    center: defaultMapCenter,
    zoom: defaultMapZoom,
    attributionControl: false,
  });

  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    "top-right",
  );

  /** Screen-size markers when zoomed out (less overlap); floor so pins stay visible. */
  const MARKER_SCALE_MIN = 0.3;
  const MARKER_SCALE_ZOOM_LOW = 9.25;
  const MARKER_SCALE_ZOOM_HIGH = 14.25;

  function markerScaleFromZoom(zoom: number): number {
    const t =
      (zoom - MARKER_SCALE_ZOOM_LOW) /
      (MARKER_SCALE_ZOOM_HIGH - MARKER_SCALE_ZOOM_LOW);
    const s = MARKER_SCALE_MIN + (1 - MARKER_SCALE_MIN) * t;
    return Math.min(1, Math.max(MARKER_SCALE_MIN, s));
  }

  const markerScaleTargets: HTMLElement[] = [];
  let markerScaleRaf = 0;
  let sidebarMode: "featured" | "flyers" = "featured";
  let selectedFlyerIndex = 0;
  function applyMarkerScales(): void {
    const z = map.getZoom();
    const s = markerScaleFromZoom(z);
    for (const el of markerScaleTargets) {
      el.style.transformOrigin = "bottom center";
      el.style.transform = `scale(${s})`;
    }
  }
  function scheduleMarkerScales(): void {
    if (markerScaleRaf) return;
    markerScaleRaf = requestAnimationFrame(() => {
      markerScaleRaf = 0;
      applyMarkerScales();
    });
  }

  function fillSidebar(c: Club): void {
    const quote = document.getElementById("sidebar-experience");
    const bestNights = document.getElementById("sidebar-best-nights");
    const amenitiesEl = document.getElementById("sidebar-amenities");
    const thumbs = document.getElementById("sidebar-thumbs");
    const directions = document.getElementById(
      "sidebar-directions",
    ) as HTMLAnchorElement | null;
    const chauffeur = document.getElementById(
      "sidebar-chauffeur",
    ) as HTMLAnchorElement | null;
    const travel = document.getElementById("sidebar-travel");
    const guideRoot = document.getElementById("sidebar-guide");
    const pricingDetails = document.getElementById(
      "sidebar-pricing-details",
    ) as HTMLDetailsElement | null;
    const knownForList = document.getElementById("sidebar-known-for-list");
    const knownForBlock = document.getElementById("sidebar-known-for-block");
    const entryBlock = document.getElementById("sidebar-entry-block");
    const entryWomen = document.getElementById("sidebar-entry-women");
    const entryMen = document.getElementById("sidebar-entry-men");
    const entryWomenWrap = document.getElementById("sidebar-entry-women-wrap");
    const entryMenWrap = document.getElementById("sidebar-entry-men-wrap");
    const tablesBlock = document.getElementById("sidebar-tables-block");
    const tsStd = document.getElementById("sidebar-tables-standard");
    const tsLux = document.getElementById("sidebar-tables-luxury");
    const tsVip = document.getElementById("sidebar-tables-vip");
    const tsStdWrap = document.getElementById("sidebar-tables-standard-wrap");
    const tsLuxWrap = document.getElementById("sidebar-tables-luxury-wrap");
    const tsVipWrap = document.getElementById("sidebar-tables-vip-wrap");
    const flyerBlock = document.getElementById("sidebar-flyers-block");
    const flyerCard = document.getElementById("sidebar-flyer-card");
    const flyerIndex = document.getElementById("sidebar-flyer-index");
    if (quote) quote.textContent = c.longDescription;
    if (bestNights)
      bestNights.textContent = c.bestVisitDays.length
        ? c.bestVisitDays.join(" · ")
        : "—";
    const kfItems = c.knownFor?.filter((x) => x.trim()) ?? [];
    const ew = c.entryPricingWomen?.trim() ?? "";
    const em = c.entryPricingMen?.trim() ?? "";
    const tst = c.tablesStandard?.trim() ?? "";
    const tlx = c.tablesLuxury?.trim() ?? "";
    const tv = c.tablesVip?.trim() ?? "";
    const hasKnown = kfItems.length > 0;
    const hasEntry = !!(ew || em);
    const hasTables = !!(tst || tlx || tv);
    const hasPricing = hasEntry || hasTables;
    const hasGuide = hasKnown || hasPricing;
    if (guideRoot) {
      guideRoot.hidden = !hasGuide;
    }
    if (pricingDetails) {
      pricingDetails.hidden = !hasPricing;
      pricingDetails.open = false;
    }
    if (knownForList && knownForBlock) {
      if (hasKnown) {
        knownForList.innerHTML = kfItems
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("");
        knownForBlock.hidden = false;
      } else {
        knownForList.innerHTML = "";
        knownForBlock.hidden = true;
      }
    }
    if (entryBlock && entryWomen && entryMen && entryWomenWrap && entryMenWrap) {
      entryWomen.textContent = ew;
      entryMen.textContent = em;
      entryWomenWrap.hidden = !ew;
      entryMenWrap.hidden = !em;
      entryBlock.hidden = !hasEntry;
    }
    if (
      tablesBlock &&
      tsStd &&
      tsLux &&
      tsVip &&
      tsStdWrap &&
      tsLuxWrap &&
      tsVipWrap
    ) {
      tsStd.textContent = tst;
      tsLux.textContent = tlx;
      tsVip.textContent = tv;
      tsStdWrap.hidden = !tst;
      tsLuxWrap.hidden = !tlx;
      tsVipWrap.hidden = !tv;
      tablesBlock.hidden = !hasTables;
    }
    if (amenitiesEl) {
      amenitiesEl.innerHTML = c.amenities
        .map((a) => `<li>${escapeHtml(a)}</li>`)
        .join("");
    }
    if (thumbs) {
      const shown = c.images.slice(0, 4);
      const rest = Math.max(0, c.images.length - shown.length);
      const imgs = shown
        .map(
          (src) =>
            `<img src="${src}" alt="" width="72" height="72" loading="lazy" />`,
        )
        .join("");
      const more =
        rest > 0
          ? `<span class="thumb-more" aria-hidden="true">+${rest} more</span>`
          : "";
      thumbs.innerHTML = imgs + more;
    }
    if (directions && travel) {
      if (c.lat && c.lng) {
        directions.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${c.lat},${c.lng}`)}`;
        directions.removeAttribute("aria-disabled");
        travel.classList.remove("map-sidebar__travel--disabled");
      } else {
        directions.href = "#";
        directions.setAttribute("aria-disabled", "true");
        travel.classList.add("map-sidebar__travel--disabled");
      }
    }
    if (chauffeur) {
      const ctx = c.address
        ? `Chauffeur pickup — ${c.name} (${c.address})`
        : `Chauffeur pickup — ${c.name}`;
      chauffeur.href = `/enquiry?context=${encodeURIComponent(ctx)}`;
    }
    const guestBlock = document.getElementById("sidebar-guestlist-block");
    const guestLines = document.getElementById("sidebar-guestlist-lines");
    const promotersBlock = document.getElementById("sidebar-promoters-block");
    const promotersLines = document.getElementById("sidebar-promoters-lines");
    if (guestBlock && guestLines) {
      const context = guestContextByClub[c.slug]?.[0] ?? null;
      if (c.guestlists?.length) {
        guestBlock.hidden = false;
        guestLines.innerHTML =
          c.guestlists
          .map((g) => {
            const days = g.days.length ? g.days.join(" · ") : "—";
            const rec = g.recurrence === "one_off" ? "One-off" : "Weekly";
            const note = g.notes ? ` — ${escapeHtml(g.notes)}` : "";
            return `<li>${escapeHtml(days)} · ${rec}${note}</li>`;
          })
          .join("") +
          (context
            ? `<li>Tonight: ${context.attended}/${context.signups} attended (${Math.round(context.conversion * 100)}% conversion)</li>`
            : "");
      } else {
        if (context) {
          guestBlock.hidden = false;
          guestLines.innerHTML = `<li>Tonight: ${context.attended}/${context.signups} attended (${Math.round(context.conversion * 100)}% conversion)</li>`;
        } else {
          guestBlock.hidden = true;
          guestLines.innerHTML = "";
        }
      }
    }
    if (promotersBlock && promotersLines) {
      const rows = assignmentsByClub[c.slug] ?? [];
      if (rows.length) {
        promotersBlock.hidden = false;
        promotersLines.innerHTML = rows
          .map(
            (row) =>
              `<li><button type="button" class="map-sidebar__promo-gl" data-promoter-gl data-promoter-name="${escapeHtml(row.promoterName)}"><span class="map-sidebar__promo-gl-name">${escapeHtml(row.promoterName)}</span><span class="map-sidebar__promo-gl-action">Join guestlist</span></button></li>`,
          )
          .join("");
      } else {
        promotersBlock.hidden = true;
        promotersLines.innerHTML = "";
      }
    }
    if (flyerBlock && flyerCard && flyerIndex) {
      const rows = flyersByClub[c.slug] ?? [];
      if (sidebarMode !== "flyers") {
        flyerBlock.hidden = true;
      } else if (!rows.length) {
        flyerBlock.hidden = false;
        flyerIndex.textContent = "0 / 0";
        flyerCard.innerHTML = `<p class="map-sidebar__guide-text">No flyers uploaded for this venue yet.</p>`;
      } else {
        flyerBlock.hidden = false;
        selectedFlyerIndex =
          ((selectedFlyerIndex % rows.length) + rows.length) % rows.length;
        const flyer = rows[selectedFlyerIndex];
        flyerIndex.textContent = `${selectedFlyerIndex + 1} / ${rows.length}`;
        const img = flyer.imageUrl
          ? `<img src="${escapeHtml(flyer.imageUrl)}" alt="${escapeHtml(flyer.title || "Club flyer")}" loading="lazy" />`
          : "";
        flyerCard.innerHTML = `${img}
          <p class="map-sidebar__guide-text" style="margin:0 0 0.35rem;color:var(--cc-cream)">${escapeHtml(flyer.title || "Weekly flyer")}</p>
          <p class="map-sidebar__guide-text" style="margin:0 0 0.35rem">${escapeHtml(flyer.eventDate)}</p>
          <p class="map-sidebar__guide-text" style="margin:0">${escapeHtml(flyer.description || "Club promotion")}</p>`;
      }
    }
  }

  function focusSidebarPanel(): void {
    const inner = document.querySelector(".map-sidebar__inner");
    if (inner instanceof HTMLElement) inner.scrollTop = 0;
    sidebar?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  let selectedClub: Club | null = null;

  document.getElementById("sidebar-promoters-block")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(
      "[data-promoter-gl]",
    ) as HTMLButtonElement | null;
    if (!btn || !selectedClub) return;
    const promoterName = btn.dataset.promoterName?.trim();
    if (!promoterName) return;
    e.preventDefault();
    openVenueRequestModal({
      host: requestHost,
      kind: "guestlist",
      club: selectedClub,
      promoterName,
    });
  });

  const modeFeaturedBtn = document.getElementById("map-mode-featured");
  const modeFlyersBtn = document.getElementById("map-mode-flyers");
  modeFeaturedBtn?.addEventListener("click", () => {
    sidebarMode = "featured";
    modeFeaturedBtn.classList.add("is-active");
    modeFlyersBtn?.classList.remove("is-active");
    modeFeaturedBtn.setAttribute("aria-selected", "true");
    modeFlyersBtn?.setAttribute("aria-selected", "false");
    if (selectedClub) fillSidebar(selectedClub);
  });
  modeFlyersBtn?.addEventListener("click", () => {
    if (!hasAnyFlyers) return;
    sidebarMode = "flyers";
    modeFlyersBtn.classList.add("is-active");
    modeFeaturedBtn?.classList.remove("is-active");
    modeFlyersBtn.setAttribute("aria-selected", "true");
    modeFeaturedBtn?.setAttribute("aria-selected", "false");
    selectedFlyerIndex = 0;
    if (selectedClub) fillSidebar(selectedClub);
  });
  document.getElementById("sidebar-flyer-prev")?.addEventListener("click", () => {
    selectedFlyerIndex -= 1;
    if (selectedClub) fillSidebar(selectedClub);
  });
  document.getElementById("sidebar-flyer-next")?.addEventListener("click", () => {
    selectedFlyerIndex += 1;
    if (selectedClub) fillSidebar(selectedClub);
  });
  if (!hasAnyFlyers && modeFlyersBtn) {
    modeFlyersBtn.setAttribute("disabled", "true");
    modeFlyersBtn.setAttribute("aria-disabled", "true");
  }

  function updateSidebarCtas(): void {
    const book = document.getElementById(
      "sidebar-book",
    ) as HTMLButtonElement | null;
    const gl = document.getElementById(
      "sidebar-guestlist",
    ) as HTMLButtonElement | null;
    const ok = !!selectedClub;
    if (book) book.disabled = !ok;
    if (gl) gl.disabled = !ok;
  }

  function selectClub(c: Club): void {
    selectedClub = c;
    selectedFlyerIndex = 0;
    fillSidebar(c);
    updateSidebarCtas();
    const url = new URL(window.location.href);
    url.searchParams.set("venue", c.slug);
    window.history.replaceState({}, "", url);
    if (window.innerWidth < 900) sidebar?.classList.add("is-expanded");
    if (c.lat && c.lng) {
      map.easeTo({
        center: [c.lng, c.lat],
        zoom: Math.max(map.getZoom(), 14),
        duration: 550,
      });
    }
    requestAnimationFrame(() => {
      focusSidebarPanel();
    });
  }

  for (const c of clubs) {
    if (!c.lat || !c.lng) continue;
    const root = document.createElement("div");
    root.className = "map-marker-root";
    const wrap = document.createElement("div");
    wrap.className = "marker-wrap";
    const label = document.createElement("div");
    label.className = "cc-marker-label";
    label.textContent = c.name.toUpperCase();
    const el = document.createElement("div");
    el.className = "cc-marker";
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.textContent = iconForVenue(c.venueType);
    el.title = c.name;
    wrap.appendChild(label);
    wrap.appendChild(el);
    root.appendChild(wrap);
    markerScaleTargets.push(wrap);
    new maplibregl.Marker({ element: root, anchor: "bottom" })
      .setLngLat([c.lng, c.lat])
      .addTo(map);
    el.addEventListener("click", () => selectClub(c));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectClub(c);
      }
    });
  }

  const paramSlug = getQueryVenue();
  selectedClub = paramSlug
    ? clubs.find((c) => c.slug === paramSlug) ?? null
    : null;

  function syncMarkerSizesOnMapReady(): void {
    applyMarkerScales();
  }
  if (map.loaded()) syncMarkerSizesOnMapReady();
  else map.once("load", syncMarkerSizesOnMapReady);
  map.on("zoom", scheduleMarkerScales);
  map.on("zoomend", applyMarkerScales);

  if (selectedClub) {
    fillSidebar(selectedClub);
    updateSidebarCtas();
    if (selectedClub.lat && selectedClub.lng) {
      map.jumpTo({
        center: [selectedClub.lng, selectedClub.lat],
        zoom: 14,
      });
    }
    if (window.innerWidth < 900) {
      sidebar?.classList.add("is-expanded");
      requestAnimationFrame(() => focusSidebarPanel());
    }
  } else {
    updateSidebarCtas();
  }

  document.getElementById("map-zoom-in")?.addEventListener("click", () => {
    map.zoomIn({ duration: 300 });
  });
  document.getElementById("map-zoom-out")?.addEventListener("click", () => {
    map.zoomOut({ duration: 300 });
  });
  document.getElementById("map-recenter")?.addEventListener("click", () => {
    if (selectedClub?.lat && selectedClub?.lng) {
      map.flyTo({
        center: [selectedClub.lng, selectedClub.lat],
        zoom: 14,
      });
    } else {
      map.flyTo({ center: defaultMapCenter, zoom: defaultMapZoom });
    }
  });

  function wireVenueRequest(
    id: string,
    kind: VenueRequestKind,
  ): void {
    document.getElementById(id)?.addEventListener("click", () => {
      if (!selectedClub) return;
      openVenueRequestModal({
        host: requestHost,
        kind,
        club: selectedClub,
      });
    });
  }
  wireVenueRequest("sidebar-book", "private_table");
  wireVenueRequest("sidebar-guestlist", "guestlist");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
