#!/usr/bin/env node
/**
 * Phase 10 CRM flow smoke checklist (manual / staging).
 *
 *   node scripts/e2e-crm-phase10-smoke.mjs
 *   node scripts/e2e-crm-phase10-smoke.mjs --rpc
 *
 * Credentials (first match wins):
 *   - CLI after --rpc:  --rpc <url> <service_role_key>
 *   - Env / .env.local: SUPABASE_SERVICE_ROLE_KEY + SUPABASE_URL or VITE_SUPABASE_URL
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
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

function resolveSupabaseCreds(argv) {
  const rpcIdx = argv.indexOf("--rpc");
  const afterRpc = rpcIdx >= 0 ? argv.slice(rpcIdx + 1).filter((a) => !a.startsWith("-")) : [];

  if (afterRpc.length === 1 && afterRpc[0].includes("eyJ")) {
    const glued = afterRpc[0];
    const jwtStart = glued.indexOf("eyJ");
    return {
      url: glued.slice(0, jwtStart).replace(/\/$/, ""),
      key: glued.slice(jwtStart),
    };
  }
  if (afterRpc.length >= 2) {
    return { url: afterRpc[0].replace(/\/$/, ""), key: afterRpc[1] };
  }

  const localEnv = parseEnvFile(path.join(root, ".env.local"));
  const pick = (keys) => {
    for (const k of keys) {
      const v = (process.env[k] || localEnv[k] || "").trim();
      if (v) return v;
    }
    return "";
  };

  return {
    url: pick(["SUPABASE_URL", "VITE_SUPABASE_URL"]).replace(/\/$/, ""),
    key: pick(["SUPABASE_SERVICE_ROLE_KEY"]),
  };
}

const steps = [
  "1. Admin: configure club venue master (region, venue_type, guestlist rates).",
  "2. Admin: create promoter job (guestlist) for club + date.",
  "3. Promoter: add guestlist names on job; admin approves in guestlist queue.",
  "4. Website: guestlist signup + check-in for same club/date/promoter.",
  "5. Verify promoter_jobs.guests_entered / guests_joined match headcount view (no double entry).",
  "6. Enquiry: Create clients from names → single guest links enquiries.client_id.",
  "7. Admin Clients: Profile | Activity | Jobs | Notes tabs; unified timeline visible.",
  "8. Promoter invoice: generate and verify against job ledger.",
];

console.log("Cooper Concierge — Phase 10 E2E smoke checklist\n");
for (const s of steps) console.log(s);

const rpc = process.argv.includes("--rpc");
if (!rpc) {
  console.log(
    "\nOptional DB ping: node scripts/e2e-crm-phase10-smoke.mjs --rpc",
  );
  console.log("(reads VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local)");
  process.exit(0);
}

const { url, key } = resolveSupabaseCreds(process.argv);
if (!url || !key) {
  console.error("\nMissing Supabase credentials.");
  console.error("Set in .env.local:");
  console.error("  VITE_SUPABASE_URL=https://<project>.supabase.co");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=<service_role_jwt>");
  console.error("\nOr pass explicitly:");
  console.error("  node scripts/e2e-crm-phase10-smoke.mjs --rpc <url> <service_role_key>");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  return res;
}

async function main() {
  const tableRes = await rest("external_ticket_sales?select=id&limit=1");
  if (!tableRes.ok) {
    console.error("external_ticket_sales not reachable:", tableRes.status, await tableRes.text());
    process.exit(1);
  }
  console.log("\nOK: external_ticket_sales table exists (Phase 10 stub).");
  console.log("Complete manual steps above on staging.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
