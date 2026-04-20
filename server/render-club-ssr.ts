import { buildClubDetailMainHtml } from "../src/nightlife/club-detail-main-html.js";
import type { Club, PromoterShiftAssignment } from "../src/types";
import { escapeAttr } from "./html-escape.js";
import { loadSsrAssetMap, linkTagsFor } from "./ssr-assets.js";
import { siteOrigin } from "./site-base.js";

export function buildClubSsrHtml(opts: {
  club: Club;
  assignments: PromoterShiftAssignment[];
}): string {
  const origin = siteOrigin();
  const canonical = `${origin}/club/${encodeURIComponent(opts.club.slug)}`;
  const assets = loadSsrAssetMap();
  const bundle = assets.clubDetail;
  const cssLinks = linkTagsFor(bundle);
  const scriptSrc = bundle?.js ?? "/assets/clubDetail.js";
  const c = opts.club;
  const desc =
    c.shortDescription?.trim() ||
    "London nightlife — guestlist and private tables with Cooper Concierge.";
  const ogRaw =
    c.discoveryCardImage?.trim() ||
    c.images?.[0]?.trim() ||
    "/media/home/brand-logo.jpeg";
  const ogImage = ogRaw.startsWith("http")
    ? ogRaw
    : `${origin}${ogRaw.startsWith("/") ? "" : "/"}${ogRaw}`;

  const mainInner = buildClubDetailMainHtml(c, opts.assignments);

  const themeBoot = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("cc-theme");if(t==="light"||t==="dark"||t==="ocean")d.dataset.ccTheme=t;else d.dataset.ccTheme="ocean";}catch(e){d.dataset.ccTheme="ocean";}d.style.colorScheme=d.dataset.ccTheme==="light"?"light":"dark";})();`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <script id="cc-theme-boot">${themeBoot}</script>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="description" content="${escapeAttr(desc)}" />
    <link rel="canonical" href="${escapeAttr(canonical)}" />
    <meta property="og:title" content="${escapeAttr(`${c.name} | Cooper Concierge`)}" />
    <meta property="og:description" content="${escapeAttr(desc)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeAttr(canonical)}" />
    <meta property="og:image" content="${escapeAttr(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet" />
    ${cssLinks}
    <title>${escapeAttr(c.name)} | Cooper Concierge</title>
  </head>
  <body class="club-detail-body">
    <header id="cc-header" class="site-header"></header>
    <div id="cc-drawer" class="mobile-drawer"></div>
    <main class="club-detail" id="cc-club-main">
${mainInner}
    </main>
    <footer id="cc-footer" class="site-footer"></footer>
    <div id="cc-modal-root"></div>
    <div id="cc-venue-request-root"></div>
    <script type="application/json" id="cc-club-json">${JSON.stringify(c).replace(/</g, "\\u003c")}</script>
    <script type="module" src="${escapeAttr(scriptSrc)}"></script>
  </body>
</html>`;
}
