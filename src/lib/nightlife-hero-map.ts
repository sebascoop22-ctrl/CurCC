import type { Club } from "../types";

function iconForVenue(t: Club["venueType"]): string {
  return t === "dining" ? "🍽" : "🍸";
}

const DEFAULT_CENTER: [number, number] = [-0.135, 51.51];
const DEFAULT_ZOOM = 11.2;

/**
 * Embedded overview map for the nightlife landing hero (all clubs with lat/lng).
 */
export async function initNightlifeHeroMap(clubs: Club[]): Promise<void> {
  const mapEl = document.getElementById("nightlife-hero-map");
  const toggle = document.getElementById("nl-hero-map-toggle");
  const panel = document.getElementById("nl-hero-map-panel");
  const heroInner = document.querySelector(
    ".nl-landing-hero .nl-landing-hero__inner",
  ) as HTMLElement | null;
  if (!mapEl) return;

  const withGeo = clubs.filter((c) => c.lat && c.lng);
  if (!withGeo.length) {
    mapEl.innerHTML =
      '<p class="nl-hero-map__empty">Venue coordinates will appear on the map when available.</p>';
    return;
  }

  const { default: maplibregl } = await import("maplibre-gl");
  await import("maplibre-gl/dist/maplibre-gl.css");

  const lngs = withGeo.map((c) => c.lng);
  const lats = withGeo.map((c) => c.lat);
  const bounds = new maplibregl.LngLatBounds(
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  );

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
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    attributionControl: false,
  });

  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    "top-right",
  );

  try {
    map.fitBounds(bounds, { padding: 48, maxZoom: 13.5, duration: 0 });
  } catch {
    map.setCenter(DEFAULT_CENTER);
    map.setZoom(DEFAULT_ZOOM);
  }

  let selectedMarkerRoot: HTMLElement | null = null;

  for (const c of withGeo) {
    const root = document.createElement("div");
    root.className = "nl-hero-map__marker-root";
    const wrap = document.createElement("div");
    wrap.className = "nl-hero-map__marker-wrap";
    const label = document.createElement("div");
    label.className = "nl-hero-map__marker-label";
    label.textContent = c.name.toUpperCase();
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nl-hero-map__marker-hit";
    btn.title = c.name;
    btn.setAttribute("aria-label", `${c.name} — open club page`);
    const face = document.createElement("span");
    face.className = "nl-hero-map__marker-face";
    face.setAttribute("aria-hidden", "true");
    face.textContent = iconForVenue(c.venueType);
    btn.appendChild(face);
    const setHovered = (on: boolean) => {
      root.classList.toggle("is-hovered", on);
    };
    const setSelected = () => {
      if (selectedMarkerRoot && selectedMarkerRoot !== root) {
        selectedMarkerRoot.classList.remove("is-active");
      }
      root.classList.add("is-active");
      selectedMarkerRoot = root;
    };
    btn.addEventListener("mouseenter", () => setHovered(true));
    btn.addEventListener("mouseleave", () => setHovered(false));
    btn.addEventListener("focus", () => setHovered(true));
    btn.addEventListener("blur", () => setHovered(false));
    btn.addEventListener("click", () => {
      setSelected();
      window.location.href = `/club/${encodeURIComponent(c.slug)}`;
    });
    wrap.appendChild(label);
    wrap.appendChild(btn);
    root.appendChild(wrap);
    new maplibregl.Marker({ element: root, anchor: "bottom" })
      .setLngLat([c.lng, c.lat])
      .addTo(map);
  }

  let expanded = true;
  function setExpanded(open: boolean): void {
    expanded = open;
    panel?.classList.toggle("is-collapsed", !open);
    heroInner?.classList.toggle("nl-landing-hero__inner--map-collapsed", !open);
    toggle?.setAttribute("aria-expanded", String(open));
    if (toggle) {
      toggle.setAttribute("title", open ? "Collapse map" : "Expand map");
      const chev = toggle.querySelector(".nl-hero-map-toggle__chev");
      if (chev) chev.textContent = open ? "›" : "‹";
    }
    map.resize();
  }

  if (window.innerWidth < 900) setExpanded(false);
  else setExpanded(true);

  toggle?.addEventListener("click", () => setExpanded(!expanded));
  window.addEventListener("resize", () => {
    map.resize();
  });
}
