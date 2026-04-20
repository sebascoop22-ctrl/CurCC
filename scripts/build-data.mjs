/**
 * Reads public/clubs/clubs.csv (all venues) and public/cars/{folder}/vehicle.csv
 * Writes public/data/clubs.json and public/data/cars.json
 *
 * Images still live under public/clubs/{slug}/ (or image_folder if set and different from slug).
 *
 * featured_day: optional. Exact calendar date as YYYY-MM-DD or DD/MM/YYYY; and/or weekday names
 *   (e.g. "Monday Wednesday", "Mon | Fri", "Sun") — home featured banner matches the viewer's selected date.
 * best_visit_days: pipe-separated short labels (Thu|Fri|Sat) — recommended nights; shown on nightlife + map.
 * website: optional club site URL (https://… or domain only); shown on nightlife cards.
 * image_folder: optional — asset subdirectory name under public/clubs/; defaults to slug.
 * known_for: semicolon-separated bullet points (e.g. DJs; Big-room energy).
 * entry_pricing_women, entry_pricing_men: door / guestlist copy per gender.
 * tables_standard, tables_luxury, tables_vip: table tier copy (avoid unquoted commas in fields).
 *
 * Guestlists: public/clubs/guestlists.csv — club_slug, days (pipe-separated, e.g. Fri|Sat),
 *   recurrence (one_off | weekly), optional notes. Merged into each club as guestlists[].
 *
 * Optional columns:
 *   has_partnership — true/false (default true). When false, club is listed but non-partner flows apply.
 *   video_urls — pipe-separated URLs (YouTube, Vimeo, or direct) → videos[] on club payload.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");

/** Minimal CSV row parser (handles "quoted, fields") */
function parseCsv(text) {
  const lines = text.trim().replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseLine(line);
    const row = {};
    headers.forEach((h, j) => {
      row[h.trim()] = (vals[j] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      inQ = !inQ;
    } else if ((c === "," && !inQ) || (c === "\n" && !inQ)) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function listImagesOrdered(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp|svg|gif)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function splitPipe(s) {
  if (!s) return [];
  return s
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

function splitReviews(s) {
  if (!s) return [];
  return s
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Known-for bullets in clubs.csv (semicolon-separated) */
function splitKnownFor(s) {
  return splitReviews(s);
}

function bool(s) {
  const v = String(s).toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function normalizeWebsite(s) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function buildGuestlistsBySlug() {
  const csvPath = path.join(publicDir, "clubs", "guestlists.csv");
  if (!fs.existsSync(csvPath)) return new Map();
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  /** @type {Map<string, { days: string[]; recurrence: string; notes: string }[]>} */
  const map = new Map();
  for (const row of rows) {
    const slug = String(row.club_slug || "").trim();
    if (!slug) continue;
    const rawRec = String(row.recurrence || "weekly")
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    const recurrence = rawRec === "one_off" ? "one_off" : "weekly";
    const entry = {
      days: splitPipe(row.days || ""),
      recurrence,
      notes: String(row.notes || "").trim(),
    };
    if (!map.has(slug)) map.set(slug, []);
    map.get(slug).push(entry);
  }
  return map;
}

function buildClubs() {
  const clubsRoot = path.join(publicDir, "clubs");
  const masterCsv = path.join(clubsRoot, "clubs.csv");
  if (!fs.existsSync(clubsRoot)) {
    fs.mkdirSync(clubsRoot, { recursive: true });
    return [];
  }
  if (!fs.existsSync(masterCsv)) {
    console.warn("build-data: public/clubs/clubs.csv not found — 0 clubs");
    return [];
  }
  const guestBySlug = buildGuestlistsBySlug();
  const rows = parseCsv(fs.readFileSync(masterCsv, "utf8"));
  const clubs = [];
  for (const row of rows) {
    const slug = String(row.slug || "").trim();
    if (!slug) continue;
    const folder =
      String(row.image_folder || "").trim() || slug;
    const dir = path.join(clubsRoot, folder);
    const imgs = listImagesOrdered(dir).map((f) => `/clubs/${folder}/${f}`);

    const venueType =
      String(row.venue_type || "lounge").toLowerCase() === "dining"
        ? "dining"
        : "lounge";

    const hasPartnershipCol = row.has_partnership;
    const hasPartnership =
      hasPartnershipCol === undefined || hasPartnershipCol === ""
        ? true
        : bool(hasPartnershipCol);

    clubs.push({
      slug,
      name: row.name || slug,
      shortDescription: row.short_description || "",
      longDescription: row.long_description || "",
      reviews: splitReviews(row.reviews || ""),
      locationTag: row.location_tag || "",
      address: row.address || "",
      daysOpen: row.days_open || "",
      bestVisitDays: splitPipe(row.best_visit_days || ""),
      featured: bool(row.featured),
      featuredDay: row.featured_day || "",
      venueType,
      lat: Number(String(row.lat ?? "").replace(/\s/g, "")) || 0,
      lng: Number(String(row.lng ?? "").replace(/\s/g, "")) || 0,
      minSpend: row.min_spend || "",
      website: normalizeWebsite(row.website || ""),
      entryPricingWomen: String(row.entry_pricing_women || "").trim(),
      entryPricingMen: String(row.entry_pricing_men || "").trim(),
      tablesStandard: String(row.tables_standard || "").trim(),
      tablesLuxury: String(row.tables_luxury || "").trim(),
      tablesVip: String(row.tables_vip || "").trim(),
      knownFor: splitKnownFor(row.known_for || ""),
      amenities: splitPipe(row.amenities || ""),
      images: imgs,
      videos: splitPipe(row.video_urls || ""),
      hasPartnership,
      guestlists: guestBySlug.get(slug) ?? [],
    });
  }
  return clubs;
}

function buildCars() {
  const carsRoot = path.join(publicDir, "cars");
  if (!fs.existsSync(carsRoot)) {
    fs.mkdirSync(carsRoot, { recursive: true });
    return [];
  }
  const dirs = fs
    .readdirSync(carsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const cars = [];
  for (const folder of dirs) {
    const dir = path.join(carsRoot, folder);
    const csvPath = path.join(dir, "vehicle.csv");
    if (!fs.existsSync(csvPath)) continue;
    const raw = fs.readFileSync(csvPath, "utf8");
    const rows = parseCsv(raw);
    if (!rows.length) continue;
    const row = rows[0];
    const imgs = listImagesOrdered(dir).map((f) => `/cars/${folder}/${f}`);

    let gridSize = String(row.grid_size || "medium").toLowerCase();
    if (!["large", "medium", "feature"].includes(gridSize)) gridSize = "medium";

    cars.push({
      slug: row.slug || folder,
      name: row.name || folder,
      roleLabel: row.role_label || "",
      specsHover: splitPipe(row.specs_hover || ""),
      gridSize,
      order: Number(row.order) || 0,
      images: imgs,
    });
  }
  cars.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  return cars;
}

function main() {
  const outDir = path.join(publicDir, "data");
  fs.mkdirSync(outDir, { recursive: true });

  const clubs = buildClubs();
  const cars = buildCars();

  fs.writeFileSync(
    path.join(outDir, "clubs.json"),
    JSON.stringify(clubs, null, 2),
    "utf8",
  );
  fs.writeFileSync(
    path.join(outDir, "cars.json"),
    JSON.stringify(cars, null, 2),
    "utf8",
  );

  console.log(
    `build-data: ${clubs.length} clubs, ${cars.length} cars → public/data/`,
  );
}

main();
