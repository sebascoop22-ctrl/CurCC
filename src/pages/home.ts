import type { Club } from "../types";
import { fetchClubs } from "../data/fetch-data";
import {
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

function formatBannerDate(d: Date): string {
  return `${DOW_SHORT[d.getDay()]}, ${MO_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function startOfToday(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function selectClubForDate(clubs: Club[], ymd: string): Club | null {
  const exact = clubs.find((c) => c.featured && c.featuredDay === ymd);
  if (exact) return exact;
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
    const ymd = toYMD(featuredDate);
    const club = selectClubForDate(clubs, ymd);
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
    submitInquiry(payload, "home_lead");
    showFormSuccess(successEl);
    form.reset();
    syncContactMode();
  });
}
