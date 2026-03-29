import { fetchClubs } from "../data/fetch-data";
import type { Club } from "../types";
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

  const clubs = await fetchClubs().catch(() => [] as Club[]);
  const mapEl = document.getElementById("venue-map");
  if (!mapEl) return;

  const sidebar = document.getElementById("map-sidebar");
  const toggle = document.getElementById("map-sidebar-toggle");
  toggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("is-expanded");
    const open = sidebar?.classList.contains("is-expanded");
    toggle.setAttribute("aria-expanded", String(!!open));
  });
  if (window.innerWidth >= 900) sidebar?.classList.add("is-expanded");

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
    center: [-0.12, 51.51],
    zoom: 11.5,
    attributionControl: true,
  });

  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    "top-right",
  );

  function fillSidebar(c: Club): void {
    const quote = document.getElementById("sidebar-experience");
    const tier = document.getElementById("sidebar-tier");
    const spend = document.getElementById("sidebar-spend");
    const amenitiesEl = document.getElementById("sidebar-amenities");
    const thumbs = document.getElementById("sidebar-thumbs");
    if (quote) quote.textContent = c.longDescription;
    if (tier) tier.textContent = c.accessTier;
    if (spend) spend.textContent = c.minSpend;
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
  }

  function focusSidebarPanel(): void {
    const inner = document.querySelector(".map-sidebar__inner");
    if (inner instanceof HTMLElement) inner.scrollTop = 0;
    sidebar?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function selectClub(c: Club): void {
    fillSidebar(c);
    const url = new URL(window.location.href);
    url.searchParams.set("venue", c.slug);
    window.history.replaceState({}, "", url);
    if (window.innerWidth < 900) sidebar?.classList.add("is-expanded");
    map.easeTo({
      center: [c.lng, c.lat],
      zoom: Math.max(map.getZoom(), 13),
      duration: 550,
    });
    requestAnimationFrame(() => {
      focusSidebarPanel();
    });
  }

  for (const c of clubs) {
    if (!c.lat || !c.lng) continue;
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
    new maplibregl.Marker({ element: wrap, anchor: "bottom" })
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
  const initial =
    clubs.find((c) => c.slug === paramSlug) || clubs[0] || null;
  if (initial) {
    fillSidebar(initial);
    map.jumpTo({ center: [initial.lng, initial.lat], zoom: 13 });
    if (window.innerWidth < 900) {
      sidebar?.classList.add("is-expanded");
      requestAnimationFrame(() => focusSidebarPanel());
    }
  }

  document.getElementById("map-zoom-in")?.addEventListener("click", () => {
    map.zoomIn({ duration: 300 });
  });
  document.getElementById("map-zoom-out")?.addEventListener("click", () => {
    map.zoomOut({ duration: 300 });
  });
  document.getElementById("map-recenter")?.addEventListener("click", () => {
    if (initial) map.flyTo({ center: [initial.lng, initial.lat], zoom: 13 });
    else map.flyTo({ center: [-0.12, 51.51], zoom: 11.5 });
  });

  document.getElementById("sidebar-book")?.addEventListener("click", () => {
    window.location.href = `enquiry.html?context=${encodeURIComponent("Private table")}`;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
