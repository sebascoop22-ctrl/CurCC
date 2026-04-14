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

function requiredEnv(localEnv, key) {
  const value = (process.env[key] || localEnv[key] || "").trim();
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

async function main() {
  const localEnv = parseEnvFile(path.join(root, ".env.local"));
  const url = requiredEnv(localEnv, "VITE_SUPABASE_URL");
  const serviceRole = requiredEnv(localEnv, "SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("role", "promoter");
  if (profilesErr) throw profilesErr;
  const promoterRows = (profiles ?? []).map((p) => ({
    user_id: String(p.id),
    display_name: String(p.display_name || "Promoter"),
    approval_status: "pending",
    is_approved: false,
  }));
  if (promoterRows.length) {
    const { error } = await supabase
      .from("promoters")
      .upsert(promoterRows, { onConflict: "user_id" });
    if (error) throw error;
  }

  const { data: earnings, error: earningsErr } = await supabase
    .from("promoter_earnings")
    .select("id, earning_date, amount")
    .order("created_at", { ascending: true });
  if (earningsErr) throw earningsErr;
  let insertedTx = 0;
  for (const e of earnings ?? []) {
    const sourceRef = String(e.id || "");
    const { data: exists, error: existsErr } = await supabase
      .from("financial_transactions")
      .select("id")
      .eq("source_type", "promoter_earning")
      .eq("source_ref", sourceRef)
      .maybeSingle();
    if (existsErr) throw existsErr;
    if (exists) continue;
    const { error: insErr } = await supabase.from("financial_transactions").insert({
      tx_date: String(e.earning_date || new Date().toISOString().slice(0, 10)),
      category: "promoter_payout",
      direction: "expense",
      amount: Number(e.amount || 0),
      currency: "GBP",
      source_type: "promoter_earning",
      source_ref: sourceRef,
      notes: "Backfilled from promoter_earnings",
    });
    if (insErr) throw insErr;
    insertedTx += 1;
  }

  console.log(
    `backfill-promoter-domain: upserted ${promoterRows.length} promoters, inserted ${insertedTx} financial rows`,
  );
}

main().catch((err) => {
  console.error(`backfill-promoter-domain failed: ${err.message || String(err)}`);
  process.exitCode = 1;
});
