/**
 * Reads each public/clubs/{folder}/club.csv and public/cars/{folder}/vehicle.csv
 * Writes public/data/clubs.json and public/data/cars.json
 *
 * featured_day: YYYY-MM-DD — home "venue of the day" matches this exact date.
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

function bool(s) {
  const v = String(s).toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function buildClubs() {
  const clubsRoot = path.join(publicDir, "clubs");
  if (!fs.existsSync(clubsRoot)) {
    fs.mkdirSync(clubsRoot, { recursive: true });
    return [];
  }
  const dirs = fs
    .readdirSync(clubsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const clubs = [];
  for (const folder of dirs) {
    const dir = path.join(clubsRoot, folder);
    const csvPath = path.join(dir, "club.csv");
    if (!fs.existsSync(csvPath)) continue;
    const raw = fs.readFileSync(csvPath, "utf8");
    const rows = parseCsv(raw);
    if (!rows.length) continue;
    const row = rows[0];
    const imgs = listImagesOrdered(dir).map((f) => `/clubs/${folder}/${f}`);

    const venueType =
      String(row.venue_type || "lounge").toLowerCase() === "dining"
        ? "dining"
        : "lounge";

    clubs.push({
      slug: row.slug || folder,
      name: row.name || folder,
      shortDescription: row.short_description || "",
      longDescription: row.long_description || "",
      reviews: splitReviews(row.reviews || ""),
      locationTag: row.location_tag || "",
      address: row.address || "",
      daysOpen: row.days_open || "",
      featured: bool(row.featured),
      featuredDay: row.featured_day || "",
      venueType,
      lat: Number(row.lat) || 0,
      lng: Number(row.lng) || 0,
      accessTier: row.access_tier || "",
      minSpend: row.min_spend || "",
      amenities: splitPipe(row.amenities || ""),
      images: imgs,
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
