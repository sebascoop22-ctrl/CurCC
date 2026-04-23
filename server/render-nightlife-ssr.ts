import { renderTopFlyerHostHtml } from "../src/nightlife/flyer-rank.js";
import {
  featuredClubsSorted,
  sortClubsForDiscovery,
  type ClubWithSortMeta,
} from "../src/data/club-sort.js";
import { carouselSlideHtml, smallClubCardHtml } from "../src/nightlife/card-templates.js";
import { escapeAttr } from "./html-escape.js";
import { loadSsrAssetMap, linkTagsFor } from "./ssr-assets.js";
import { siteOrigin } from "./site-base.js";
import type { ClubRow } from "./catalog-fetch";

export function buildNightlifeSsrHtml(opts: {
  pathname: string;
  clubRows: ClubRow[];
  rankedFlyers: {
    clubSlug?: string;
    imageUrl: string;
    title: string;
    description?: string;
    clubName: string;
    eventDate: string;
  }[];
}): string {
  const origin = siteOrigin();
  const canonicalPath = opts.pathname === "/nightlife" ? "/nightlife" : "/";
  const canonical = `${origin}${canonicalPath === "/" ? "/" : canonicalPath}`;
  const assets = loadSsrAssetMap();
  const nb = assets.nightlife;
  const cssLinks = linkTagsFor(nb);
  const scriptSrc = nb?.js ?? "/assets/nightlife.js";

  const withMeta: ClubWithSortMeta[] = opts.clubRows.map((r) => ({
    ...r.club,
    _sortOrder: r.sortOrder,
  }));
  const today = new Date();
  const sorted = sortClubsForDiscovery(withMeta, today);
  const featured = featuredClubsSorted(withMeta, today);

  const featuredSlides = featured
    .map((c) => carouselSlideHtml(c))
    .join("\n");
  const allCards = sorted.map((c) => smallClubCardHtml(c)).join("\n");

  const desc =
    "Elite London venues—tables, guestlist and private access. Explore featured clubs and book with Cooper Concierge.";

  const themeBoot = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("cc-theme");if(t==="light"||t==="dark"||t==="ocean")d.dataset.ccTheme=t;else d.dataset.ccTheme="ocean";}catch(e){d.dataset.ccTheme="ocean";}d.style.colorScheme=d.dataset.ccTheme==="light"?"light":"dark";})();`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <script id="cc-theme-boot">${themeBoot}</script>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="description" content="${escapeAttr(desc)}" />
    <link rel="canonical" href="${escapeAttr(canonical)}" />
    <meta property="og:title" content="Nightlife | Cooper Concierge" />
    <meta property="og:description" content="${escapeAttr(desc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeAttr(canonical)}" />
    <meta property="og:image" content="${escapeAttr(`${origin}/media/home/brand-logo.jpeg`)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/media/home/brand-logo.jpeg" type="image/jpeg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet" />
    ${cssLinks}
    <title>Nightlife | Cooper Concierge</title>
  </head>
  <body>
    <header id="cc-header" class="site-header"></header>
    <div id="cc-drawer" class="mobile-drawer"></div>
    <main>
      <section class="nl-landing-hero">
        <div class="nl-landing-hero__inner cc-container">
          <div class="nl-landing-hero__left">
            <p class="nightlife-hero__eyebrow">Private access arranged</p>
            <h1>Nightlife</h1>
            <p class="nightlife-hero__lede">Member rooms, private tables, and guestlist.</p>
            <div class="nightlife-actions">
              <a class="cc-btn cc-btn--gold" href="#nightlife-lead">Request access</a>
              <a class="cc-btn cc-btn--ghost" href="/nightlife-map">Full venue map</a>
            </div>
            <div class="nl-hero-flyer-wrap" aria-label="Featured flyer">
              ${renderTopFlyerHostHtml(
                opts.rankedFlyers.map((f) => ({
                  clubSlug: String(f.clubSlug ?? ""),
                  imageUrl: f.imageUrl,
                  title: f.title,
                  description: String(f.description ?? ""),
                  clubName: f.clubName,
                  eventDate: f.eventDate,
                })),
              )}
            </div>
          </div>
          <div class="nl-landing-hero__map-wrap">
            <button type="button" class="nl-hero-map-toggle" id="nl-hero-map-toggle" aria-expanded="true" aria-controls="nl-hero-map-panel" title="Collapse map">
              <span class="nl-hero-map-toggle__label">Map</span>
              <span class="nl-hero-map-toggle__chev" aria-hidden="true">›</span>
            </button>
            <div class="nl-hero-map-panel" id="nl-hero-map-panel">
              <div id="nightlife-hero-map" class="nl-hero-map" role="region" aria-label="Venue map"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="cc-section cc-container nl-featured-section">
        <div class="elite-venues-head">
          <p class="cc-eyebrow">Featured</p>
          <h2>Signature destinations</h2>
        </div>
        <div class="nl-carousel" data-nl-carousel>
          <div class="nl-carousel__track" id="nl-carousel-track">${featuredSlides}</div>
        </div>
      </section>

      <section class="cc-section cc-container nl-all-clubs">
        <div class="elite-venues-head">
          <p class="cc-eyebrow">All venues</p>
          <h2>London clubs</h2>
        </div>
        <div class="nl-card-grid" id="clubs-grid" data-ssr-hydrate="grid">
          ${allCards}
        </div>
      </section>

      <section class="cc-section cc-container">
        <div class="featured-banner__mode nightlife-content-toggle" role="tablist" aria-label="Nightlife content mode">
          <button type="button" class="featured-banner__mode-btn is-active" id="nightlife-mode-featured" role="tab" aria-selected="true">Featured</button>
          <button type="button" class="featured-banner__mode-btn" id="nightlife-mode-flyers" role="tab" aria-selected="false">Flyers</button>
        </div>
        <section class="nightlife-flyers" id="nightlife-flyers-panel" hidden>
          <div class="nightlife-flyers__head">
            <h3 id="nightlife-flyers-title">Club flyers</h3>
            <div class="nightlife-flyers__nav">
              <button type="button" class="featured-banner__chev" id="nightlife-flyer-prev" aria-label="Previous flyer">‹</button>
              <span id="nightlife-flyer-index" class="featured-banner__date-text">0 / 0</span>
              <button type="button" class="featured-banner__chev" id="nightlife-flyer-next" aria-label="Next flyer">›</button>
            </div>
          </div>
          <article class="nightlife-flyers__card" id="nightlife-flyer-card"></article>
        </section>
      </section>

      <section class="nl-lead" id="nightlife-lead">
        <div class="cc-container lead-split">
          <div>
            <p class="cc-eyebrow">Secure your evening</p>
            <h2 style="color: var(--cc-cream); margin-top: 0">Request inquiry</h2>
            <form id="nightlife-lead-form" class="nl-form--minimal" novalidate>
              <div class="cc-field">
                <label for="nl-full-name">Full name</label>
                <input id="nl-full-name" name="full_name" type="text" autocomplete="name" required />
              </div>
              <div class="cc-field">
                <label for="nl-email">Email</label>
                <input id="nl-email" name="email" type="email" autocomplete="email" required />
              </div>
              <div class="cc-field">
                <label for="nl-when">When &amp; where</label>
                <textarea id="nl-when" name="when_where" rows="3" required placeholder="Date, group size, preferred venues"></textarea>
              </div>
              <button type="submit" class="cc-btn cc-btn--gold">Submit</button>
            </form>
            <div class="cc-form-error" id="nightlife-lead-error" role="alert"></div>
            <div class="cc-form-success" id="nightlife-lead-success" role="status">Your inquiry has been logged. A concierge will respond shortly.</div>
          </div>
          <div class="lead-split__graphic" aria-hidden="true">
            <img src="/media/nightlife/lead-atmosphere.jpg" alt="" width="500" height="500" loading="lazy" />
          </div>
        </div>
      </section>
    </main>
    <footer id="cc-footer" class="site-footer"></footer>
    <div id="cc-modal-root"></div>
    <div id="cc-venue-request-root"></div>
    <script type="module" src="${escapeAttr(scriptSrc)}"></script>
  </body>
</html>`;
}
