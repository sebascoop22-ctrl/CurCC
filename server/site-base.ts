/** Canonical site origin for SSR meta and absolute URLs. */
export const DEFAULT_SITE_ORIGIN = "https://www.cooperconcierge.co.uk";

export function siteOrigin(): string {
  const explicit = process.env.SITE_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const bareHost = host.replace(/^www\./, "");
    // Keep canonicals stable on production/previews and force preferred www domain.
    if (host.endsWith(".vercel.app") || bareHost === "cooperconcierge.co.uk") {
      return DEFAULT_SITE_ORIGIN;
    }
    return `https://${host}`;
  }
  return DEFAULT_SITE_ORIGIN;
}
