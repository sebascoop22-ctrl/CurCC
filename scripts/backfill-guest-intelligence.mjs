import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    out[k] = v;
  }
  return out;
}

function required(localEnv, key) {
  const value = (process.env[key] || localEnv[key] || "").trim();
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

function splitGuestContacts(guest) {
  const contact = String(guest.guestContact || "").trim();
  if (!contact) return { phone: null, email: null, instagram: null };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) return { phone: null, email: contact.toLowerCase(), instagram: null };
  const phone = contact.replace(/\D/g, "");
  if (phone.length >= 8) return { phone, email: null, instagram: null };
  return { phone: null, email: null, instagram: contact.replace(/^@+/, "").toLowerCase() };
}

async function ensureEvent(supabase, clubSlug, dateIso) {
  const { data: existing } = await supabase
    .from("guestlist_events")
    .select("id")
    .eq("club_slug", clubSlug)
    .eq("event_date", dateIso)
    .is("promoter_id", null)
    .maybeSingle();
  if (existing?.id) return String(existing.id);
  const { data, error } = await supabase
    .from("guestlist_events")
    .insert({ club_slug: clubSlug, event_date: dateIso, status: "open", notes: "Backfilled from enquiries" })
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

async function main() {
  const env = parseEnvFile(path.join(root, ".env.local"));
  const url = required(env, "VITE_SUPABASE_URL");
  const key = required(env, "SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: enquiries, error } = await supabase
    .from("enquiries")
    .select("id,created_at,payload,enquiry_guests(guest_name,guest_contact)")
    .eq("form_name", "nightlife_guestlist")
    .order("created_at", { ascending: true });
  if (error) throw error;

  let profilesUpserted = 0;
  let signupsUpserted = 0;
  for (const enquiry of enquiries ?? []) {
    const payload = enquiry.payload || {};
    const clubSlug = String(payload.venue_slug || payload.club_slug || "").trim();
    if (!clubSlug) continue;
    const dateIso = String(enquiry.created_at || new Date().toISOString()).slice(0, 10);
    const eventId = await ensureEvent(supabase, clubSlug, dateIso);
    for (const guest of enquiry.enquiry_guests ?? []) {
      const guestName = String(guest.guest_name || "").trim();
      if (!guestName) continue;
      const idParts = splitGuestContacts(guest);
      const { data: guestId, error: upsertErr } = await supabase.rpc(
        "upsert_guest_profile_from_identity",
        {
          p_full_name: guestName,
          p_phone: idParts.phone,
          p_email: idParts.email,
          p_instagram: idParts.instagram,
          p_age: null,
          p_gender: null,
        },
      );
      if (upsertErr) throw upsertErr;
      profilesUpserted += 1;
      const { error: signupErr } = await supabase
        .from("guestlist_signups")
        .upsert(
          {
            guestlist_event_id: eventId,
            guest_profile_id: String(guestId || ""),
            source: "legacy_enquiry",
            signup_at: String(enquiry.created_at || new Date().toISOString()),
            status: "signed_up",
            metadata: { backfill: true, enquiry_id: enquiry.id },
          },
          { onConflict: "guestlist_event_id,guest_profile_id" },
        );
      if (signupErr) throw signupErr;
      signupsUpserted += 1;
    }
  }

  console.log(
    `backfill-guest-intelligence: upserted ${profilesUpserted} profile rows and ${signupsUpserted} signup rows`,
  );
}

main().catch((err) => {
  console.error(`backfill-guest-intelligence failed: ${err.message || String(err)}`);
  process.exitCode = 1;
});
