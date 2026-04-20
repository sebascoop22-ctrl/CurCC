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
  try {
    const rows = await loadClubCatalog();
    const safeRows = rows.filter(
      (r) => Boolean(r?.club?.slug?.trim()) && Boolean(r?.club?.name?.trim()),
    );
    const flyers = await fetchClubFlyersServer();
    const byClub = groupFlyersByClubSlug(flyers);
    const clubs = safeRows.map((r) => r.club);
    const ranked = rankFlyersForHero(clubs, byClub);
    const html = buildNightlifeSsrHtml({
      pathname: canonicalPath,
      clubRows: safeRows,
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
  } catch (error) {
    console.error("nightlanding SSR failed", error);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }
    const html = buildNightlifeSsrHtml({
      pathname: canonicalPath,
      clubRows: [],
      rankedFlyers: [],
    });
    res.status(200).send(html);
  }
}
