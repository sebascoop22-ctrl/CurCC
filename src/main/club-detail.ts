import { initChrome } from "../chrome";
import "../styles/global.css";
import type { Club } from "../types";
import { initClubDetailMap } from "../lib/club-detail-map";
import {
  openVenueRequestModal,
  type VenueRequestKind,
} from "../components/venue-request-modal";
import { buildClubDetailMainHtml } from "../nightlife/club-detail-main-html";
import "../styles/pages/club-detail.css";

function parseSlugFromPath(): string {
  const m = window.location.pathname.match(/^\/club\/([^/]+)\/?$/);
  if (m?.[1]) return decodeURIComponent(m[1]);
  const q = new URLSearchParams(window.location.search).get("slug");
  return q ? decodeURIComponent(q) : "";
}

function readClubFromDom(): Club | null {
  const el = document.getElementById("cc-club-json");
  if (!el?.textContent?.trim()) return null;
  try {
    return JSON.parse(el.textContent) as Club;
  } catch {
    return null;
  }
}

async function fetchClubFallback(slug: string): Promise<Club | null> {
  try {
    const r = await fetch("/data/clubs.json", { cache: "no-store" });
    if (!r.ok) return null;
    const data = (await r.json()) as Club[];
    const q = slug.trim().toLowerCase();
    return data.find((c) => c.slug.toLowerCase() === q) ?? null;
  } catch {
    return null;
  }
}

initChrome("club");

void (async () => {
  const slug = parseSlugFromPath();
  let club = readClubFromDom();
  if (!club && slug) club = await fetchClubFallback(slug);
  const main =
    (document.getElementById("cc-club-main") as HTMLElement | null) ??
    (document.querySelector("main.club-detail") as HTMLElement | null);

  if (!club) {
    const msg =
      '<section class="club-detail__hero cc-container" style="padding:3rem 0"><div class="club-detail__hero-copy"><h1>Club not found</h1><p><a href="/">Back to Nightlife</a></p></div></section>';
    if (main) main.innerHTML = msg;
    else document.body.innerHTML = `<div class="cc-container" style="padding:3rem">${msg}</div>`;
    return;
  }

  const c = club;
  const jsonEl = document.getElementById("cc-club-json");
  if (jsonEl && !jsonEl.textContent?.trim()) {
    jsonEl.textContent = JSON.stringify(c).replace(/</g, "\\u003c");
  }

  if (main && !main.querySelector(".club-detail__hero")) {
    main.innerHTML = buildClubDetailMainHtml(c, []);
  }

  document.title = `${c.name} | Cooper Concierge`;
  void initClubDetailMap(c);

  const host = document.getElementById("cc-venue-request-root");
  const venueClickRoot =
    main ?? (document.querySelector("main.club-detail") as HTMLElement | null);

  /** Delegated: CTAs live in `.club-detail__cta-row`; host-specific guestlist sits in `.club-detail__promo-slide`. */
  venueClickRoot?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(
      "[data-vr-kind]",
    ) as HTMLElement | null;
    if (!btn || !host) return;
    const kind = btn.dataset.vrKind as VenueRequestKind | undefined;
    if (kind === "guestlist" || kind === "private_table" || kind === "venue_access") {
      const promoterName = btn.dataset.promoterName?.trim();
      openVenueRequestModal({
        host,
        kind,
        club: c,
        promoterName,
      });
    }
  });
})();
