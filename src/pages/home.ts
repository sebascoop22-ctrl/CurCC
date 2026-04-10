import type { Club, ClubFlyer } from "../types";
import { fetchClubFlyers, fetchClubs } from "../data/fetch-data";
import {
  hideFormError,
  showFormError,
  showFormSuccess,
  submitInquiry,
  validateEmail,
} from "../forms";
import "../styles/pages/home.css";

const MO_SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const DOW_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const FEATURED_DAY_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const FEATURED_DAY_DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** Map normalized day token → JS getDay() (0 = Sunday … 6 = Saturday). */
const WEEKDAY_TOKEN_TO_DOW: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

function featuredDayToYMD(raw: string): string | null {
  const t = raw.trim();
  const iso = t.match(FEATURED_DAY_ISO);
  if (iso) return t;
  const dmy = t.match(FEATURED_DAY_DMY);
  if (dmy) {
    const dd = String(dmy[1]).padStart(2, "0");
    const mm = String(dmy[2]).padStart(2, "0");
    const yyyy = dmy[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

const FEATURED_DAY_STOPWORDS = new Set([
  "and",
  "&",
  "to",
  "thru",
  "through",
  "on",
]);

function parseFeaturedWeekdays(raw: string): number[] | null {
  const t = raw.trim();
  if (!t) return null;
  if (FEATURED_DAY_ISO.test(t) || FEATURED_DAY_DMY.test(t)) return null;
  const parts = t
    .split(/[\s,|;/]+/)
    .map((p) => p.replace(/\.$/, "").trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) return null;
  const days: number[] = [];
  for (const p of parts) {
    if (FEATURED_DAY_STOPWORDS.has(p)) continue;
    const dow = WEEKDAY_TOKEN_TO_DOW[p];
    if (dow === undefined) continue;
    if (!days.includes(dow)) days.push(dow);
  }
  return days.length ? days : null;
}

function clubMatchesFeaturedDate(club: Club, d: Date): boolean {
  if (!club.featured) return false;
  const raw = club.featuredDay.trim();
  if (!raw) return false;
  const ymd = toYMD(d);
  const asYmd = featuredDayToYMD(raw);
  if (asYmd !== null) return asYmd === ymd;
  const weekdays = parseFeaturedWeekdays(raw);
  return weekdays !== null && weekdays.includes(d.getDay());
}

function formatBannerDate(d: Date): string {
  return `${DOW_SHORT[d.getDay()]}, ${MO_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function startOfToday(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function selectClubsForDate(clubs: Club[], d: Date): Club[] {
  const matches = clubs.filter((c) => clubMatchesFeaturedDate(c, d));
  if (matches.length) return matches;
  const anyFeatured = clubs.filter((c) => c.featured);
  if (anyFeatured.length) return anyFeatured;
  return clubs.slice(0, 1);
}

function selectFlyersForDate(flyers: ClubFlyer[], d: Date): ClubFlyer[] {
  const ymd = toYMD(d);
  const exact = flyers.filter((f) => f.eventDate === ymd);
  if (exact.length) return exact;
  const upcoming = flyers
    .filter((f) => f.eventDate >= ymd)
    .sort((a, b) => (a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : 0));
  if (upcoming.length) return upcoming.slice(0, 5);
  return flyers.slice(0, 5);
}

function parseTestimonial(raw: string): { name: string; text: string } {
  const idx = raw.indexOf(":");
  if (idx > 0) {
    return {
      name: raw.slice(0, idx).trim(),
      text: raw.slice(idx + 1).trim(),
    };
  }
  return { name: "Client", text: raw };
}

export async function initHome(): Promise<void> {
  const [clubs, flyers] = await Promise.all([
    fetchClubs().catch(() => [] as Club[]),
    fetchClubFlyers().catch(() => [] as ClubFlyer[]),
  ]);
  const thumbEl = document.getElementById("featured-thumb") as HTMLImageElement | null;
  const dateLabelEl = document.getElementById("featured-date-label");
  const prevDateBtn = document.getElementById("featured-date-prev");
  const nextDateBtn = document.getElementById("featured-date-next");
  const prevItemBtn = document.getElementById("featured-item-prev");
  const nextItemBtn = document.getElementById("featured-item-next");
  const itemLabelEl = document.getElementById("featured-item-label");
  const modeLabelEl = document.getElementById("featured-mode-label");
  const modeClubsBtn = document.getElementById("featured-mode-clubs");
  const modeFlyersBtn = document.getElementById("featured-mode-flyers");
  const detailsLnk = document.getElementById("featured-details") as HTMLAnchorElement | null;
  const promoTitle = document.getElementById("featured-title");
  const promoBlurb = document.getElementById("featured-blurb");
  const testimonialsEl = document.getElementById("testimonials-grid");

  if (
    !thumbEl ||
    !dateLabelEl ||
    !promoTitle ||
    !promoBlurb ||
    !itemLabelEl ||
    !modeClubsBtn ||
    !modeFlyersBtn ||
    !modeLabelEl
  )
    return;
  const thumb = thumbEl;
  const dateLabel = dateLabelEl;
  const promoTitleEl = promoTitle;
  const promoBlurbEl = promoBlurb;
  const itemLabel = itemLabelEl;
  const modeLabel = modeLabelEl;
  const modeClubs = modeClubsBtn;
  const modeFlyers = modeFlyersBtn;

  const today = startOfToday();
  let featuredDate = new Date(today);
  let itemIndex = 0;
  let mode: "clubs" | "flyers" = "clubs";
  const hasAnyFlyers = flyers.length > 0;

  function applyClub(club: Club | null, total: number): void {
    if (!club) {
      promoTitleEl.textContent = "Featured venue";
      promoBlurbEl.textContent =
        "Featured destinations appear when configured in each club’s CSV.";
      thumb.removeAttribute("src");
      if (detailsLnk) detailsLnk.href = "nightlife.html";
      itemLabel.textContent = "0 / 0";
      return;
    }
    promoTitleEl.textContent = club.name;
    promoBlurbEl.textContent = club.shortDescription;
    const img =
      club.images[0] || "/media/home/bento-nightlife-bg.svg";
    thumb.src = img;
    thumb.alt = club.name;
    itemLabel.textContent = `${itemIndex + 1} / ${total}`;
    if (detailsLnk) {
      detailsLnk.href = `nightlife.html?venue=${encodeURIComponent(club.slug)}`;
    }
  }

  function applyFlyer(flyer: ClubFlyer | null, total: number): void {
    if (!flyer) {
      promoTitleEl.textContent = "Weekly flyers";
      promoBlurbEl.textContent =
        "Flyers will appear here once nightlife promotions are uploaded.";
      thumb.removeAttribute("src");
      if (detailsLnk) detailsLnk.href = "nightlife.html";
      itemLabel.textContent = "0 / 0";
      return;
    }
    const clubName =
      clubs.find((c) => c.slug === flyer.clubSlug)?.name ?? flyer.clubSlug;
    promoTitleEl.textContent = flyer.title || clubName;
    promoBlurbEl.textContent = flyer.description || `${clubName} · ${flyer.eventDate}`;
    if (flyer.imageUrl) {
      thumb.src = flyer.imageUrl;
      thumb.alt = flyer.title || `Flyer for ${clubName}`;
    } else {
      thumb.removeAttribute("src");
    }
    itemLabel.textContent = `${itemIndex + 1} / ${total}`;
    if (detailsLnk) {
      detailsLnk.href = `nightlife.html?venue=${encodeURIComponent(flyer.clubSlug)}`;
    }
  }

  function refreshFeatured(): void {
    dateLabel.textContent = formatBannerDate(featuredDate);
    modeClubs.classList.toggle("is-active", mode === "clubs");
    modeFlyers.classList.toggle("is-active", mode === "flyers");
    modeClubs.setAttribute("aria-selected", String(mode === "clubs"));
    modeFlyers.setAttribute("aria-selected", String(mode === "flyers"));
    if (mode === "clubs") {
      modeLabel.textContent = "Tonight’s featured venue";
      const items = selectClubsForDate(clubs, featuredDate);
      const total = items.length;
      itemIndex = total ? ((itemIndex % total) + total) % total : 0;
      applyClub(items[itemIndex] ?? null, total);
      prevItemBtn?.removeAttribute("disabled");
      nextItemBtn?.removeAttribute("disabled");
      return;
    }
    modeLabel.textContent = "Tonight’s club flyer";
    const items = selectFlyersForDate(flyers, featuredDate);
    const total = items.length;
    itemIndex = total ? ((itemIndex % total) + total) % total : 0;
    applyFlyer(items[itemIndex] ?? null, total);
    prevItemBtn?.removeAttribute("disabled");
    nextItemBtn?.removeAttribute("disabled");
  }

  function setFeaturedDate(d: Date): void {
    if (d < today) return;
    featuredDate = new Date(d);
    refreshFeatured();
  }

  prevDateBtn?.addEventListener("click", () => {
    const d = new Date(featuredDate);
    d.setDate(d.getDate() - 1);
    if (d >= today) setFeaturedDate(d);
  });

  nextDateBtn?.addEventListener("click", () => {
    const d = new Date(featuredDate);
    d.setDate(d.getDate() + 1);
    setFeaturedDate(d);
  });

  prevItemBtn?.addEventListener("click", () => {
    itemIndex -= 1;
    refreshFeatured();
  });
  nextItemBtn?.addEventListener("click", () => {
    itemIndex += 1;
    refreshFeatured();
  });
  modeClubs.addEventListener("click", () => {
    mode = "clubs";
    itemIndex = 0;
    refreshFeatured();
  });
  modeFlyers.addEventListener("click", () => {
    if (!hasAnyFlyers) return;
    mode = "flyers";
    itemIndex = 0;
    refreshFeatured();
  });
  if (!hasAnyFlyers) {
    modeFlyers.setAttribute("disabled", "true");
    modeFlyers.setAttribute("aria-disabled", "true");
  }

  refreshFeatured();

  if (testimonialsEl) {
    const rows: { name: string; text: string }[] = [];
    for (const c of clubs) {
      for (const r of c.reviews) {
        rows.push(parseTestimonial(r));
        if (rows.length >= 3) break;
      }
      if (rows.length >= 3) break;
    }
    while (rows.length < 3) {
      rows.push({
        name: "Member",
        text: "Cooper Concierge arranged a flawless evening with absolute discretion.",
      });
    }
    const max = 3;
    testimonialsEl.innerHTML = rows
      .slice(0, max)
      .map(
        () => `
      <article class="testimonial">
        <div class="testimonial__stars" aria-hidden="true">★★★★★</div>
        <div class="testimonial__name"></div>
        <p></p>
      </article>`,
      )
      .join("");
    const articles = testimonialsEl.querySelectorAll(".testimonial");
    rows.slice(0, max).forEach((t, i) => {
      const a = articles[i];
      if (!a) return;
      const nameEl = a.querySelector(".testimonial__name");
      const p = a.querySelector("p");
      if (nameEl) nameEl.textContent = t.name;
      if (p) p.textContent = t.text;
    });
  }

  const form = document.getElementById("home-lead-form") as HTMLFormElement | null;
  const successEl = document.getElementById("home-lead-success");
  const errorEl = document.getElementById("home-lead-error");
  const leadFields = document.getElementById("lead-fields");

  function syncContactMode(): void {
    const m = String(
      (form?.querySelector('input[name="contact_method"]:checked') as HTMLInputElement)
        ?.value,
    );
    if (leadFields) leadFields.dataset.contactMode = m === "phone" ? "phone" : "email";
    form?.querySelectorAll(".lead-invite__chip").forEach((chip) => {
      const inp = chip.querySelector('input[name="contact_method"]');
      chip.classList.toggle(
        "lead-invite__chip--on",
        inp instanceof HTMLInputElement && inp.checked,
      );
    });
  }

  form?.querySelectorAll('input[name="contact_method"]').forEach((radio) => {
    radio.addEventListener("change", syncContactMode);
  });
  syncContactMode();

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const method = String(fd.get("contact_method") || "email");
    const email = String(fd.get("email") || "").trim();
    const phone = String(fd.get("phone") || "").trim();

    let ok = true;
    form.querySelectorAll(".lead-invite__input").forEach((el) =>
      el.classList.remove("lead-invite__input--error"),
    );
    hideFormError(errorEl);
    successEl?.classList.remove("is-visible");
    if (!name) ok = false;
    if (method === "email" && !validateEmail(email)) ok = false;
    if (method === "phone" && phone.length < 8) ok = false;

    if (!ok) {
      if (!name) document.getElementById("home-name")?.classList.add("lead-invite__input--error");
      if (method === "email")
        document.getElementById("home-email")?.classList.add("lead-invite__input--error");
      if (method === "phone")
        document.getElementById("home-phone")?.classList.add("lead-invite__input--error");
      return;
    }

    const payload = {
      name,
      contactMethod: method,
      email: method === "email" ? email : undefined,
      phone: method === "phone" ? phone : undefined,
    };
    const btn = form.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;
    btn && (btn.disabled = true);
    void (async () => {
      const result = await submitInquiry(payload, "home_lead");
      btn && (btn.disabled = false);
      if (!result.ok) {
        showFormError(errorEl, result.error ?? "Something went wrong.");
        return;
      }
      showFormSuccess(successEl);
      form.reset();
      syncContactMode();
    })();
  });
}
