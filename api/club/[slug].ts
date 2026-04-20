import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  fetchPromoterAssignmentsServer,
  findClubRowBySlug,
  groupAssignmentsByClub,
  loadClubCatalog,
} from "../../server/catalog-fetch.js";
import { buildClubSsrHtml } from "../../server/render-club-ssr.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).end("Method Not Allowed");
    return;
  }
  const slugParam = req.query.slug;
  const slug =
    typeof slugParam === "string"
      ? slugParam.trim()
      : Array.isArray(slugParam)
        ? String(slugParam[0] ?? "").trim()
        : "";
  if (!slug) {
    res.status(404).end("Not found");
    return;
  }
  const rows = await loadClubCatalog();
  const row = findClubRowBySlug(rows, slug);
  if (!row) {
    res.status(404).setHeader("Content-Type", "text/plain").send("Club not found");
    return;
  }
  const resolvedSlug = row.club.slug;
  const assignments = groupAssignmentsByClub(
    await fetchPromoterAssignmentsServer(),
  )[resolvedSlug] ?? [];

  const html = buildClubSsrHtml({ club: row.club, assignments });
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
