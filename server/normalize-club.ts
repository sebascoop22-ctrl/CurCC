import type { Club } from "../src/types";

export function normalizeClubPayload(raw: Club): Club {
  const kfUnknown = raw.knownFor as unknown;
  let knownFor: string[] = [];
  if (Array.isArray(kfUnknown)) {
    knownFor = kfUnknown.map((x) => String(x).trim()).filter(Boolean);
  } else if (typeof kfUnknown === "string") {
    knownFor = kfUnknown
      .split(/[;,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const bvd = raw.bestVisitDays as unknown;
  const bestVisitDays = Array.isArray(bvd)
    ? bvd.map((x) => String(x).trim()).filter(Boolean)
    : typeof bvd === "string"
      ? bvd
          .split(/[|,\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const img = raw.images as unknown;
  const images = Array.isArray(img) ? img.map((x) => String(x)) : [];
  const vid = raw.videos as unknown;
  const videos = Array.isArray(vid) ? vid.map((x) => String(x)).filter(Boolean) : [];
  const gl = raw.guestlists as unknown;
  const guestlists = Array.isArray(gl) ? (gl as Club["guestlists"]) : [];
  const am = raw.amenities as unknown;
  const amenities = Array.isArray(am) ? am.map(String) : [];
  const dTitle = (raw as { discoveryCardTitle?: unknown }).discoveryCardTitle;
  const dBlurb = (raw as { discoveryCardBlurb?: unknown }).discoveryCardBlurb;
  const dImg = (raw as { discoveryCardImage?: unknown }).discoveryCardImage;
  return {
    ...raw,
    daysOpen: typeof raw.daysOpen === "string" ? raw.daysOpen : "",
    website: typeof raw.website === "string" ? raw.website : "",
    knownFor,
    bestVisitDays,
    images,
    videos: videos.length ? videos : undefined,
    hasPartnership: raw.hasPartnership !== false,
    guestlists,
    amenities,
    discoveryCardTitle:
      typeof dTitle === "string" && dTitle.trim() ? dTitle.trim() : undefined,
    discoveryCardBlurb:
      typeof dBlurb === "string" && dBlurb.trim() ? dBlurb.trim() : undefined,
    discoveryCardImage:
      typeof dImg === "string" && dImg.trim() ? dImg.trim() : undefined,
  };
}
