/** Lowercase three-letter weekday keys (Sun = 0 … Sat = 6). */
const KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const ALIAS: Record<string, (typeof KEYS)[number]> = {
  sun: "sun",
  sunday: "sun",
  mon: "mon",
  monday: "mon",
  tue: "tue",
  tues: "tue",
  tuesday: "tue",
  wed: "wed",
  wednesday: "wed",
  thu: "thu",
  thur: "thu",
  thurs: "thu",
  thursday: "thu",
  fri: "fri",
  friday: "fri",
  sat: "sat",
  saturday: "sat",
};

export function currentWeekdayKey(d = new Date()): (typeof KEYS)[number] {
  return KEYS[d.getDay()] ?? "sun";
}

/** Map CSV / admin tokens (Thu, Thursday, thu.) to sun…sat. */
export function normalizeClubDayToken(raw: string): (typeof KEYS)[number] | null {
  const s = raw.trim().toLowerCase().replace(/\.$/, "");
  if (!s) return null;
  if (ALIAS[s]) return ALIAS[s];
  const head3 = s.slice(0, 3);
  if (ALIAS[head3]) return ALIAS[head3];
  return null;
}

export function bestVisitKeys(days: string[]): (typeof KEYS)[number][] {
  const out: (typeof KEYS)[number][] = [];
  for (const d of days) {
    const k = normalizeClubDayToken(d);
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

/** Short hint for “tonight” using best-visit days when present. */
export function clubTonightHint(
  bestVisitDays: string[],
  daysOpen: string,
): string {
  const keys = bestVisitKeys(bestVisitDays);
  const today = currentWeekdayKey();
  if (keys.length) {
    if (keys.includes(today)) {
      return "Tonight matches a typical peak night for this venue — confirm before you travel.";
    }
    return "Tonight is not usually a peak night on file for this venue — check before you travel.";
  }
  const d = daysOpen.trim();
  if (d) {
    return `Typical opening pattern: ${d}. Confirm on the night.`;
  }
  return "";
}
