import {
  fetchCars,
  fetchClubFlyersAdmin,
  fetchClubs,
} from "../data/fetch-data";
import { gateAdminUser, signInAdmin, signOutAdmin } from "../admin/auth";
import {
  deleteCarFromDb,
  deleteClubFromDb,
  loadCarsForAdmin,
  loadClubsForAdmin,
  upsertAllCarsOrder,
  upsertAllClubsOrder,
  upsertCarToDb,
  upsertClubToDb,
} from "../admin/catalog";
import {
  createClientsFromEnquiry,
  loadClientsForAdmin,
  loadEnquiriesForAdmin,
  loadEnquiryGuests,
  updateEnquiryStatus,
  type ClientRow,
  type EnquiryGuestRow,
  type EnquiryRow,
} from "../admin/enquiries";
import { attachClubAddressAutocomplete } from "../admin/places-autocomplete";
import { getSupabaseClient } from "../lib/supabase";
import type { Car, Club, ClubFlyer, GuestlistRecurrence } from "../types";
import "../styles/pages/admin.css";

/** Desk = CRM; catalog = clubs, cars, weekly flyers */
type AdminView = "enquiries" | "clients" | "clubs" | "cars" | "flyers";

type ClubEntry = { dbId: string | null; club: Club };
type CarEntry = { dbId: string | null; car: Car };

/** Public uploads: flyers, club/car catalog images (same bucket, different path prefixes). */
const ADMIN_MEDIA_BUCKET = "club-flyers";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ENQUIRY_STATUSES = ["new", "contacted", "in_progress", "closed", "spam"] as const;

function csvEscape(v: string): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadTextFile(name: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function cloneClub(c?: Partial<Club>): Club {
  return {
    slug: c?.slug ?? "",
    name: c?.name ?? "",
    shortDescription: c?.shortDescription ?? "",
    longDescription: c?.longDescription ?? "",
    reviews: c?.reviews ?? [],
    locationTag: c?.locationTag ?? "",
    address: c?.address ?? "",
    daysOpen: c?.daysOpen ?? "",
    bestVisitDays: c?.bestVisitDays ?? [],
    featured: c?.featured ?? false,
    featuredDay: c?.featuredDay ?? "",
    venueType: c?.venueType ?? "lounge",
    lat: c?.lat ?? 0,
    lng: c?.lng ?? 0,
    minSpend: c?.minSpend ?? "",
    website: c?.website ?? "",
    entryPricingWomen: c?.entryPricingWomen ?? "",
    entryPricingMen: c?.entryPricingMen ?? "",
    tablesStandard: c?.tablesStandard ?? "",
    tablesLuxury: c?.tablesLuxury ?? "",
    tablesVip: c?.tablesVip ?? "",
    knownFor: c?.knownFor ?? [],
    amenities: c?.amenities ?? [],
    images: c?.images ?? [],
    guestlists: c?.guestlists ?? [],
  };
}

function cloneCar(c?: Partial<Car>): Car {
  return {
    slug: c?.slug ?? "",
    name: c?.name ?? "",
    roleLabel: c?.roleLabel ?? "",
    specsHover: c?.specsHover ?? [],
    gridSize: c?.gridSize ?? "medium",
    order: c?.order ?? 0,
    images: c?.images ?? [],
  };
}

function cloneFlyer(f?: Partial<ClubFlyer>): ClubFlyer {
  return {
    id: f?.id ?? "",
    clubSlug: f?.clubSlug ?? "",
    eventDate: f?.eventDate ?? "",
    title: f?.title ?? "",
    description: f?.description ?? "",
    imagePath: f?.imagePath ?? "",
    imageUrl: f?.imageUrl ?? "",
    isActive: f?.isActive ?? true,
    sortOrder: f?.sortOrder ?? 0,
  };
}

function parseVenueType(raw: string): Club["venueType"] {
  const t = raw.trim().toLowerCase();
  if (t === "dining") return "dining";
  if (t === "club") return "club";
  if (t === "lounge") return "lounge";
  return "lounge";
}

function parseLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseGuestlists(raw: string): Club["guestlists"] {
  const lines = parseLines(raw);
  return lines.map((line) => {
    const [daysRaw = "", recRaw = "weekly", notesRaw = ""] = line.split(",");
    const recurrence: GuestlistRecurrence =
      recRaw.trim().toLowerCase() === "one_off" ? "one_off" : "weekly";
    return {
      days: daysRaw
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean),
      recurrence,
      notes: notesRaw.trim(),
    };
  });
}

function guestlistsText(rows: Club["guestlists"]): string {
  return rows
    .map((g) => `${g.days.join("|")},${g.recurrence},${g.notes ?? ""}`)
    .join("\n");
}

function asClubsCsv(rows: Club[]): string {
  const header = [
    "slug",
    "name",
    "short_description",
    "long_description",
    "reviews",
    "location_tag",
    "address",
    "days_open",
    "best_visit_days",
    "featured",
    "featured_day",
    "venue_type",
    "lat",
    "lng",
    "min_spend",
    "website",
    "amenities",
    "known_for",
    "entry_pricing_women",
    "entry_pricing_men",
    "tables_standard",
    "tables_luxury",
    "tables_vip",
  ];
  const lines = [header.join(",")];
  for (const c of rows) {
    const row = [
      c.slug,
      c.name,
      c.shortDescription,
      c.longDescription,
      c.reviews.join("; "),
      c.locationTag,
      c.address,
      c.daysOpen,
      c.bestVisitDays.join("|"),
      c.featured ? "TRUE" : "FALSE",
      c.featuredDay,
      c.venueType,
      String(c.lat || 0),
      String(c.lng || 0),
      c.minSpend,
      c.website,
      c.amenities.join("|"),
      c.knownFor.join("; "),
      c.entryPricingWomen,
      c.entryPricingMen,
      c.tablesStandard,
      c.tablesLuxury,
      c.tablesVip,
    ].map(csvEscape);
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

function safeUploadPath(fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${new Date().toISOString().slice(0, 10)}/${Date.now()}_${safe}`;
}

function escapeAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function validateClubShape(club: Club): string[] {
  const err: string[] = [];
  const slug = club.slug.trim();
  if (!slug) err.push("Club slug is required.");
  else if (!SLUG_PATTERN.test(slug))
    err.push("Club slug: use lowercase letters, numbers, and hyphens only.");
  if (!club.name.trim()) err.push("Club name is required.");
  const lat = club.lat;
  const lng = club.lng;
  if (lat !== 0 || lng !== 0) {
    if (Number.isNaN(lat) || lat < -90 || lat > 90)
      err.push("Latitude must be between -90 and 90.");
    if (Number.isNaN(lng) || lng < -180 || lng > 180)
      err.push("Longitude must be between -180 and 180.");
  }
  const w = club.website.trim();
  if (w) {
    try {
      const u = w.includes("://") ? w : `https://${w}`;
      new URL(u);
    } catch {
      err.push("Website does not look like a valid URL.");
    }
  }
  return err;
}

function validateCarShape(car: Car): string[] {
  const err: string[] = [];
  const slug = car.slug.trim();
  if (!slug) err.push("Car slug is required.");
  else if (!SLUG_PATTERN.test(slug))
    err.push("Car slug: use lowercase letters, numbers, and hyphens only.");
  if (!car.name.trim()) err.push("Car name is required.");
  const g = car.gridSize;
  if (g !== "large" && g !== "medium" && g !== "feature")
    err.push("Grid size must be large, medium, or feature.");
  return err;
}

function validateFlyerShape(f: ClubFlyer, entries: ClubEntry[]): string[] {
  const err: string[] = [];
  const slug = f.clubSlug.trim();
  if (!slug) err.push("Select a club.");
  else {
    const entry = entries.find((x) => x.club.slug.trim() === slug);
    if (!entry?.dbId)
      err.push(
        "That club is not in the database yet—open Catalog → Clubs and save it first.",
      );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.eventDate.trim()))
    err.push("Event date must be YYYY-MM-DD.");
  if (!f.title.trim()) err.push("Flyer title is required.");
  if (!f.imageUrl.trim() && !f.imagePath.trim())
    err.push("Add a flyer image (upload or paste a public image URL).");
  return err;
}

function flyerClubSelectOptions(
  entries: ClubEntry[],
  selectedSlug: string,
): string {
  if (!entries.length) {
    return `<option value="">No clubs—add one under Catalog → Clubs</option>`;
  }
  const sel = selectedSlug.trim();
  return entries
    .map((entry) => {
      const s = entry.club.slug.trim();
      const label = `${entry.club.name} (${s})`;
      const selected = s === sel ? " selected" : "";
      return `<option value="${escapeAttr(s)}"${selected}>${escapeAttr(label)}</option>`;
    })
    .join("");
}

function renderClientDetail(c: ClientRow): string {
  return `
      <div class="admin-client-detail">
        <h4 class="admin-subhead" style="margin-top: 0">Client</h4>
        <dl class="admin-enquiry-meta">
          <div><dt>Added</dt><dd>${escapeAttr(c.created_at || "—")}</dd></div>
          <div><dt>Name</dt><dd>${escapeAttr(c.name ?? "—")}</dd></div>
          <div><dt>Email</dt><dd>${escapeAttr(c.email ?? "—")}</dd></div>
          <div><dt>Phone</dt><dd>${escapeAttr(c.phone ?? "—")}</dd></div>
          <div><dt>Instagram</dt><dd>${escapeAttr(c.instagram ?? "—")}</dd></div>
        </dl>
      </div>`;
}

export async function initAdminPortal(): Promise<void> {
  const adminRoot = document.getElementById("admin-root");
  if (!adminRoot) return;

  const supabase = getSupabaseClient();
  if (!supabase) {
    adminRoot.innerHTML = `
      <div class="admin-card">
        <h3>Supabase not configured</h3>
        <p class="admin-note">Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code>, then restart the dev server.</p>
      </div>`;
    return;
  }

  let view: AdminView = "enquiries";
  let selectedClub = 0;
  let selectedCar = 0;
  let selectedFlyer = 0;
  let selectedEnquiry: string | null = null;
  let selectedClientId: string | null = null;
  let clubEntries: ClubEntry[] = [];
  let carEntries: CarEntry[] = [];
  let flyers: ClubFlyer[] = [];
  let enquiries: EnquiryRow[] = [];
  let enquiryGuests: EnquiryGuestRow[] = [];
  let clients: ClientRow[] = [];
  let loginError = "";

  async function loadClubEntries(): Promise<ClubEntry[]> {
    const db = await loadClubsForAdmin(supabase);
    if (db.ok && db.rows.length > 0) {
      return db.rows.map((r) => ({
        dbId: r.id,
        club: cloneClub(r.payload),
      }));
    }
    const staticClubs = await fetchClubs().catch(() => [] as Club[]);
    return staticClubs.map((c) => ({ dbId: null, club: cloneClub(c) }));
  }

  async function loadCarEntries(): Promise<CarEntry[]> {
    const db = await loadCarsForAdmin(supabase);
    if (db.ok && db.rows.length > 0) {
      return db.rows.map((r) => ({
        dbId: r.id,
        car: cloneCar(r.payload),
      }));
    }
    const staticCars = await fetchCars().catch(() => [] as Car[]);
    return staticCars.map((c) => ({ dbId: null, car: cloneCar(c) }));
  }

  async function syncClubIdsFromDb(): Promise<void> {
    const db = await loadClubsForAdmin(supabase);
    if (!db.ok) return;
    const bySlug = new Map(db.rows.map((r) => [r.slug, r.id]));
    clubEntries = clubEntries.map((e) => ({
      ...e,
      dbId: bySlug.get(e.club.slug.trim()) ?? e.dbId,
    }));
  }

  async function syncCarIdsFromDb(): Promise<void> {
    const db = await loadCarsForAdmin(supabase);
    if (!db.ok) return;
    const bySlug = new Map(db.rows.map((r) => [r.slug, r.id]));
    carEntries = carEntries.map((e) => ({
      ...e,
      dbId: bySlug.get(e.car.slug.trim()) ?? e.dbId,
    }));
  }

  async function reloadFlyers(): Promise<void> {
    flyers = (await fetchClubFlyersAdmin(supabase)).map((f) => cloneFlyer(f));
    selectedFlyer = Math.min(selectedFlyer, Math.max(0, flyers.length - 1));
  }

  async function reloadEnquiries(): Promise<void> {
    const r = await loadEnquiriesForAdmin(supabase);
    if (r.ok) enquiries = r.rows;
    if (selectedEnquiry && !enquiries.some((e) => e.id === selectedEnquiry)) {
      selectedEnquiry = enquiries[0]?.id ?? null;
    }
    if (selectedEnquiry) {
      const g = await loadEnquiryGuests(supabase, selectedEnquiry);
      enquiryGuests = g.ok ? g.rows : [];
    } else {
      enquiryGuests = [];
    }
  }

  async function reloadClients(): Promise<void> {
    const r = await loadClientsForAdmin(supabase);
    if (r.ok) clients = r.rows;
    if (selectedClientId && !clients.some((c) => c.id === selectedClientId)) {
      selectedClientId = clients[0]?.id ?? null;
    }
    if (!selectedClientId && clients[0]) selectedClientId = clients[0].id;
  }

  async function reloadAllFromDb(): Promise<void> {
    clubEntries = await loadClubEntries();
    carEntries = await loadCarEntries();
    await reloadFlyers();
    await reloadEnquiries();
    await reloadClients();
    selectedClub = Math.min(selectedClub, Math.max(0, clubEntries.length - 1));
    selectedCar = Math.min(selectedCar, Math.max(0, carEntries.length - 1));
  }

  function flash(msg: string, tone: "ok" | "error" = "ok"): void {
    const el = adminRoot.querySelector("#admin-flash");
    if (el) {
      el.textContent = msg;
      el.classList.toggle("admin-flash--error", tone === "error");
      setTimeout(() => {
        if (el.textContent === msg) {
          el.textContent = "";
          el.classList.remove("admin-flash--error");
        }
      }, 4200);
    }
  }

  function renderLogin(): void {
    adminRoot.innerHTML = `
      <div class="admin-card admin-login-card">
        <h3>Admin sign in</h3>
        <p class="admin-note">Use a Supabase Auth account whose row in <code>public.profiles</code> has <code>role = 'admin'</code>.</p>
        ${
          loginError
            ? `<div class="admin-flash admin-flash--error" id="admin-login-error">${escapeAttr(loginError)}</div>`
            : ""
        }
        <form class="admin-login-form" id="admin-login-form">
          <div class="cc-field">
            <label for="admin-email">Email</label>
            <input id="admin-email" name="email" type="email" autocomplete="username" required />
          </div>
          <div class="cc-field">
            <label for="admin-password">Password</label>
            <input id="admin-password" name="password" type="password" autocomplete="current-password" required />
          </div>
          <button class="cc-btn cc-btn--gold" type="submit">Sign in</button>
        </form>
        <div class="admin-flash" id="admin-flash"></div>
      </div>`;
    loginError = "";
    adminRoot.querySelector("#admin-login-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const fd = new FormData(form);
      const email = String(fd.get("email") || "").trim();
      const password = String(fd.get("password") || "");
      void (async () => {
        const res = await signInAdmin(supabase, email, password);
        if (!res.ok) {
          loginError = res.message;
          renderLogin();
          return;
        }
        adminRoot.innerHTML = `<div class="admin-card"><p class="admin-note">Loading admin…</p></div>`;
        await loadAdminDashboard();
      })();
    });
  }

  function renderEnquiryDetail(e: EnquiryRow): string {
    const payloadPretty = JSON.stringify(e.payload, null, 2);
    const guestsHtml =
      enquiryGuests.length === 0
        ? "<p class=\"admin-hint\">No structured guest rows (or not a guestlist enquiry).</p>"
        : `<ul class="admin-guest-list">${enquiryGuests
            .map(
              (g) =>
                `<li><strong>${escapeAttr(g.guest_name)}</strong> — ${escapeAttr(g.guest_contact)}</li>`,
            )
            .join("")}</ul>`;
    const statusOpts = ENQUIRY_STATUSES.map(
      (s) =>
        `<option value="${s}" ${e.status === s ? "selected" : ""}>${escapeAttr(s)}</option>`,
    ).join("");
    return `
      <div class="admin-enquiry-detail">
        <div class="admin-toolbar" style="margin-top:0">
          <label class="admin-inline-label">Status
            <select id="enquiry-status-select" data-enquiry-id="${escapeAttr(e.id)}">${statusOpts}</select>
          </label>
          <button type="button" class="cc-btn cc-btn--gold" id="enquiry-status-save">Update status</button>
          <button type="button" class="cc-btn cc-btn--ghost" id="enquiry-create-clients" data-enquiry-id="${escapeAttr(e.id)}">Create clients from names</button>
        </div>
        <dl class="admin-enquiry-meta">
          <div><dt>Form</dt><dd>${escapeAttr(e.form_label)}</dd></div>
          <div><dt>Service</dt><dd>${escapeAttr(e.service)}</dd></div>
          <div><dt>Submitted</dt><dd>${escapeAttr(e.submitted_at || e.created_at)}</dd></div>
          <div><dt>Name</dt><dd>${escapeAttr(e.name ?? "—")}</dd></div>
          <div><dt>Email</dt><dd>${escapeAttr(e.email ?? "—")}</dd></div>
          <div><dt>Phone</dt><dd>${escapeAttr(e.phone ?? "—")}</dd></div>
        </dl>
        <h4 class="admin-subhead">Guest list (booker first, then party)</h4>
        ${guestsHtml}
        <h4 class="admin-subhead">Payload (JSON)</h4>
        <pre class="admin-json">${escapeAttr(payloadPretty)}</pre>
      </div>`;
  }

  function renderDashboard(): void {
    const club = clubEntries[selectedClub]?.club ?? cloneClub();
    const car = carEntries[selectedCar]?.car ?? cloneCar();
    const flyer = flyers[selectedFlyer] ?? cloneFlyer();
    const enquiry = selectedEnquiry
      ? enquiries.find((x) => x.id === selectedEnquiry)
      : enquiries[0];
    if (!selectedEnquiry && enquiry) selectedEnquiry = enquiry.id;

    if (view === "clients") {
      if (!clients.length) selectedClientId = null;
      else if (
        !selectedClientId ||
        !clients.some((c) => c.id === selectedClientId)
      ) {
        selectedClientId = clients[0].id;
      }
    }
    const clientRow =
      view === "clients" && selectedClientId
        ? clients.find((c) => c.id === selectedClientId)
        : undefined;

    const vt = club.venueType;
    const gs = car.gridSize;

    adminRoot.innerHTML = `
      <div class="admin-card">
        <div class="admin-toolbar admin-toolbar--sections">
          <div class="admin-section-group">
            <span class="admin-section-label">Desk</span>
            <div class="admin-tabs">
              <button type="button" class="admin-view-tab ${view === "enquiries" ? "is-active" : ""}" data-view="enquiries">Enquiries</button>
              <button type="button" class="admin-view-tab ${view === "clients" ? "is-active" : ""}" data-view="clients">Clients</button>
            </div>
          </div>
          <div class="admin-section-group">
            <span class="admin-section-label">Catalog</span>
            <div class="admin-tabs">
              <button type="button" class="admin-view-tab ${view === "clubs" ? "is-active" : ""}" data-view="clubs">Clubs</button>
              <button type="button" class="admin-view-tab ${view === "cars" ? "is-active" : ""}" data-view="cars">Cars</button>
              <button type="button" class="admin-view-tab ${view === "flyers" ? "is-active" : ""}" data-view="flyers">Flyers</button>
            </div>
          </div>
        </div>
        <div class="admin-toolbar">
          <button class="cc-btn cc-btn--ghost" id="admin-logout" type="button">Sign out</button>
          <button class="cc-btn cc-btn--ghost" id="admin-reload-db" type="button">Reload from database</button>
          <button class="cc-btn cc-btn--ghost" id="admin-export-json" type="button">Export JSON</button>
          <button class="cc-btn cc-btn--ghost" id="admin-export-clubs-csv" type="button">Export clubs.csv</button>
          ${
            view === "clubs"
              ? `<button class="cc-btn cc-btn--gold" id="admin-save-club" type="button">Save club to DB</button>
                 <button class="cc-btn cc-btn--ghost" id="admin-save-all-clubs" type="button">Save all clubs</button>`
              : ""
          }
          ${
            view === "cars"
              ? `<button class="cc-btn cc-btn--gold" id="admin-save-car" type="button">Save car to DB</button>
                 <button class="cc-btn cc-btn--ghost" id="admin-save-all-cars" type="button">Save all cars</button>`
              : ""
          }
        </div>
        <div class="admin-grid">
          <aside>
            <p class="admin-hint">${
              view === "enquiries"
                ? "Select an enquiry."
                : view === "clients"
                  ? "Client records (from enquiries and imports)."
                  : "Select an item to edit."
            }</p>
            <div class="admin-list" id="admin-list"></div>
            <div class="admin-actions">
              ${
                view === "clubs" || view === "cars" || view === "flyers"
                  ? `<button class="cc-btn cc-btn--ghost" type="button" id="admin-add">Add new</button>
                     <button class="cc-btn cc-btn--ghost" type="button" id="admin-delete">Delete selected</button>`
                  : ""
              }
            </div>
          </aside>
          <section id="admin-form-wrap">
            ${
              view === "clubs"
                ? `
            <form class="admin-form" id="club-form">
              <div class="cc-field"><label for="club-slug">Slug</label><input id="club-slug" name="slug" required value="${escapeAttr(club.slug)}" /></div>
              <div class="cc-field"><label for="club-name">Name</label><input id="club-name" name="name" required value="${escapeAttr(club.name)}" /></div>
              <div class="cc-field full"><label>Short description</label><textarea name="shortDescription">${escapeAttr(club.shortDescription)}</textarea></div>
              <div class="cc-field full"><label>Long description</label><textarea name="longDescription">${escapeAttr(club.longDescription)}</textarea></div>
              <div class="cc-field"><label>Location tag</label><input name="locationTag" value="${escapeAttr(club.locationTag)}" /></div>
              <div class="cc-field full">
                <label for="club-address-input">Address</label>
                <input id="club-address-input" name="address" autocomplete="off" value="${escapeAttr(club.address)}" />
                <p class="admin-maps-hint" id="club-address-maps-hint"></p>
              </div>
              <div class="cc-field"><label>Days open</label><input name="daysOpen" value="${escapeAttr(club.daysOpen)}" /></div>
              <div class="cc-field"><label>Best visit days (pipe)</label><input name="bestVisitDays" value="${escapeAttr(club.bestVisitDays.join("|"))}" /></div>
              <div class="cc-field"><label>Featured day</label><input name="featuredDay" value="${escapeAttr(club.featuredDay)}" /></div>
              <div class="cc-field"><label>Venue type</label>
                <select name="venueType">
                  <option value="lounge" ${vt === "lounge" ? "selected" : ""}>Lounge</option>
                  <option value="club" ${vt === "club" ? "selected" : ""}>Club</option>
                  <option value="dining" ${vt === "dining" ? "selected" : ""}>Dining</option>
                </select>
              </div>
              <div class="cc-field"><label>Lat</label><input name="lat" type="number" step="any" value="${club.lat}" /></div>
              <div class="cc-field"><label>Lng</label><input name="lng" type="number" step="any" value="${club.lng}" /></div>
              <div class="cc-field"><label>Min spend</label><input name="minSpend" value="${escapeAttr(club.minSpend)}" /></div>
              <div class="cc-field"><label>Website</label><input name="website" placeholder="https://…" value="${escapeAttr(club.website)}" /></div>
              <div class="cc-field"><label>Entry (women)</label><input name="entryPricingWomen" value="${escapeAttr(club.entryPricingWomen)}" /></div>
              <div class="cc-field"><label>Entry (men)</label><input name="entryPricingMen" value="${escapeAttr(club.entryPricingMen)}" /></div>
              <div class="cc-field"><label>Tables standard</label><input name="tablesStandard" value="${escapeAttr(club.tablesStandard)}" /></div>
              <div class="cc-field"><label>Tables luxury</label><input name="tablesLuxury" value="${escapeAttr(club.tablesLuxury)}" /></div>
              <div class="cc-field"><label>Tables VIP</label><input name="tablesVip" value="${escapeAttr(club.tablesVip)}" /></div>
              <div class="cc-field"><label>Featured on site</label>
                <select name="featured">
                  <option value="true" ${club.featured ? "selected" : ""}>Yes</option>
                  <option value="false" ${!club.featured ? "selected" : ""}>No</option>
                </select>
              </div>
              <div class="cc-field full"><label>Reviews (one per line)</label><textarea name="reviews">${escapeAttr(club.reviews.join("\n"))}</textarea></div>
              <div class="cc-field full"><label>Known for (one per line)</label><textarea name="knownFor">${escapeAttr(club.knownFor.join("\n"))}</textarea></div>
              <div class="cc-field full"><label>Amenities (one per line)</label><textarea name="amenities">${escapeAttr(club.amenities.join("\n"))}</textarea></div>
              <div class="cc-field full"><label>Images (one URL per line)</label><textarea name="images" id="club-images-text">${escapeAttr(club.images.join("\n"))}</textarea></div>
              <div class="cc-field full admin-upload-row">
                <label for="club-image-file">Upload image</label>
                <input id="club-image-file" type="file" accept="image/*" />
                <button type="button" class="cc-btn cc-btn--ghost" id="club-image-upload">Upload to storage &amp; append URL</button>
              </div>
              <div class="cc-field full"><label>Guestlists (days,recurrence,notes per line)</label><textarea name="guestlists">${escapeAttr(guestlistsText(club.guestlists))}</textarea></div>
            </form>`
                : view === "cars"
                  ? `
            <form class="admin-form" id="car-form">
              <div class="cc-field"><label for="car-slug">Slug</label><input id="car-slug" name="slug" required value="${escapeAttr(car.slug)}" /></div>
              <div class="cc-field"><label for="car-name">Name</label><input id="car-name" name="name" required value="${escapeAttr(car.name)}" /></div>
              <div class="cc-field"><label>Role label</label><input name="roleLabel" value="${escapeAttr(car.roleLabel)}" /></div>
              <div class="cc-field"><label>Grid size</label>
                <select name="gridSize">
                  <option value="large" ${gs === "large" ? "selected" : ""}>Large</option>
                  <option value="medium" ${gs === "medium" ? "selected" : ""}>Medium</option>
                  <option value="feature" ${gs === "feature" ? "selected" : ""}>Feature</option>
                </select>
              </div>
              <div class="cc-field"><label>Order</label><input name="order" type="number" step="1" value="${car.order}" /></div>
              <div class="cc-field full"><label>Specs (one per line)</label><textarea name="specsHover">${escapeAttr(car.specsHover.join("\n"))}</textarea></div>
              <div class="cc-field full"><label>Images (one URL per line)</label><textarea name="images" id="car-images-text">${escapeAttr(car.images.join("\n"))}</textarea></div>
              <div class="cc-field full admin-upload-row">
                <label for="car-image-file">Upload image</label>
                <input id="car-image-file" type="file" accept="image/*" />
                <button type="button" class="cc-btn cc-btn--ghost" id="car-image-upload">Upload to storage &amp; append URL</button>
              </div>
            </form>`
                  : view === "flyers"
                    ? `
            <form class="admin-form" id="flyer-form">
              <div class="cc-field full"><label for="flyer-club-select">Club</label>
                <select id="flyer-club-select" name="clubSlug" required>${flyerClubSelectOptions(clubEntries, flyer.clubSlug)}</select>
              </div>
              <div class="cc-field"><label for="flyer-event-date">Event date</label><input id="flyer-event-date" name="eventDate" type="date" required value="${escapeAttr(flyer.eventDate)}" /></div>
              <div class="cc-field full"><label>Title</label><input name="title" required value="${escapeAttr(flyer.title)}" /></div>
              <div class="cc-field full"><label>Description</label><textarea name="description">${escapeAttr(flyer.description)}</textarea></div>
              <div class="cc-field"><label>Sort order</label><input name="sortOrder" type="number" step="1" value="${flyer.sortOrder}" /></div>
              <div class="cc-field"><label>Active</label>
                <select name="isActive">
                  <option value="true" ${flyer.isActive ? "selected" : ""}>Yes</option>
                  <option value="false" ${!flyer.isActive ? "selected" : ""}>No</option>
                </select>
              </div>
              <div class="cc-field full"><label>Image URL</label><input name="imageUrl" placeholder="Filled automatically after upload" value="${escapeAttr(flyer.imageUrl)}" /></div>
              <div class="cc-field full"><label>Image path (storage)</label><input name="imagePath" value="${escapeAttr(flyer.imagePath)}" readonly /></div>
              <div class="cc-field full">
                <label for="flyer-image-file">Upload image</label>
                <input id="flyer-image-file" type="file" accept="image/*" />
              </div>
              <div class="admin-actions full">
                <button class="cc-btn cc-btn--ghost" type="button" id="flyer-upload">Upload selected image</button>
                <button class="cc-btn cc-btn--gold" type="button" id="flyer-save-db">${flyer.id ? "Update flyer" : "Create flyer"}</button>
              </div>
            </form>`
                    : view === "enquiries"
                      ? enquiry
                        ? renderEnquiryDetail(enquiry)
                        : `<p class="admin-note">No enquiries yet.</p>`
                      : clientRow
                        ? renderClientDetail(clientRow)
                        : `<p class="admin-note">No clients yet. Use “Create clients from names” on a guestlist enquiry.</p>`
            }
          </section>
        </div>
        <p class="admin-hint">Desk: enquiries and imported clients. Catalog: <code>public.clubs</code>, <code>public.cars</code>, and weekly flyers (club must be saved to the DB first). Images upload to the <code>${escapeAttr(ADMIN_MEDIA_BUCKET)}</code> storage bucket.</p>
        <div class="admin-flash" id="admin-flash"></div>
      </div>
    `;

    bindDashboardEvents();
  }

  function bindDashboardEvents(): void {
    adminRoot.querySelectorAll(".admin-view-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = (btn as HTMLButtonElement).dataset.view as AdminView | undefined;
        if (!v) return;
        view = v;
        if (v === "enquiries") void reloadEnquiries().then(() => renderDashboard());
        else if (v === "clients") void reloadClients().then(() => renderDashboard());
        else renderDashboard();
      });
    });

    adminRoot.querySelector("#admin-logout")?.addEventListener("click", () => {
      void signOutAdmin(supabase).then(() => renderLogin());
    });

    adminRoot.querySelector("#admin-reload-db")?.addEventListener("click", () => {
      void (async () => {
        await reloadAllFromDb();
        flash("Reloaded from database.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#admin-export-json")?.addEventListener("click", () => {
      downloadTextFile(
        "clubs.json",
        JSON.stringify(clubEntries.map((e) => e.club), null, 2),
      );
      downloadTextFile(
        "cars.json",
        JSON.stringify(carEntries.map((e) => e.car), null, 2),
      );
      flash("Exported clubs.json and cars.json.");
    });

    adminRoot.querySelector("#admin-export-clubs-csv")?.addEventListener("click", () => {
      downloadTextFile(
        "clubs.csv",
        asClubsCsv(clubEntries.map((e) => e.club)),
      );
      flash("Exported clubs.csv.");
    });

    adminRoot.querySelector("#admin-save-club")?.addEventListener("click", () => {
      const c = clubEntries[selectedClub]?.club;
      if (!c) return;
      const v = validateClubShape(c);
      if (v.length) {
        flash(v.join(" "), "error");
        return;
      }
      void (async () => {
        const res = await upsertClubToDb(supabase, c, {
          sortOrder: selectedClub + 1,
          isActive: true,
        });
        if (!res.ok) {
          flash(`Save failed: ${res.message}`, "error");
          return;
        }
        await syncClubIdsFromDb();
        flash("Club saved to database.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#admin-save-all-clubs")?.addEventListener("click", () => {
      void (async () => {
        for (const e of clubEntries) {
          const v = validateClubShape(e.club);
          if (v.length) {
            flash(`Fix “${e.club.slug}”: ${v.join(" ")}`, "error");
            return;
          }
        }
        const res = await upsertAllClubsOrder(
          supabase,
          clubEntries.map((e) => e.club),
        );
        if (!res.ok) {
          flash(`Save failed: ${res.message}`, "error");
          return;
        }
        await syncClubIdsFromDb();
        flash("All clubs saved.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#admin-save-car")?.addEventListener("click", () => {
      const c = carEntries[selectedCar]?.car;
      if (!c) return;
      const v = validateCarShape(c);
      if (v.length) {
        flash(v.join(" "), "error");
        return;
      }
      void (async () => {
        const res = await upsertCarToDb(supabase, c, {
          sortOrder: c.order || selectedCar + 1,
          isActive: true,
        });
        if (!res.ok) {
          flash(`Save failed: ${res.message}`, "error");
          return;
        }
        await syncCarIdsFromDb();
        flash("Car saved to database.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#admin-save-all-cars")?.addEventListener("click", () => {
      void (async () => {
        for (const e of carEntries) {
          const v = validateCarShape(e.car);
          if (v.length) {
            flash(`Fix “${e.car.slug}”: ${v.join(" ")}`, "error");
            return;
          }
        }
        const res = await upsertAllCarsOrder(
          supabase,
          carEntries.map((e) => e.car),
        );
        if (!res.ok) {
          flash(`Save failed: ${res.message}`, "error");
          return;
        }
        await syncCarIdsFromDb();
        flash("All cars saved.");
        renderDashboard();
      })();
    });

    const listEl = adminRoot.querySelector("#admin-list");
    if (listEl) {
      if (view === "enquiries") {
        listEl.innerHTML = enquiries
          .map(
            (e, i) =>
              `<button type="button" data-enquiry-id="${escapeAttr(e.id)}" class="${e.id === selectedEnquiry ? "is-active" : ""}">
              ${escapeAttr(e.submitted_at?.slice(0, 10) || e.created_at?.slice(0, 10) || "—")} · ${escapeAttr(e.form_label)} · ${escapeAttr(e.status)}
            </button>`,
          )
          .join("");
        listEl.querySelectorAll("button[data-enquiry-id]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = (btn as HTMLButtonElement).dataset.enquiryId ?? null;
            selectedEnquiry = id;
            void (async () => {
              if (id) {
                const g = await loadEnquiryGuests(supabase, id);
                enquiryGuests = g.ok ? g.rows : [];
              } else enquiryGuests = [];
              renderDashboard();
            })();
          });
        });
      } else if (view === "clients") {
        listEl.innerHTML = clients
          .map(
            (c) =>
              `<button type="button" data-client-id="${escapeAttr(c.id)}" class="${c.id === selectedClientId ? "is-active" : ""}">
              ${escapeAttr(c.name || c.email || c.phone || c.instagram || c.id.slice(0, 8))}
            </button>`,
          )
          .join("");
        listEl.querySelectorAll("button[data-client-id]").forEach((btn) => {
          btn.addEventListener("click", () => {
            selectedClientId =
              (btn as HTMLButtonElement).dataset.clientId ?? null;
            renderDashboard();
          });
        });
      } else if (view === "flyers") {
        const activeIndex = selectedFlyer;
        listEl.innerHTML = flyers
          .map(
            (f, i) =>
              `<button type="button" data-i="${i}" class="${i === activeIndex ? "is-active" : ""}">${escapeAttr(`${f.clubSlug} · ${f.eventDate}`)}</button>`,
          )
          .join("");
        listEl.querySelectorAll("button[data-i]").forEach((btn) => {
          btn.addEventListener("click", () => {
            selectedFlyer = Number((btn as HTMLButtonElement).dataset.i ?? "0");
            renderDashboard();
          });
        });
      } else {
        const isClubs = view === "clubs";
        const items = isClubs ? clubEntries : carEntries;
        const activeIndex = isClubs ? selectedClub : selectedCar;
        listEl.innerHTML = items
          .map((entry, i) => {
            const label = isClubs
              ? `${(entry as ClubEntry).club.slug} · ${(entry as ClubEntry).club.name}`
              : `${(entry as CarEntry).car.slug} · ${(entry as CarEntry).car.name}`;
            return `<button type="button" data-i="${i}" class="${i === activeIndex ? "is-active" : ""}">${escapeAttr(label)}</button>`;
          })
          .join("");
        listEl.querySelectorAll("button[data-i]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const i = Number((btn as HTMLButtonElement).dataset.i ?? "0");
            if (isClubs) selectedClub = i;
            else selectedCar = i;
            renderDashboard();
          });
        });
      }
    }

    adminRoot.querySelector("#admin-add")?.addEventListener("click", () => {
      if (view === "clubs") {
        clubEntries.push({
          dbId: null,
          club: cloneClub({ slug: "new-club", name: "New Club" }),
        });
        selectedClub = clubEntries.length - 1;
      } else if (view === "cars") {
        carEntries.push({
          dbId: null,
          car: cloneCar({ slug: "new-car", name: "New Car" }),
        });
        selectedCar = carEntries.length - 1;
      } else {
        flyers.push(
          cloneFlyer({
            clubSlug: clubEntries[0]?.club.slug ?? "",
            eventDate: new Date().toISOString().slice(0, 10),
            title: "Weekly flyer",
            isActive: true,
          }),
        );
        selectedFlyer = flyers.length - 1;
      }
      renderDashboard();
    });

    adminRoot.querySelector("#admin-delete")?.addEventListener("click", () => {
      if (view === "clubs" && clubEntries.length) {
        const victim = clubEntries[selectedClub];
        const slug = victim?.club.slug.trim();
        void (async () => {
          if (slug) {
            const res = await deleteClubFromDb(supabase, slug);
            if (!res.ok) {
              flash(`Delete failed: ${res.message}`, "error");
              return;
            }
          }
          clubEntries.splice(selectedClub, 1);
          selectedClub = Math.max(0, selectedClub - 1);
          flash(slug ? "Club removed from database." : "Draft removed.");
          renderDashboard();
        })();
        return;
      }
      if (view === "cars" && carEntries.length) {
        const victim = carEntries[selectedCar];
        const slug = victim?.car.slug.trim();
        void (async () => {
          if (slug) {
            const res = await deleteCarFromDb(supabase, slug);
            if (!res.ok) {
              flash(`Delete failed: ${res.message}`, "error");
              return;
            }
          }
          carEntries.splice(selectedCar, 1);
          selectedCar = Math.max(0, selectedCar - 1);
          flash(slug ? "Car removed from database." : "Draft removed.");
          renderDashboard();
        })();
        return;
      }
      if (view === "flyers" && flyers.length) {
        const victim = flyers[selectedFlyer];
        if (victim?.id) {
          void (async () => {
            const { error } = await supabase
              .from("club_weekly_flyers")
              .delete()
              .eq("id", victim.id);
            if (error) {
              flash(`Delete failed: ${error.message}`, "error");
              return;
            }
            await reloadFlyers();
            flash("Flyer deleted.");
            renderDashboard();
          })();
          return;
        }
        flyers.splice(selectedFlyer, 1);
        selectedFlyer = Math.max(0, selectedFlyer - 1);
        renderDashboard();
      }
    });

    const clubForm = adminRoot.querySelector("#club-form");
    if (clubForm) {
      const syncClubFromForm = (): void => {
        const fd = new FormData(clubForm as HTMLFormElement);
        clubEntries[selectedClub] = {
          ...clubEntries[selectedClub],
          club: cloneClub({
            ...clubEntries[selectedClub]?.club,
            slug: String(fd.get("slug") || "").trim(),
            name: String(fd.get("name") || "").trim(),
            shortDescription: String(fd.get("shortDescription") || "").trim(),
            longDescription: String(fd.get("longDescription") || "").trim(),
            reviews: parseLines(String(fd.get("reviews") || "")),
            locationTag: String(fd.get("locationTag") || "").trim(),
            address: String(fd.get("address") || "").trim(),
            daysOpen: String(fd.get("daysOpen") || "").trim(),
            bestVisitDays: String(fd.get("bestVisitDays") || "")
              .split("|")
              .map((x) => x.trim())
              .filter(Boolean),
            featured: String(fd.get("featured") || "")
              .toLowerCase()
              .includes("true"),
            featuredDay: String(fd.get("featuredDay") || "").trim(),
            venueType: parseVenueType(String(fd.get("venueType") || "")),
            lat: Number(fd.get("lat") || 0) || 0,
            lng: Number(fd.get("lng") || 0) || 0,
            minSpend: String(fd.get("minSpend") || "").trim(),
            website: String(fd.get("website") || "").trim(),
            entryPricingWomen: String(fd.get("entryPricingWomen") || "").trim(),
            entryPricingMen: String(fd.get("entryPricingMen") || "").trim(),
            tablesStandard: String(fd.get("tablesStandard") || "").trim(),
            tablesLuxury: String(fd.get("tablesLuxury") || "").trim(),
            tablesVip: String(fd.get("tablesVip") || "").trim(),
            knownFor: parseLines(String(fd.get("knownFor") || "")),
            amenities: parseLines(String(fd.get("amenities") || "")),
            images: parseLines(String(fd.get("images") || "")),
            guestlists: parseGuestlists(String(fd.get("guestlists") || "")),
          }),
        };
      };
      clubForm.addEventListener("input", syncClubFromForm);
      clubForm.addEventListener("change", syncClubFromForm);
    }

    adminRoot.querySelector("#club-image-upload")?.addEventListener("click", () => {
      const slug = clubEntries[selectedClub]?.club.slug.trim() ?? "";
      if (!slug || !SLUG_PATTERN.test(slug)) {
        flash("Set a valid lowercase slug (letters, numbers, hyphens) before uploading.", "error");
        return;
      }
      const input = adminRoot.querySelector("#club-image-file") as HTMLInputElement | null;
      const ta = adminRoot.querySelector("#club-images-text") as HTMLTextAreaElement | null;
      const file = input?.files?.[0];
      if (!file || !ta) {
        flash("Choose an image file.", "error");
        return;
      }
      void (async () => {
        const path = `catalog/clubs/${slug}/${safeUploadPath(file.name)}`;
        const { error } = await supabase.storage
          .from(ADMIN_MEDIA_BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) {
          flash(`Upload failed: ${error.message}`, "error");
          return;
        }
        const pub = supabase.storage.from(ADMIN_MEDIA_BUCKET).getPublicUrl(path);
        const line = pub.data.publicUrl;
        const cur = ta.value.trim();
        ta.value = cur ? `${cur}\n${line}` : line;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        flash("Club image uploaded — URL appended.");
      })();
    });

    const carForm = adminRoot.querySelector("#car-form");
    if (carForm) {
      const syncCarFromForm = (): void => {
        const fd = new FormData(carForm as HTMLFormElement);
        const rawGrid = String(fd.get("gridSize") || "medium").trim();
        carEntries[selectedCar] = {
          ...carEntries[selectedCar],
          car: cloneCar({
            ...carEntries[selectedCar]?.car,
            slug: String(fd.get("slug") || "").trim(),
            name: String(fd.get("name") || "").trim(),
            roleLabel: String(fd.get("roleLabel") || "").trim(),
            order: Number(fd.get("order") || 0) || 0,
            gridSize:
              rawGrid === "large" || rawGrid === "feature" ? rawGrid : "medium",
            specsHover: parseLines(String(fd.get("specsHover") || "")),
            images: parseLines(String(fd.get("images") || "")),
          }),
        };
      };
      carForm.addEventListener("input", syncCarFromForm);
      carForm.addEventListener("change", syncCarFromForm);
    }

    adminRoot.querySelector("#car-image-upload")?.addEventListener("click", () => {
      const slug = carEntries[selectedCar]?.car.slug.trim() ?? "";
      if (!slug || !SLUG_PATTERN.test(slug)) {
        flash("Set a valid lowercase slug before uploading.", "error");
        return;
      }
      const input = adminRoot.querySelector("#car-image-file") as HTMLInputElement | null;
      const ta = adminRoot.querySelector("#car-images-text") as HTMLTextAreaElement | null;
      const file = input?.files?.[0];
      if (!file || !ta) {
        flash("Choose an image file.", "error");
        return;
      }
      void (async () => {
        const path = `catalog/cars/${slug}/${safeUploadPath(file.name)}`;
        const { error } = await supabase.storage
          .from(ADMIN_MEDIA_BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) {
          flash(`Upload failed: ${error.message}`, "error");
          return;
        }
        const pub = supabase.storage.from(ADMIN_MEDIA_BUCKET).getPublicUrl(path);
        const line = pub.data.publicUrl;
        const cur = ta.value.trim();
        ta.value = cur ? `${cur}\n${line}` : line;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        flash("Car image uploaded — URL appended.");
      })();
    });

    const flyerForm = adminRoot.querySelector("#flyer-form");
    if (flyerForm) {
      const syncFlyerFromForm = (): void => {
        const fd = new FormData(flyerForm as HTMLFormElement);
        flyers[selectedFlyer] = cloneFlyer({
          ...flyers[selectedFlyer],
          id: flyers[selectedFlyer]?.id ?? "",
          clubSlug: String(fd.get("clubSlug") || "").trim(),
          eventDate: String(fd.get("eventDate") || "").trim(),
          title: String(fd.get("title") || "").trim(),
          description: String(fd.get("description") || "").trim(),
          imageUrl: String(fd.get("imageUrl") || "").trim(),
          imagePath: String(fd.get("imagePath") || "").trim(),
          sortOrder: Number(fd.get("sortOrder") || 0) || 0,
          isActive: String(fd.get("isActive") || "true")
            .toLowerCase()
            .includes("true"),
        });
      };
      flyerForm.addEventListener("input", syncFlyerFromForm);
      flyerForm.addEventListener("change", syncFlyerFromForm);
      adminRoot.querySelector("#flyer-upload")?.addEventListener("click", () => {
        const input = adminRoot.querySelector("#flyer-image-file") as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (!file) {
          flash("Choose an image first.", "error");
          return;
        }
        void (async () => {
          const path = safeUploadPath(file.name);
          const { error } = await supabase.storage
            .from(ADMIN_MEDIA_BUCKET)
            .upload(path, file, { upsert: true, contentType: file.type });
          if (error) {
            flash(`Upload failed: ${error.message}`, "error");
            return;
          }
          const pub = supabase.storage.from(ADMIN_MEDIA_BUCKET).getPublicUrl(path);
          flyers[selectedFlyer] = cloneFlyer({
            ...flyers[selectedFlyer],
            imagePath: path,
            imageUrl: pub.data.publicUrl,
          });
          flash("Image uploaded.");
          renderDashboard();
        })();
      });
      adminRoot.querySelector("#flyer-save-db")?.addEventListener("click", () => {
        const current = flyers[selectedFlyer];
        if (!current) {
          flash("No flyer selected.", "error");
          return;
        }
        const ve = validateFlyerShape(current, clubEntries);
        if (ve.length) {
          flash(ve.join(" "), "error");
          return;
        }
        void (async () => {
          const row = {
            club_slug: current.clubSlug,
            event_date: current.eventDate,
            title: current.title,
            description: current.description,
            image_path: current.imagePath,
            image_url: current.imageUrl,
            is_active: current.isActive,
            sort_order: current.sortOrder,
            updated_at: new Date().toISOString(),
          };
          const q = current.id
            ? supabase.from("club_weekly_flyers").update(row).eq("id", current.id).select("id")
            : supabase.from("club_weekly_flyers").insert(row).select("id");
          const { data, error } = await q;
          if (error) {
            flash(`Save failed: ${error.message}`, "error");
            return;
          }
          if (!current.id && Array.isArray(data) && data[0]?.id) {
            flyers[selectedFlyer] = cloneFlyer({
              ...current,
              id: String(data[0].id),
            });
          }
          await reloadFlyers();
          flash("Flyer saved.");
          renderDashboard();
        })();
      });
    }

    adminRoot.querySelector("#enquiry-status-save")?.addEventListener("click", () => {
      const sel = adminRoot.querySelector("#enquiry-status-select") as HTMLSelectElement | null;
      const id = sel?.dataset.enquiryId;
      const status = sel?.value;
      if (!id || !status) return;
      void (async () => {
        const res = await updateEnquiryStatus(supabase, id, status);
        if (!res.ok) {
          flash(`Update failed: ${res.message}`, "error");
          return;
        }
        await reloadEnquiries();
        flash("Status updated.");
        renderDashboard();
      })();
    });

    adminRoot.querySelector("#enquiry-create-clients")?.addEventListener("click", () => {
      const btn = adminRoot.querySelector(
        "#enquiry-create-clients",
      ) as HTMLButtonElement | null;
      const id = btn?.dataset.enquiryId;
      if (!id) return;
      void (async () => {
        btn.disabled = true;
        const res = await createClientsFromEnquiry(supabase, id);
        btn.disabled = false;
        if (!res.ok) {
          flash(`Clients: ${res.message}`, "error");
          return;
        }
        await reloadClients();
        renderDashboard();
        flash(
          res.created === 0
            ? "No new clients (all rows already exist or nothing to import)."
            : `Created ${res.created} client(s).`,
        );
      })();
    });

    adminRoot.querySelector("#enquiry-status-select")?.addEventListener("change", (e) => {
      const t = e.target as HTMLSelectElement;
      const id = t.dataset.enquiryId;
      if (id) {
        const row = enquiries.find((x) => x.id === id);
        if (row) row.status = t.value;
      }
    });

    const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
    const mapsHint = adminRoot.querySelector("#club-address-maps-hint");
    if (mapsHint) {
      mapsHint.textContent = mapsKey
        ? "Type to search Google Places; choosing a result fills address, latitude, and longitude."
        : "Tip: set VITE_GOOGLE_MAPS_API_KEY (enable Maps JavaScript API + Places API; restrict the key by HTTP referrer) to enable address search.";
    }
    const mapsClubForm = adminRoot.querySelector("#club-form");
    if (mapsClubForm && mapsKey) {
      const address = mapsClubForm.querySelector<HTMLInputElement>('input[name="address"]');
      const lat = mapsClubForm.querySelector<HTMLInputElement>('input[name="lat"]');
      const lng = mapsClubForm.querySelector<HTMLInputElement>('input[name="lng"]');
      if (address && lat && lng) {
        void attachClubAddressAutocomplete({
          addressInput: address,
          latInput: lat,
          lngInput: lng,
          apiKey: mapsKey,
        }        ).catch(() =>
          flash(
            "Could not load Google Maps — check API key, billing, and Places API.",
            "error",
          ),
        );
      }
    }
  }

  async function loadAdminDashboard(): Promise<void> {
    const gate = await gateAdminUser(supabase);
    if (!gate.ok) {
      if (gate.reason === "not_signed_in") {
        renderLogin();
        return;
      }
      await signOutAdmin(supabase);
      loginError =
        gate.reason === "not_admin"
          ? "Not an admin account."
          : "Could not verify access.";
      renderLogin();
      return;
    }
    await reloadAllFromDb();
    renderDashboard();
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (!session) {
      renderLogin();
      return;
    }
    if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
    void loadAdminDashboard();
  });

  await loadAdminDashboard();
}
