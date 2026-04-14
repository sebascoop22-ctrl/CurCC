import { resolve } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

/** Dev-only: `/enquiry` → `/enquiry.html` (matches Vercel rewrites). */
function extensionlessHtml(): Plugin {
  return {
    name: "extensionless-html",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const raw = req.url ?? "";
        const q = raw.indexOf("?");
        const pathname = q >= 0 ? raw.slice(0, q) : raw;
        const search = q >= 0 ? raw.slice(q) : "";
        if (pathname === "/" || pathname === "") return next();
        if (pathname.startsWith("/@") || pathname.startsWith("/node_modules/")) return next();
        if (pathname.startsWith("/src/")) return next();
        if (pathname.startsWith("/assets/")) return next();
        if (pathname.startsWith("/media/")) return next();
        const base = pathname.split("/").pop() ?? "";
        if (base.includes(".")) return next();
        req.url = pathname + ".html" + search;
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [extensionlessHtml()],
  build: {
    /** maplibre-gl is ~780 kB minified; it is already split via dynamic import on the map page only. */
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        nightlife: resolve(__dirname, "nightlife.html"),
        nightlifeMap: resolve(__dirname, "nightlife-map.html"),
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
