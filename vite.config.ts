import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
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
        privacy: resolve(__dirname, "privacy.html"),
        terms: resolve(__dirname, "terms.html"),
      },
    },
  },
});
