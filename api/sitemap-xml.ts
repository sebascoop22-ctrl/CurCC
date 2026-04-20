import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadClubCatalog } from "../server/catalog-fetch.js";
import { siteOrigin } from "../server/site-base.js";

const STATIC_PATHS = [
  "/classic",
  "/nightlife",
  "/nightlife-map",
  "/chauffeuring",
  "/security",
  "/enquiry",
  "/privacy",
  "/terms",
];

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).end("Method Not Allowed");
    return;
  }
  const origin = siteOrigin();
  const rows = await loadClubCatalog();
  const clubUrls = rows.map(
    (r) => `  <url>
    <loc>${xmlEscape(`${origin}/club/${encodeURIComponent(r.club.slug)}`)}</loc>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`,
  );
  const staticUrls = STATIC_PATHS.map(
    (p) => `  <url>
    <loc>${xmlEscape(`${origin}${p}`)}</loc>
    <changefreq>weekly</changefreq>
    <priority>${p === "/classic" ? "0.75" : "0.9"}</priority>
  </url>`,
  );
  const rootUrl = `  <url>
    <loc>${xmlEscape(origin + "/")}</loc>
    <changefreq>daily</changefreq>
    <priority>1</priority>
  </url>`;

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rootUrl}
${staticUrls.join("\n")}
${clubUrls.join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600",
  );
  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }
  res.status(200).send(body);
}
