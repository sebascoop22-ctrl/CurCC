import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  fetchClubFlyersServer,
  groupFlyersByClubSlug,
  loadClubCatalog,
} from "../../server/catalog-fetch";
import { buildNightlifeSsrHtml } from "../../server/render-nightlife-ssr";
import { rankFlyersForHero } from "../../src/nightlife/flyer-rank";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).end("Method Not Allowed");
    return;
  }
  const raw = req.query.canonicalPath;
  const canonicalPath =
    typeof raw === "string" && raw.startsWith("/") ? raw : "/";
  const rows = await loadClubCatalog();
  const flyers = await fetchClubFlyersServer();
  const byClub = groupFlyersByClubSlug(flyers);
  const clubs = rows.map((r) => r.club);
  const ranked = rankFlyersForHero(clubs, byClub);
  const html = buildNightlifeSsrHtml({
    pathname: canonicalPath,
    clubRows: rows,
    rankedFlyers: ranked,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "private, no-store, max-age=0, must-revalidate",
  );
  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }
  res.status(200).send(html);
}
