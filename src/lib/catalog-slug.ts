/** Hyphenated slug with a capital first letter per segment, e.g. Gallery-Club. */
export const CLUB_SLUG_PATTERN = /^[A-Z][A-Za-z0-9]*(?:-[A-Z][A-Za-z0-9]*)*$/;

export function normalizeCatalogSlug(slug: string): string {
  return slug
    .trim()
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => {
      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("-");
}

export function isValidClubSlug(slug: string): boolean {
  const normalized = normalizeCatalogSlug(slug);
  return Boolean(normalized) && CLUB_SLUG_PATTERN.test(normalized);
}
