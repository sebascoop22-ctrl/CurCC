import { fetchCars, fetchClubFlyers, fetchClubs } from "../data/fetch-data";
import { getSupabaseClient } from "../lib/supabase";
import { siteConfig } from "../site-config";
import type { Car, Club, ClubFlyer, GuestlistRecurrence } from "../types";
import "../styles/pages/admin.css";

const ADMIN_SESSION_KEY = "cc_admin_logged_in";
const CLUBS_DRAFT_KEY = "cc_admin_clubs_draft";
const CARS_DRAFT_KEY = "cc_admin_cars_draft";

type Tab = "clubs" | "cars" | "flyers";

const FLYERS_BUCKET = "club-flyers";

function lsGet<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsSet<T>(k: string, value: T): void {
  localStorage.setItem(k, JSON.stringify(value));
}

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
    venueType: c?.venueType ?? "club",
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

export async function initAdminPortal(): Promise<void> {
  const root = document.getElementById("admin-root");
  if (!root) return;
  const adminRoot = root;
  const supabase = getSupabaseClient();

  const [baseClubs, baseCars, baseFlyers] = await Promise.all([
    fetchClubs().catch(() => [] as Club[]),
    fetchCars().catch(() => [] as Car[]),
    fetchClubFlyers().catch(() => [] as ClubFlyer[]),
  ]);

  let clubs = lsGet<Club[]>(CLUBS_DRAFT_KEY) ?? baseClubs.map((c) => cloneClub(c));
  let cars = lsGet<Car[]>(CARS_DRAFT_KEY) ?? baseCars.map((c) => cloneCar(c));
  let flyers = baseFlyers.map((f) => cloneFlyer(f));
  let tab: Tab = "clubs";
  let selectedClub = 0;
  let selectedCar = 0;
  let selectedFlyer = 0;

  function flash(msg: string): void {
    const el = adminRoot.querySelector("#admin-flash");
    if (el) {
      el.textContent = msg;
      setTimeout(() => {
        if (el.textContent === msg) el.textContent = "";
      }, 2400);
    }
  }

  function persist(): void {
    lsSet(CLUBS_DRAFT_KEY, clubs);
    lsSet(CARS_DRAFT_KEY, cars);
  }

  async function reloadFlyers(): Promise<void> {
    flyers = (await fetchClubFlyers().catch(() => [] as ClubFlyer[])).map((f) =>
      cloneFlyer(f),
    );
    selectedFlyer = Math.min(selectedFlyer, Math.max(0, flyers.length - 1));
  }

  function safeUploadPath(fileName: string): string {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${new Date().toISOString().slice(0, 10)}/${Date.now()}_${safe}`;
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

  function render(): void {
    const loggedIn = sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
    if (!loggedIn) {
      adminRoot.innerHTML = `
        <div class="admin-card">
          <h3>Login required</h3>
          <p class="admin-note">Enter your admin passcode to continue.</p>
          <div class="cc-field" style="max-width: 360px;">
            <label for="admin-passcode">Passcode</label>
            <input id="admin-passcode" type="password" placeholder="Passcode" />
          </div>
          <button class="cc-btn cc-btn--gold" id="admin-login">Unlock</button>
          <div class="admin-flash" id="admin-flash"></div>
        </div>
      `;
      adminRoot.querySelector("#admin-login")?.addEventListener("click", () => {
        const pass = (adminRoot.querySelector("#admin-passcode") as HTMLInputElement)?.value ?? "";
        if (pass === siteConfig.adminPasscode) {
          sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
          render();
        } else flash("Incorrect passcode.");
      });
      return;
    }

    const club = clubs[selectedClub] ?? cloneClub();
    const car = cars[selectedCar] ?? cloneCar();
    const flyer = flyers[selectedFlyer] ?? cloneFlyer();
    adminRoot.innerHTML = `
      <div class="admin-card">
        <div class="admin-toolbar">
          <div class="admin-tabs">
            <button id="tab-clubs" class="${tab === "clubs" ? "is-active" : ""}" type="button">Clubs</button>
            <button id="tab-cars" class="${tab === "cars" ? "is-active" : ""}" type="button">Cars</button>
            <button id="tab-flyers" class="${tab === "flyers" ? "is-active" : ""}" type="button">Flyers</button>
          </div>
          <button class="cc-btn cc-btn--ghost" id="admin-logout" type="button">Logout</button>
          <button class="cc-btn cc-btn--ghost" id="admin-reset" type="button">Reset drafts</button>
          <button class="cc-btn cc-btn--ghost" id="admin-export-json" type="button">Export JSON</button>
          <button class="cc-btn cc-btn--ghost" id="admin-export-clubs-csv" type="button">Export clubs.csv</button>
          <button class="cc-btn cc-btn--gold" id="admin-save" type="button">Save draft</button>
        </div>
        <div class="admin-grid">
          <aside>
            <p class="admin-hint">Select an item to edit.</p>
            <div class="admin-list" id="admin-list"></div>
            <div class="admin-actions">
              <button class="cc-btn cc-btn--ghost" type="button" id="admin-add">Add new</button>
              <button class="cc-btn cc-btn--ghost" type="button" id="admin-delete">Delete selected</button>
            </div>
          </aside>
          <section id="admin-form-wrap">
            ${
              tab === "clubs"
                ? `
            <form class="admin-form" id="club-form">
              <div class="cc-field"><label>Slug</label><input name="slug" value="${escapeAttr(club.slug)}" /></div>
              <div class="cc-field"><label>Name</label><input name="name" value="${escapeAttr(club.name)}" /></div>
              <div class="cc-field full"><label>Short description</label><textarea name="shortDescription">${escapeAttr(club.shortDescription)}</textarea></div>
              <div class="cc-field full"><label>Long description</label><textarea name="longDescription">${escapeAttr(club.longDescription)}</textarea></div>
              <div class="cc-field"><label>Location tag</label><input name="locationTag" value="${escapeAttr(club.locationTag)}" /></div>
              <div class="cc-field"><label>Address</label><input name="address" value="${escapeAttr(club.address)}" /></div>
              <div class="cc-field"><label>Days open (Thu-Sat)</label><input name="daysOpen" value="${escapeAttr(club.daysOpen)}" /></div>
              <div class="cc-field"><label>Best visit days (pipe)</label><input name="bestVisitDays" value="${escapeAttr(club.bestVisitDays.join("|"))}" /></div>
              <div class="cc-field"><label>Featured day</label><input name="featuredDay" value="${escapeAttr(club.featuredDay)}" /></div>
              <div class="cc-field"><label>Venue type</label><input name="venueType" value="${escapeAttr(club.venueType)}" /></div>
              <div class="cc-field"><label>Lat</label><input name="lat" value="${club.lat}" /></div>
              <div class="cc-field"><label>Lng</label><input name="lng" value="${club.lng}" /></div>
              <div class="cc-field"><label>Min spend</label><input name="minSpend" value="${escapeAttr(club.minSpend)}" /></div>
              <div class="cc-field"><label>Website</label><input name="website" value="${escapeAttr(club.website)}" /></div>
              <div class="cc-field"><label>Entry (women)</label><input name="entryPricingWomen" value="${escapeAttr(club.entryPricingWomen)}" /></div>
              <div class="cc-field"><label>Entry (men)</label><input name="entryPricingMen" value="${escapeAttr(club.entryPricingMen)}" /></div>
              <div class="cc-field"><label>Tables standard</label><input name="tablesStandard" value="${escapeAttr(club.tablesStandard)}" /></div>
              <div class="cc-field"><label>Tables luxury</label><input name="tablesLuxury" value="${escapeAttr(club.tablesLuxury)}" /></div>
              <div class="cc-field"><label>Tables VIP</label><input name="tablesVip" value="${escapeAttr(club.tablesVip)}" /></div>
              <div class="cc-field"><label>Featured</label><input name="featured" value="${club.featured ? "true" : "false"}" /></div>
              <div class="cc-field full"><label>Reviews (one per line)</label><textarea name="reviews">${escapeAttr(club.reviews.join("\n"))}</textarea></div>
              <div class="cc-field full"><label>Known for (one per line)</label><textarea name="knownFor">${escapeAttr(club.knownFor.join("\n"))}</textarea></div>
              <div class="cc-field full"><label>Amenities (one per line)</label><textarea name="amenities">${escapeAttr(club.amenities.join("\n"))}</textarea></div>
              <div class="cc-field full"><label>Images (one URL/path per line)</label><textarea name="images">${escapeAttr(club.images.join("\n"))}</textarea></div>
              <div class="cc-field full"><label>Guestlists (days,recurrence,notes per line)</label><textarea name="guestlists">${escapeAttr(guestlistsText(club.guestlists))}</textarea></div>
            </form>`
                : tab === "flyers"
                  ? `
            <form class="admin-form" id="flyer-form">
              <div class="cc-field"><label>Club slug</label><input name="clubSlug" value="${escapeAttr(flyer.clubSlug)}" /></div>
              <div class="cc-field"><label>Event date (YYYY-MM-DD)</label><input name="eventDate" value="${escapeAttr(flyer.eventDate)}" /></div>
              <div class="cc-field full"><label>Title</label><input name="title" value="${escapeAttr(flyer.title)}" /></div>
              <div class="cc-field full"><label>Description</label><textarea name="description">${escapeAttr(flyer.description)}</textarea></div>
              <div class="cc-field"><label>Sort order</label><input name="sortOrder" value="${flyer.sortOrder}" /></div>
              <div class="cc-field"><label>Active (true/false)</label><input name="isActive" value="${flyer.isActive ? "true" : "false"}" /></div>
              <div class="cc-field full"><label>Image URL</label><input name="imageUrl" value="${escapeAttr(flyer.imageUrl)}" /></div>
              <div class="cc-field full"><label>Image path (storage)</label><input name="imagePath" value="${escapeAttr(flyer.imagePath)}" /></div>
              <div class="cc-field full">
                <label for="flyer-image-file">Upload image to Supabase Storage</label>
                <input id="flyer-image-file" type="file" accept="image/*" />
              </div>
              <div class="admin-actions full">
                <button class="cc-btn cc-btn--ghost" type="button" id="flyer-upload">Upload selected image</button>
                <button class="cc-btn cc-btn--gold" type="button" id="flyer-save-db">${flyer.id ? "Update flyer" : "Create flyer"}</button>
              </div>
            </form>`
                : `
            <form class="admin-form" id="car-form">
              <div class="cc-field"><label>Slug</label><input name="slug" value="${escapeAttr(car.slug)}" /></div>
              <div class="cc-field"><label>Name</label><input name="name" value="${escapeAttr(car.name)}" /></div>
              <div class="cc-field"><label>Role label</label><input name="roleLabel" value="${escapeAttr(car.roleLabel)}" /></div>
              <div class="cc-field"><label>Grid size (large/medium/feature)</label><input name="gridSize" value="${escapeAttr(car.gridSize)}" /></div>
              <div class="cc-field"><label>Order</label><input name="order" value="${car.order}" /></div>
              <div class="cc-field full"><label>Specs (one per line)</label><textarea name="specsHover">${escapeAttr(car.specsHover.join("\n"))}</textarea></div>
              <div class="cc-field full"><label>Images (one URL/path per line)</label><textarea name="images">${escapeAttr(car.images.join("\n"))}</textarea></div>
            </form>`
            }
          </section>
        </div>
        <div class="admin-hint">
          Note: clubs/cars remain local draft editors. Flyers are saved to Supabase and images upload to Storage.
        </div>
        <div class="admin-flash" id="admin-flash"></div>
      </div>
    `;

    adminRoot.querySelector("#tab-clubs")?.addEventListener("click", () => {
      tab = "clubs";
      render();
    });
    adminRoot.querySelector("#tab-cars")?.addEventListener("click", () => {
      tab = "cars";
      render();
    });
    adminRoot.querySelector("#tab-flyers")?.addEventListener("click", () => {
      tab = "flyers";
      render();
    });
    adminRoot.querySelector("#admin-logout")?.addEventListener("click", () => {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      render();
    });
    adminRoot.querySelector("#admin-save")?.addEventListener("click", () => {
      persist();
      flash("Draft saved locally.");
    });
    adminRoot.querySelector("#admin-reset")?.addEventListener("click", () => {
      localStorage.removeItem(CLUBS_DRAFT_KEY);
      localStorage.removeItem(CARS_DRAFT_KEY);
      clubs = baseClubs.map((c) => cloneClub(c));
      cars = baseCars.map((c) => cloneCar(c));
      flyers = baseFlyers.map((f) => cloneFlyer(f));
      selectedClub = 0;
      selectedCar = 0;
      selectedFlyer = 0;
      render();
      flash("Reset to current site data.");
    });
    adminRoot.querySelector("#admin-export-json")?.addEventListener("click", () => {
      downloadTextFile("clubs.json", JSON.stringify(clubs, null, 2));
      downloadTextFile("cars.json", JSON.stringify(cars, null, 2));
      flash("Exported clubs.json and cars.json.");
    });
    adminRoot.querySelector("#admin-export-clubs-csv")?.addEventListener("click", () => {
      downloadTextFile("clubs.csv", asClubsCsv(clubs));
      flash("Exported clubs.csv.");
    });

    const listEl = adminRoot.querySelector("#admin-list");
    if (listEl) {
      const items = tab === "clubs" ? clubs : tab === "cars" ? cars : flyers;
      const activeIndex =
        tab === "clubs" ? selectedClub : tab === "cars" ? selectedCar : selectedFlyer;
      listEl.innerHTML = items
        .map(
          (x, i) =>
            `<button type="button" data-i="${i}" class="${i === activeIndex ? "is-active" : ""}">${escapeAttr(
              tab === "flyers"
                ? `${(x as ClubFlyer).clubSlug || "new-flyer"} · ${(x as ClubFlyer).eventDate || "no-date"}`
                : `${(x as Club | Car).slug || "new-item"} · ${(x as Club | Car).name || "Untitled"}`,
            )}</button>`,
        )
        .join("");
      listEl.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = Number((btn as HTMLButtonElement).dataset.i ?? "0");
          if (tab === "clubs") selectedClub = i;
          else if (tab === "cars") selectedCar = i;
          else selectedFlyer = i;
          render();
        });
      });
    }

    adminRoot.querySelector("#admin-add")?.addEventListener("click", () => {
      if (tab === "clubs") {
        clubs.push(cloneClub({ slug: "new-club", name: "New Club" }));
        selectedClub = clubs.length - 1;
      } else if (tab === "cars") {
        cars.push(cloneCar({ slug: "new-car", name: "New Car" }));
        selectedCar = cars.length - 1;
      } else {
        flyers.push(
          cloneFlyer({
            clubSlug: clubs[0]?.slug ?? "",
            eventDate: new Date().toISOString().slice(0, 10),
            title: "Weekly flyer",
            isActive: true,
          }),
        );
        selectedFlyer = flyers.length - 1;
      }
      render();
    });

    adminRoot.querySelector("#admin-delete")?.addEventListener("click", () => {
      if (tab === "clubs" && clubs.length) {
        clubs.splice(selectedClub, 1);
        selectedClub = Math.max(0, selectedClub - 1);
      }
      if (tab === "cars" && cars.length) {
        cars.splice(selectedCar, 1);
        selectedCar = Math.max(0, selectedCar - 1);
      }
      if (tab === "flyers" && flyers.length) {
        const victim = flyers[selectedFlyer];
        if (victim?.id && supabase) {
          void (async () => {
            const { error } = await supabase
              .from("club_weekly_flyers")
              .delete()
              .eq("id", victim.id);
            if (error) {
              flash(`Delete failed: ${error.message}`);
              return;
            }
            await reloadFlyers();
            flash("Flyer deleted.");
            render();
          })();
          return;
        }
        flyers.splice(selectedFlyer, 1);
        selectedFlyer = Math.max(0, selectedFlyer - 1);
      }
      render();
    });

    const clubForm = adminRoot.querySelector("#club-form");
    if (clubForm) {
      clubForm.addEventListener("input", () => {
        const fd = new FormData(clubForm as HTMLFormElement);
        clubs[selectedClub] = cloneClub({
          ...clubs[selectedClub],
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
          venueType:
            String(fd.get("venueType") || "club").trim() === "dining"
              ? "dining"
              : "club",
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
        });
      });
    }

    const carForm = adminRoot.querySelector("#car-form");
    if (carForm) {
      carForm.addEventListener("input", () => {
        const fd = new FormData(carForm as HTMLFormElement);
        const rawGrid = String(fd.get("gridSize") || "medium").trim();
        cars[selectedCar] = cloneCar({
          ...cars[selectedCar],
          slug: String(fd.get("slug") || "").trim(),
          name: String(fd.get("name") || "").trim(),
          roleLabel: String(fd.get("roleLabel") || "").trim(),
          order: Number(fd.get("order") || 0) || 0,
          gridSize:
            rawGrid === "large" || rawGrid === "feature" ? rawGrid : "medium",
          specsHover: parseLines(String(fd.get("specsHover") || "")),
          images: parseLines(String(fd.get("images") || "")),
        });
      });
    }

    const flyerForm = adminRoot.querySelector("#flyer-form");
    if (flyerForm) {
      flyerForm.addEventListener("input", () => {
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
      });
      adminRoot.querySelector("#flyer-upload")?.addEventListener("click", () => {
        if (!supabase) {
          flash("Supabase env missing.");
          return;
        }
        const input = adminRoot.querySelector("#flyer-image-file") as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (!file) {
          flash("Choose an image first.");
          return;
        }
        void (async () => {
          const path = safeUploadPath(file.name);
          const { error } = await supabase.storage
            .from(FLYERS_BUCKET)
            .upload(path, file, { upsert: true, contentType: file.type });
          if (error) {
            flash(`Upload failed: ${error.message}`);
            return;
          }
          const pub = supabase.storage.from(FLYERS_BUCKET).getPublicUrl(path);
          flyers[selectedFlyer] = cloneFlyer({
            ...flyers[selectedFlyer],
            imagePath: path,
            imageUrl: pub.data.publicUrl,
          });
          render();
          flash("Image uploaded.");
        })();
      });
      adminRoot.querySelector("#flyer-save-db")?.addEventListener("click", () => {
        if (!supabase) {
          flash("Supabase env missing.");
          return;
        }
        const current = flyers[selectedFlyer];
        if (!current) {
          flash("No flyer selected.");
          return;
        }
        if (!current.clubSlug || !current.eventDate) {
          flash("Club slug and event date are required.");
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
          };
          const q = current.id
            ? supabase.from("club_weekly_flyers").update(row).eq("id", current.id).select("id")
            : supabase.from("club_weekly_flyers").insert(row).select("id");
          const { data, error } = await q;
          if (error) {
            flash(`Save failed: ${error.message}`);
            return;
          }
          if (!current.id && Array.isArray(data) && data[0]?.id) {
            flyers[selectedFlyer] = cloneFlyer({
              ...current,
              id: String(data[0].id),
            });
          }
          await reloadFlyers();
          render();
          flash("Flyer saved.");
        })();
      });
    }
  }

  render();
}

function escapeAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
