import type { Club } from "../types";

function iconForVenue(t: Club["venueType"]): string {
  return t === "dining" ? "🍽" : "🍸";
}

export async function initClubDetailMap(club: Club): Promise<void> {
  const mapEl = document.getElementById("club-detail-map");
  if (!mapEl || !club.lat || !club.lng) return;

  const { default: maplibregl } = await import("maplibre-gl");
  await import("maplibre-gl/dist/maplibre-gl.css");

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
    center: [club.lng, club.lat],
    zoom: 14.5,
    attributionControl: false,
  });

  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    "top-right",
  );

  const root = document.createElement("div");
  root.className = "club-detail-map__marker-root";
  const wrap = document.createElement("div");
  wrap.className = "club-detail-map__marker-wrap";
  const label = document.createElement("div");
  label.className = "club-detail-map__marker-label";
  label.textContent = club.name.toUpperCase();
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "club-detail-map__marker-hit";
  btn.title = club.name;
  btn.setAttribute("aria-label", club.name);
  btn.setAttribute("tabindex", "0");
  const face = document.createElement("span");
  face.className = "club-detail-map__marker-face";
  face.setAttribute("aria-hidden", "true");
  face.textContent = iconForVenue(club.venueType);
  btn.appendChild(face);
  btn.addEventListener("mouseenter", () => root.classList.add("is-hovered"));
  btn.addEventListener("mouseleave", () => root.classList.remove("is-hovered"));
  btn.addEventListener("focus", () => root.classList.add("is-hovered"));
  btn.addEventListener("blur", () => root.classList.remove("is-hovered"));
  btn.addEventListener("click", () => {
    root.classList.add("is-active");
  });
  wrap.appendChild(label);
  wrap.appendChild(btn);
  root.appendChild(wrap);

  new maplibregl.Marker({ element: root, anchor: "bottom" })
    .setLngLat([club.lng, club.lat])
    .addTo(map);

  function resizeMap(): void {
    map.resize();
  }

  map.once("load", resizeMap);
  requestAnimationFrame(resizeMap);
  window.addEventListener("resize", resizeMap);
}
