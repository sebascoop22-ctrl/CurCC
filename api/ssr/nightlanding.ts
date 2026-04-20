import type { VercelRequest, VercelResponse } from "@vercel/node";

function fallbackNightlifeHtml(canonicalPath: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nightlife | Cooper Concierge</title>
  </head>
  <body>
    <main style="font-family: Inter, system-ui, sans-serif; max-width: 760px; margin: 3rem auto; padding: 0 1rem;">
      <h1>Nightlife</h1>
      <p>Our nightlife page is loading in fallback mode right now.</p>
      <p><a href="/enquiry">Request inquiry</a></p>
      <p><a href="${canonicalPath === "/nightlife" ? "/" : "/nightlife"}">Try alternate path</a></p>
    </main>
  </body>
</html>`;
}

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
    const [{ fetchClubFlyersServer, groupFlyersByClubSlug, loadClubCatalog }, { buildNightlifeSsrHtml }, { rankFlyersForHero }] =
      await Promise.all([
        import("../../server/catalog-fetch"),
        import("../../server/render-nightlife-ssr"),
        import("../../src/nightlife/flyer-rank"),
      ]);
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
    res.setHeader(
      "Cache-Control",
      "private, no-store, max-age=0, must-revalidate",
    );
    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }
    const html = fallbackNightlifeHtml(canonicalPath);
    res.status(200).send(html);
  }
}
