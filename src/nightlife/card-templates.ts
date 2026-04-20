import type { Club } from "../types";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Compact card linking to club detail */
export function smallClubCardHtml(
  club: Club,
  opts: { hrefBase?: string; className?: string } = {},
): string {
  const base = opts.hrefBase ?? "";
  const href = `${base}/club/${encodeURIComponent(club.slug)}`;
  const img =
    club.discoveryCardImage?.trim() ||
    club.images?.[0]?.trim() ||
    "/media/nightlife/hero-atmosphere.svg";
  const cardTitle = club.discoveryCardTitle?.trim() || club.name;
  const cardBlurb =
    club.discoveryCardBlurb?.trim() || club.shortDescription || "";
  const locationTag = (club.locationTag || "").trim();
  const daysOpen = (club.daysOpen || "").trim();
  const entryWomen = (club.entryPricingWomen || "").trim();
  const entryMen = (club.entryPricingMen || "").trim();
  const bestVisitCsv = (club.bestVisitDays || [])
    .map((x) => x.trim())
    .filter(Boolean)
    .join(",");
  const galleryEnc = (club.images || [])
    .slice(0, 12)
    .map((u) => encodeURIComponent(u.trim()))
    .filter(Boolean)
    .join("|");
  const knownFor = (club.knownFor || [])
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(" · ");
  const cls = opts.className ?? "nl-card nl-card--small";
  return `<article class="${escapeHtml(cls)}" data-slug="${escapeHtml(club.slug)}" data-location-tag="${escapeHtml(locationTag)}" data-days-open="${escapeHtml(daysOpen)}" data-entry-women="${escapeHtml(entryWomen)}" data-entry-men="${escapeHtml(entryMen)}" data-best-visit="${escapeHtml(bestVisitCsv)}" data-gallery="${escapeHtml(galleryEnc)}" data-known-for="${escapeHtml(knownFor)}">
  <a class="nl-card__link" href="${escapeHtml(href)}">
    <div class="nl-card__media">
      <img src="${escapeHtml(img)}" alt="" width="400" height="250" loading="lazy" />
    </div>
    <div class="nl-card__body">
      <h3 class="nl-card__title">${escapeHtml(cardTitle)}</h3>
      <p class="nl-card__desc">${escapeHtml(cardBlurb)}</p>
    </div>
  </a>
</article>`;
}

export function carouselSlideHtml(
  club: Club,
  opts: { hrefBase?: string } = {},
): string {
  const inner = smallClubCardHtml(club, {
    ...opts,
    className: "nl-card nl-card--carousel",
  });
  return `<div class="nl-carousel__slide" role="group" aria-roledescription="slide">${inner}</div>`;
}
