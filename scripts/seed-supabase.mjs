import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function requiredEnv(localEnv, key, fallbackKeys = []) {
  const keys = [key, ...fallbackKeys];
  for (const k of keys) {
    const value = (process.env[k] || localEnv[k] || "").trim();
    if (value) return value;
  }
  throw new Error(`Missing env var: ${key}`);
}

async function main() {
  const localEnv = parseEnvFile(path.join(root, ".env.local"));
  const supabaseUrl = requiredEnv(localEnv, "VITE_SUPABASE_URL");
  const serviceRole = requiredEnv(localEnv, "SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clubs = readJson(path.join(root, "public", "data", "clubs.json"));
  const cars = readJson(path.join(root, "public", "data", "cars.json"));

  const clubRows = clubs.map((club, idx) => ({
    slug: String(club.slug || "").trim(),
    name: String(club.name || "").trim() || String(club.slug || "").trim(),
    sort_order: idx + 1,
    is_active: true,
    payload: club,
  }));
  const carRows = cars.map((car, idx) => ({
    slug: String(car.slug || "").trim(),
    name: String(car.name || "").trim() || String(car.slug || "").trim(),
    sort_order: Number(car.order) || idx + 1,
    is_active: true,
    payload: car,
  }));

  const { error: clubsError } = await supabase
    .from("clubs")
    .upsert(clubRows, { onConflict: "slug" });
  if (clubsError) throw clubsError;

  const { error: carsError } = await supabase
    .from("cars")
    .upsert(carRows, { onConflict: "slug" });
  if (carsError) throw carsError;

  console.log(`seed-supabase: upserted ${clubRows.length} clubs and ${carRows.length} cars`);
}

main().catch((err) => {
  console.error(`seed-supabase failed: ${err.message || String(err)}`);
  process.exitCode = 1;
});
