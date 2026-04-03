import type { Club } from "../types";
import { fetchClubs } from "../data/fetch-data";
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

function selectClubForDate(clubs: Club[], d: Date): Club | null {
  const match = clubs.find((c) => clubMatchesFeaturedDate(c, d));
  if (match) return match;
  const anyFeatured = clubs.find((c) => c.featured);
  if (anyFeatured) return anyFeatured;
  return clubs[0] ?? null;
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
  const clubs = await fetchClubs();
  const thumbEl = document.getElementById("featured-thumb") as HTMLImageElement | null;
  const dateLabelEl = document.getElementById("featured-date-label");
  const prevDateBtn = document.getElementById("featured-date-prev");
  const nextDateBtn = document.getElementById("featured-date-next");
  const detailsLnk = document.getElementById("featured-details") as HTMLAnchorElement | null;
  const promoTitle = document.getElementById("featured-title");
  const promoBlurb = document.getElementById("featured-blurb");
  const testimonialsEl = document.getElementById("testimonials-grid");

  if (!thumbEl || !dateLabelEl || !promoTitle || !promoBlurb) return;

  const today = startOfToday();
  let featuredDate = new Date(today);

  function applyClub(club: Club | null): void {
    if (!club) {
      promoTitle.textContent = "Featured venue";
      promoBlurb.textContent =
        "Featured destinations appear when configured in each club’s CSV.";
      thumbEl.removeAttribute("src");
      if (detailsLnk) detailsLnk.href = "nightlife.html";
      return;
    }
    promoTitle.textContent = club.name;
    promoBlurb.textContent = club.shortDescription;
    const img =
      club.images[0] || "/media/home/bento-nightlife-bg.svg";
    thumbEl.src = img;
    thumbEl.alt = club.name;
    if (detailsLnk) {
      detailsLnk.href = `nightlife.html?venue=${encodeURIComponent(club.slug)}`;
    }
  }

  function refreshFeatured(): void {
    dateLabelEl.textContent = formatBannerDate(featuredDate);
    const club = selectClubForDate(clubs, featuredDate);
    applyClub(club);
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
