import { resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

/** Sync `data-cc-theme` from localStorage before first paint (default: ocean). Must match `STORAGE_KEY` in `src/theme.ts`. */
function injectThemeBootScript(): Plugin {
  const snippet = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("cc-theme");if(t==="light"||t==="dark"||t==="ocean")d.dataset.ccTheme=t;else d.dataset.ccTheme="ocean";}catch(e){d.dataset.ccTheme="ocean";}d.style.colorScheme=d.dataset.ccTheme==="light"?"light":"dark";})();`;
  return {
    name: "inject-theme-boot",
    transformIndexHtml(html) {
      if (html.includes("id=\"cc-theme-boot\"")) return html;
      return html.replace(/<head>/i, `<head>\n    <script id="cc-theme-boot">${snippet}</script>`);
    },
  };
}

function tryRewriteClubPageUrl(raw: string): string | null {
  const q = raw.indexOf("?");
  const pathname = q >= 0 ? raw.slice(0, q) : raw;
  const search = q >= 0 ? raw.slice(q + 1) : "";
  const clubMatch =
    pathname.match(/^\/club\/([^/]+)\/?$/) ??
    pathname.match(/^\/clubs\/([^/]+)\/?$/);
  if (!clubMatch) return null;
  const slug = decodeURIComponent(clubMatch[1]);
  const qs = new URLSearchParams();
  qs.set("slug", slug);
  if (search) {
    const extra = new URLSearchParams(search);
    extra.forEach((v, k) => {
      if (k !== "slug") qs.set(k, v);
    });
  }
  return `/club.html?${qs.toString()}`;
}

/** Dev + preview: `/enquiry` → `/enquiry.html`; `/club/slug` → `/club.html?slug=` (matches Vercel). */
function extensionlessHtml(): Plugin {
  function clubAndExtensionless(
    req: { url?: string; method?: string },
    _res: unknown,
    next: () => void,
  ): void {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const raw = req.url ?? "";
    const q = raw.indexOf("?");
    const pathname = q >= 0 ? raw.slice(0, q) : raw;
    const search = q >= 0 ? raw.slice(q) : "";
    if (pathname === "/" || pathname === "") return next();
    if (pathname.startsWith("/@") || pathname.startsWith("/node_modules/"))
      return next();
    if (pathname.startsWith("/src/")) return next();
    if (pathname.startsWith("/assets/")) return next();
    if (pathname.startsWith("/media/")) return next();
    const clubUrl = tryRewriteClubPageUrl(raw);
    if (clubUrl) {
      req.url = clubUrl;
      next();
      return;
    }
    const base = pathname.split("/").pop() ?? "";
    if (base.includes(".")) return next();
    req.url = pathname + ".html" + search;
    next();
  }

  return {
    name: "extensionless-html",
    configureServer(server) {
      server.middlewares.use(clubAndExtensionless);
    },
    configurePreviewServer(server) {
      server.middlewares.use(clubAndExtensionless);
    },
  };
}

export default defineConfig({
  plugins: [injectThemeBootScript(), extensionlessHtml()],
  build: {
    manifest: true,
    /** maplibre-gl is ~780 kB minified; it is already split via dynamic import on the map page only. */
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        classic: resolve(__dirname, "classic.html"),
        nightlife: resolve(__dirname, "nightlife.html"),
        nightlifeMap: resolve(__dirname, "nightlife-map.html"),
        clubDetail: resolve(__dirname, "club.html"),
        security: resolve(__dirname, "security.html"),
        chauffeuring: resolve(__dirname, "chauffeuring.html"),
        enquiry: resolve(__dirname, "enquiry.html"),
        admin: resolve(__dirname, "admin.html"),
        promoter: resolve(__dirname, "promoter.html"),
        workspace: resolve(__dirname, "workspace.html"),
        guestCheckin: resolve(__dirname, "guest-checkin.html"),
        privacy: resolve(__dirname, "privacy.html"),
        terms: resolve(__dirname, "terms.html"),
      },
    },
  },
});
