import type { Club } from "../types";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Whether the venue lists `d`'s weekday in `days_open` (Thu-Sat, Wed|Fri, daily, etc.). */
export function clubOpenOnDate(club: Club, d: Date): boolean {
  const open = (club.daysOpen ?? "").toLowerCase();
  if (!open || open.includes("daily")) return true;
  const abbr = DOW[d.getDay()].toLowerCase().slice(0, 3);
  return open.includes(abbr);
}

export type ClubWithSortMeta = Club & { _sortOrder?: number };

function hasOperationalGuestlist(club: Club): boolean {
  const partner = club.hasPartnership !== false;
  return partner && (club.guestlists?.length ?? 0) > 0;
}

/**
 * Discovery sort: open today first, then catalog order (sort_order),
 * then featured, then guestlist availability, then name.
 */
export function compareClubsDiscovery(
  a: ClubWithSortMeta,
  b: ClubWithSortMeta,
  today: Date,
): number {
  const ao = clubOpenOnDate(a, today) ? 1 : 0;
  const bo = clubOpenOnDate(b, today) ? 1 : 0;
  if (bo !== ao) return bo - ao;

  const ra = a._sortOrder ?? 999999;
  const rb = b._sortOrder ?? 999999;
  if (ra !== rb) return ra - rb;

  const fa = a.featured ? 1 : 0;
  const fb = b.featured ? 1 : 0;
  if (fb !== fa) return fb - fa;

  const ga = hasOperationalGuestlist(a) ? 1 : 0;
  const gb = hasOperationalGuestlist(b) ? 1 : 0;
  if (gb !== ga) return gb - ga;

  return a.name.localeCompare(b.name, "en");
}

export function sortClubsForDiscovery(
  clubs: ClubWithSortMeta[],
  today: Date = new Date(),
): ClubWithSortMeta[] {
  return [...clubs].sort((a, b) => compareClubsDiscovery(a, b, today));
}

export function featuredClubsSorted(
  clubs: ClubWithSortMeta[],
  today: Date = new Date(),
): ClubWithSortMeta[] {
  return sortClubsForDiscovery(
    clubs.filter((c) => c.featured),
    today,
  );
}
