import type { Club, ClubFlyer } from "../types";

export type RankedFlyerPreview = {
  clubSlug: string;
  imageUrl: string;
  title: string;
  description: string;
  clubName: string;
  eventDate: string;
};

export function rankFlyersForHero(
  clubs: Club[],
  flyersByClub: Record<string, ClubFlyer[]>,
): RankedFlyerPreview[] {
  type Ranked = RankedFlyerPreview & { sortOrder: number; eventDateKey: string };
  const list: Ranked[] = [];
  for (const club of clubs) {
    const rows = flyersByClub[club.slug] ?? [];
    for (const f of rows) {
      if (!f.imageUrl?.trim() && !f.imagePath?.trim()) continue;
      const imageUrl = f.imageUrl?.trim() || f.imagePath?.trim() || "";
      list.push({
        clubSlug: club.slug,
        imageUrl,
        title: f.title || "Weekly flyer",
        description: f.description || "Club promotion",
        clubName: club.name,
        eventDate: f.eventDate,
        sortOrder: f.sortOrder,
        eventDateKey: f.eventDate,
      });
    }
  }
  list.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.eventDateKey.localeCompare(b.eventDateKey);
  });
  return list;
}

export function renderTopFlyerHostHtml(flyers: RankedFlyerPreview[]): string {
  const f = flyers[0];
  if (!f) {
    return `<p class="nl-hero-flyer__empty">Weekly flyers will appear here when available.</p>`;
  }
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  const img = f.imageUrl
    ? `<img src="${esc(f.imageUrl)}" alt="${esc(f.title)}" width="480" height="600" loading="lazy" />`
    : "";
  return `<div class="nl-hero-flyer" role="button" tabindex="0" data-top-flyer-slug="${esc(f.clubSlug)}" data-top-flyer-date="${esc(f.eventDate)}">
    ${img}
    <div class="nl-hero-flyer__meta">
      <p class="nl-hero-flyer__eyebrow">Top flyer</p>
      <h3 class="nl-hero-flyer__title">${esc(f.title)}</h3>
      <p class="nl-hero-flyer__club">${esc(f.clubName)} · ${esc(f.eventDate)}</p>
      <button type="button" class="cc-btn cc-btn--ghost nl-hero-flyer__open" data-top-flyer-open>Open flyer</button>
    </div>
  </div>`;
}
