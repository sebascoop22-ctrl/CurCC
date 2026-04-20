/** Canonical site origin for SSR meta and absolute URLs. */
export const DEFAULT_SITE_ORIGIN = "https://www.cooperconcierge.co.uk";

export function siteOrigin(): string {
  const explicit = process.env.SITE_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return DEFAULT_SITE_ORIGIN;
}
