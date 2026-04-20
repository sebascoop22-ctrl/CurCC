import { clubTonightHint } from "../lib/club-hours.js";
import type { Club, PromoterShiftAssignment } from "../types";

function esc(s: string | undefined | null): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Collapse whitespace so we can detect duplicate hero lede vs long bio. */
function normalizedBio(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function hasTableCopy(c: Club): boolean {
  return Boolean(
    c.tablesStandard?.trim() ||
      c.tablesLuxury?.trim() ||
      c.tablesVip?.trim(),
  );
}

/**
 * Inner HTML for `<main class="club-detail">` — shared by Vercel SSR and
 * client-only routes (`club.html` / Vite dev) so club pages are never an empty shell.
 * Omits sections when there is no real content (no placeholder copy).
 */
export function buildClubDetailMainHtml(
  c: Club,
  assignments: PromoterShiftAssignment[],
): string {
  const locationLine = c.locationTag?.trim();
  const eyebrowHtml = locationLine
    ? `<p class="cc-eyebrow">${esc(locationLine)}</p>`
    : "";

  const ledeRaw = c.shortDescription?.trim() ?? "";
  const ledeHtml = ledeRaw
    ? `<p class="club-detail__lede">${esc(ledeRaw)}</p>`
    : "";

  const navDest =
    c.address?.trim() ||
    (c.lat && c.lng ? `${c.lat},${c.lng}` : "");
  const directionsBtn = navDest
    ? `<a class="cc-btn cc-btn--ghost" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(navDest)}" target="_blank" rel="noopener noreferrer">Directions</a>`
    : "";
  const websiteRaw = c.website?.trim() ?? "";
  const websiteHref = websiteRaw
    ? /^https?:\/\//i.test(websiteRaw)
      ? websiteRaw
      : `https://${websiteRaw}`
    : "";
  const websiteBtn = websiteHref
    ? `<a class="cc-btn cc-btn--ghost" href="${esc(websiteHref)}" target="_blank" rel="noopener noreferrer">Website</a>`
    : "";

  const hasMapCoords = Boolean(c.lat && c.lng);
  const heroClass = `club-detail__hero cc-container${hasMapCoords ? " club-detail__hero--has-map" : ""}`;
  const heroMapAside = hasMapCoords
    ? `<aside class="club-detail__hero-map" aria-label="Map">
          <div id="club-detail-map" class="club-detail__map" role="region" aria-label="Venue location" data-lat="${esc(String(c.lat))}" data-lng="${esc(String(c.lng))}" data-name="${esc(c.name)}"></div>
        </aside>`
    : "";

  const bestVisitRaw = (c.bestVisitDays ?? [])
    .map((x) => x.trim())
    .filter(Boolean);
  const daysOpenStr = (c.daysOpen || "").trim();
  const tonightHint = clubTonightHint(bestVisitRaw, daysOpenStr);
  const peakNightsLine = bestVisitRaw.length
    ? bestVisitRaw.join(" · ")
    : "";
  const hasOpening = Boolean(daysOpenStr || peakNightsLine || tonightHint);
  const openingSection = hasOpening
    ? `<section class="club-detail__opening cc-container">
        <h2>Opening</h2>
        ${
          daysOpenStr
            ? `<p class="club-detail__open-line"><strong>Schedule</strong> · ${esc(daysOpenStr)}</p>`
            : ""
        }
        ${
          peakNightsLine
            ? `<p class="club-detail__open-line"><strong>Best nights</strong> · ${esc(peakNightsLine)}</p>`
            : ""
        }
        ${
          tonightHint
            ? `<p class="club-detail__open-note">${esc(tonightHint)}</p>`
            : ""
        }
      </section>`
    : "";

  const ew = c.entryPricingWomen?.trim();
  const em = c.entryPricingMen?.trim();
  const tst = c.tablesStandard?.trim();
  const tlx = c.tablesLuxury?.trim();
  const tv = c.tablesVip?.trim();
  const ms = c.minSpend?.trim();
  const hasDoor = Boolean(ew || em);
  const hasTables = Boolean(tst || tlx || tv);
  const hasMs = Boolean(ms);
  const hasPrice = hasDoor || hasTables || hasMs;

  const entryTableHtml = hasDoor
    ? `<div class="club-detail__price-block">
        <h3 class="club-detail__price-sub">Entry</h3>
        <div class="club-detail__price-table-scroll">
          <table class="club-detail__price-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">On file</th>
              </tr>
            </thead>
            <tbody>
              ${ew ? `<tr><th scope="row">Women</th><td>${esc(ew)}</td></tr>` : ""}
              ${em ? `<tr><th scope="row">Men</th><td>${esc(em)}</td></tr>` : ""}
            </tbody>
          </table>
        </div>
      </div>`
    : "";

  const tableBodyRows = [
    tst ? `<tr><th scope="row">Standard</th><td>${esc(tst)}</td></tr>` : "",
    tlx ? `<tr><th scope="row">Luxury</th><td>${esc(tlx)}</td></tr>` : "",
    tv ? `<tr><th scope="row">VIP</th><td>${esc(tv)}</td></tr>` : "",
    ms ? `<tr><th scope="row">Minimum spend</th><td>${esc(ms)}</td></tr>` : "",
  ]
    .filter(Boolean)
    .join("");

  const tablePricingHtml =
    hasTables || hasMs
      ? `<div class="club-detail__price-block">
        <h3 class="club-detail__price-sub">Tables</h3>
        <div class="club-detail__price-table-scroll">
          <table class="club-detail__price-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">On file</th>
              </tr>
            </thead>
            <tbody>${tableBodyRows}</tbody>
          </table>
        </div>
      </div>`
      : "";

  const pricesSection = hasPrice
    ? `<section class="club-detail__prices cc-container">
        <h2>Pricing</h2>
        <div class="club-detail__price-blocks">${entryTableHtml}${tablePricingHtml}</div>
      </section>`
    : "";

  const galleryImages = (c.images ?? []).slice(0, 12);
  const imgsHtml = galleryImages
    .map(
      (src) =>
        `<figure class="club-detail__fig"><img src="${esc(src)}" alt="" loading="lazy" width="800" height="500" /></figure>`,
    )
    .join("");

  const videos = (c.videos ?? []).filter(Boolean);
  const vHtml = videos
    .map((url) => {
      const u = esc(url);
      return `<div class="club-detail__video"><a class="cc-btn cc-btn--ghost" href="${u}" target="_blank" rel="noopener noreferrer">Watch video</a></div>`;
    })
    .join("");

  const galleryInner = `${imgsHtml}${vHtml}`.trim();
  const gallerySection = galleryInner
    ? `<section class="club-detail__gallery cc-container">
        <h2>Gallery</h2>
        <div class="club-detail__gallery-grid">${galleryInner}</div>
      </section>`
    : "";

  const amenityItems = (c.amenities ?? [])
    .map((x) => x.trim())
    .filter(Boolean)
    .map((a) => `<li>${esc(a)}</li>`)
    .join("");
  const hasAmenities = Boolean(amenityItems);

  const longRaw = (c.longDescription ?? "").trim();
  const longDuplicatesLede =
    Boolean(longRaw && ledeRaw) &&
    normalizedBio(longRaw) === normalizedBio(ledeRaw);
  const longDisplayRaw = longRaw && !longDuplicatesLede ? longRaw : "";
  const longHtml = longDisplayRaw
    ? `<div class="club-detail__long">${esc(longDisplayRaw).replace(/\n/g, "<br />")}</div>`
    : "";

  let aboutSection = "";
  if (longHtml && hasAmenities) {
    aboutSection = `<section class="club-detail__about cc-container">
        <h2>About</h2>
        ${longHtml}
        <h3 class="club-detail__amenities-title">Amenities</h3>
        <ul class="club-detail__amenities">${amenityItems}</ul>
      </section>`;
  } else if (longHtml) {
    aboutSection = `<section class="club-detail__about cc-container">
        <h2>About</h2>
        ${longHtml}
      </section>`;
  } else if (hasAmenities) {
    aboutSection = `<section class="club-detail__about cc-container">
        <h2>Amenities</h2>
        <ul class="club-detail__amenities">${amenityItems}</ul>
      </section>`;
  }

  const promoters = assignments;
  const promoterSlides = promoters
    .map(
      (p) =>
        `<div class="club-detail__promo-slide" data-promoter-id="${esc(p.promoterId)}" data-promoter-name="${esc(p.promoterName)}">
          <p class="club-detail__promo-name">${esc(p.promoterName)}</p>
          <button type="button" class="cc-btn cc-btn--gold club-detail__join-gl" data-vr-kind="guestlist" data-promoter-name="${esc(p.promoterName)}">Join guestlist</button>
        </div>`,
    )
    .join("");

  const showPromoterCarousel = promoters.length > 0;
  /** Partner venues: always offer guestlist in UI (modal still shows on-file schedule when present). */
  const showGuestlist = c.hasPartnership !== false;
  const showTables = hasTableCopy(c);
  const showRequestAccess =
    !showPromoterCarousel && c.hasPartnership === false;

  const ctaGuestlist = showGuestlist
    ? `<button type="button" class="cc-btn cc-btn--gold" data-vr-kind="guestlist" data-club-slug="${esc(c.slug)}">Join guestlist</button>`
    : "";
  const ctaTable = showTables
    ? `<button type="button" class="cc-btn cc-btn--ghost" data-vr-kind="private_table" data-club-slug="${esc(c.slug)}">Book a table</button>`
    : "";
  const ctaAccess = showRequestAccess
    ? `<button type="button" class="cc-btn cc-btn--gold" data-vr-kind="venue_access" data-club-slug="${esc(c.slug)}">Request club access</button>`
    : "";

  const heroCtas = [ctaGuestlist, ctaTable, ctaAccess, websiteBtn, directionsBtn]
    .filter(Boolean)
    .join("");
  const heroCtaRow = heroCtas
    ? `<div class="club-detail__cta-row club-detail__cta-row--top" data-club-slug="${esc(c.slug)}">${heroCtas}</div>`
    : "";

  const promotersSection = showPromoterCarousel
    ? `<section class="club-detail__promoters cc-container">
        <h2>Guestlist hosts tonight</h2>
        <div class="club-detail__promo-carousel">${promoterSlides}</div>
      </section>`
    : "";

  const footerCtas = [ctaGuestlist, ctaTable, ctaAccess, websiteBtn]
    .filter(Boolean)
    .join("");
  const footerSection = footerCtas
    ? `<section class="club-detail__footer-cta cc-container">
        <div class="club-detail__cta-row" data-club-slug="${esc(c.slug)}">${footerCtas}</div>
      </section>`
    : "";

  return `
      <section class="${heroClass}" aria-label="Venue overview">
        <div class="club-detail__hero-copy">
          ${eyebrowHtml}
          <h1 class="club-detail__title">${esc(c.name)}</h1>
          ${ledeHtml}
          ${heroCtaRow}
        </div>
        ${heroMapAside}
      </section>

      ${gallerySection}

      ${openingSection}

      ${pricesSection}

      ${aboutSection}

      ${promotersSection}

      ${footerSection}
    `.trim();
}
