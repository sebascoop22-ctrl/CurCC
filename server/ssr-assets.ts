import { ssrAssetHashes } from "./ssr-asset-hashes.js";

export type SsrAssetBundle = { js: string; css: string[] };

export type SsrAssetMap = {
  nightlife?: SsrAssetBundle;
  clubDetail?: SsrAssetBundle;
};

let cached: SsrAssetMap | null = null;

/**
 * Vite emits hashed filenames; `write-ssr-asset-map` updates
 * `server/ssr-asset-hashes.json` after each build. Static import bundles the
 * JSON into Vercel serverless so SSR always references real assets (reading
 * `ssr-assets.json` from disk is unreliable in the lambda bundle).
 */
export function loadSsrAssetMap(): SsrAssetMap {
  if (cached) return cached;
  cached = ssrAssetHashes as SsrAssetMap;
  return cached;
}

export function linkTagsFor(bundle: SsrAssetBundle | undefined): string {
  if (!bundle?.css?.length) return "";
  return bundle.css.map((href) => `<link rel="stylesheet" href="${href}" />`).join("\n    ");
}
