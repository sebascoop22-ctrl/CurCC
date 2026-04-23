import type { Club, ClubFlyer } from "../types";
import { fetchClubFlyers, fetchClubs } from "../data/fetch-data";
import {
  hideFormError,
  showFormError,
  showFormSuccess,
  submitInquiry,
  validateInstagramHandle,
  validatePhone,
} from "../forms";
import { openVenueRequestModal } from "../components/venue-request-modal";
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

function selectSingleFeaturedClub(clubs: Club[], d: Date): Club | null {
  const dated = selectClubsForDate(clubs, d);
  if (dated.length) return dated[0] ?? null;
  return clubs[0] ?? null;
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

function selectSingleFlyerForDate(flyers: ClubFlyer[], d: Date): ClubFlyer | null {
  const dated = selectFlyersForDate(flyers, d);
  if (dated.length) return dated[0] ?? null;
  return flyers[0] ?? null;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  const requestHost = document.getElementById("cc-venue-request-root") as HTMLElement | null;
  const promoTitle = document.getElementById("featured-title");
  const promoBlurb = document.getElementById("featured-blurb");

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
  const dateNav = prevDateBtn?.parentElement ?? null;
  const itemNav = prevItemBtn?.parentElement ?? null;

  const today = startOfToday();
  let featuredDate = new Date(today);
  let itemIndex = 0;
  let mode: "clubs" | "flyers" = "clubs";
  const hasAnyFlyers = flyers.length > 0;
  let activeClub: Club | null = null;
  let activeFlyer: ClubFlyer | null = null;

  function closeFlyerModal(): void {
    document.querySelectorAll(".flyer-modal-overlay").forEach((el) => el.remove());
    document.querySelectorAll(".club-modal-overlay").forEach((el) => el.remove());
    document.body.classList.remove("no-scroll");
  }

  function openFlyerModal(flyer: ClubFlyer, club: Club | null): void {
    closeFlyerModal();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay flyer-modal-overlay is-open";
    const modal = document.createElement("div");
    modal.className = "modal modal--flyer";
    modal.addEventListener("click", (e) => e.stopPropagation());

    const eventLabel = flyer.title?.trim() || "Weekly flyer event";
    const eventDesc = flyer.description?.trim() || "Event details on request.";
    const venueLabel = club
      ? `${club.name}${club.locationTag?.trim() ? ` · ${club.locationTag.trim()}` : ""}`
      : flyer.clubSlug;
    const pricingBits = [
      club?.entryPricingWomen?.trim() ? `Women: ${club.entryPricingWomen.trim()}` : "",
      club?.entryPricingMen?.trim() ? `Men: ${club.entryPricingMen.trim()}` : "",
      club?.minSpend?.trim() ? `Min spend: ${club.minSpend.trim()}` : "",
    ].filter(Boolean);
    const pricing = pricingBits.length
      ? pricingBits.join(" · ")
      : "Pricing varies by date and table tier.";
    const hasPerformer =
      /\b(perform|dj|lineup|artist|live)\b/i.test(eventDesc) ||
      /\b(perform|dj|lineup|artist|live)\b/i.test(eventLabel);
    const performers = hasPerformer
      ? eventDesc
      : "Performers/lineup announced by the venue for this date.";
    const imageUrl = flyer.imageUrl?.trim() || flyer.imagePath?.trim() || "";
    const clubHref = `/club/${encodeURIComponent(flyer.clubSlug)}`;

    modal.innerHTML = `
      <button type="button" class="modal__close" data-flyer-close aria-label="Close">×</button>
      <div class="flyer-modal__layout">
        <div class="flyer-modal__media">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(eventLabel)}" loading="lazy" />` : `<div class="flyer-modal__placeholder">No flyer image</div>`}</div>
        <div class="flyer-modal__info">
          <h3>${escapeHtml(eventLabel)}</h3>
          <p class="flyer-modal__meta"><strong>When:</strong> ${escapeHtml(flyer.eventDate || "Date TBC")}</p>
          <p class="flyer-modal__meta"><strong>Where:</strong> ${escapeHtml(venueLabel)}</p>
          <p class="flyer-modal__meta"><strong>Pricing:</strong> ${escapeHtml(pricing)}</p>
          <p class="flyer-modal__meta"><strong>Performing / Event:</strong> ${escapeHtml(performers)}</p>
          <p class="flyer-modal__desc">${escapeHtml(eventDesc)}</p>
          <div class="flyer-modal__actions">
            <button type="button" class="cc-btn cc-btn--gold" data-flyer-attend>Attend event</button>
            <a class="cc-btn cc-btn--ghost" href="${escapeHtml(clubHref)}">Go to club page</a>
          </div>
        </div>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.classList.add("no-scroll");

    const close = () => closeFlyerModal();
    overlay.addEventListener("click", close);
    modal.querySelector("[data-flyer-close]")?.addEventListener("click", close);
    modal.querySelector("[data-flyer-attend]")?.addEventListener("click", () => {
      if (club && requestHost) {
        closeFlyerModal();
        const clubDates = flyers
          .filter((f) => f.clubSlug === club.slug)
          .map((f) => f.eventDate?.trim())
          .filter(Boolean) as string[];
        openVenueRequestModal({
          host: requestHost,
          kind: "guestlist",
          club,
          clubOptions: clubs.map((c) => ({
            slug: c.slug,
            name: c.name,
            locationTag: c.locationTag,
          })),
          dateOptions: Array.from(new Set(clubDates)),
          preferredDate: flyer.eventDate,
        });
      }
    });
  }

  function openClubModal(club: Club): void {
    closeFlyerModal();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay club-modal-overlay is-open";
    const modal = document.createElement("div");
    modal.className = "modal modal--club-preview";
    modal.addEventListener("click", (e) => e.stopPropagation());
    const imageUrl = club.images[0] || "/media/home/bento-nightlife-bg.svg";
    const clubHref = `/club/${encodeURIComponent(club.slug)}`;
    const bestVisit = club.bestVisitDays?.length
      ? club.bestVisitDays.join(" · ")
      : "Best visit details available on request.";
    const pricingBits = [
      club.entryPricingWomen?.trim() ? `Women: ${club.entryPricingWomen.trim()}` : "",
      club.entryPricingMen?.trim() ? `Men: ${club.entryPricingMen.trim()}` : "",
      club.minSpend?.trim() ? `Min spend: ${club.minSpend.trim()}` : "",
    ].filter(Boolean);
    const pricing = pricingBits.length ? pricingBits.join(" · ") : "Pricing varies by date.";

    modal.innerHTML = `
      <button type="button" class="modal__close" data-club-close aria-label="Close">×</button>
      <div class="club-modal__layout">
        <div class="club-modal__media">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(club.name)}" loading="lazy" />
        </div>
        <div class="club-modal__info">
          <h3>${escapeHtml(club.name)}</h3>
          <p class="club-modal__meta"><strong>Location:</strong> ${escapeHtml(club.locationTag || "London")}</p>
          <p class="club-modal__meta"><strong>Best nights:</strong> ${escapeHtml(bestVisit)}</p>
          <p class="club-modal__meta"><strong>Entry:</strong> ${escapeHtml(pricing)}</p>
          <p class="club-modal__desc">${escapeHtml(club.shortDescription || "Elite nightlife destination.")}</p>
          <div class="club-modal__actions">
            <button type="button" class="cc-btn cc-btn--gold" data-club-guestlist>Join guestlist</button>
            <a class="cc-btn cc-btn--ghost" href="${escapeHtml(clubHref)}">Go to club page</a>
          </div>
        </div>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.classList.add("no-scroll");
    const close = () => closeFlyerModal();
    overlay.addEventListener("click", close);
    modal.querySelector("[data-club-close]")?.addEventListener("click", close);
    modal.querySelector("[data-club-guestlist]")?.addEventListener("click", () => {
      if (!requestHost) return;
      close();
      openVenueRequestModal({
        host: requestHost,
        kind: "guestlist",
        club,
        clubOptions: clubs.map((c) => ({
          slug: c.slug,
          name: c.name,
          locationTag: c.locationTag,
        })),
        dateOptions: flyers
          .filter((f) => f.clubSlug === club.slug)
          .map((f) => f.eventDate?.trim())
          .filter(Boolean) as string[],
      });
    });
  }

  function applyClub(club: Club | null, total: number): void {
    activeClub = club;
    activeFlyer = null;
    if (!club) {
      promoTitleEl.textContent = "Featured venue";
      promoBlurbEl.textContent =
        "Featured destinations appear when configured in each club’s CSV.";
      thumb.removeAttribute("src");
      if (detailsLnk) detailsLnk.href = "/";
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
    if (detailsLnk) detailsLnk.href = `/club/${encodeURIComponent(club.slug)}`;
  }

  function applyFlyer(flyer: ClubFlyer | null, total: number): void {
    activeFlyer = flyer;
    if (!flyer) {
      promoTitleEl.textContent = "Weekly flyers";
      promoBlurbEl.textContent =
        "Flyers will appear here once nightlife promotions are uploaded.";
      thumb.removeAttribute("src");
      if (detailsLnk) detailsLnk.href = "/";
      itemLabel.textContent = "0 / 0";
      return;
    }
    const club = clubs.find((c) => c.slug === flyer.clubSlug) ?? null;
    activeClub = club;
    const clubName = club?.name ?? flyer.clubSlug;
    promoTitleEl.textContent = flyer.title || clubName;
    promoBlurbEl.textContent = flyer.description || `${clubName} · ${flyer.eventDate}`;
    if (flyer.imageUrl) {
      thumb.src = flyer.imageUrl;
      thumb.alt = flyer.title || `Flyer for ${clubName}`;
    } else {
      thumb.removeAttribute("src");
    }
    itemLabel.textContent = `${itemIndex + 1} / ${total}`;
    if (detailsLnk) detailsLnk.href = `/club/${encodeURIComponent(flyer.clubSlug)}`;
  }

  function refreshFeatured(): void {
    dateLabel.textContent = formatBannerDate(featuredDate);
    modeClubs.classList.toggle("is-active", mode === "clubs");
    modeFlyers.classList.toggle("is-active", mode === "flyers");
    modeClubs.setAttribute("aria-selected", String(mode === "clubs"));
    modeFlyers.setAttribute("aria-selected", String(mode === "flyers"));
    if (mode === "clubs") {
      modeLabel.textContent = "Featured venue";
      if (detailsLnk) detailsLnk.textContent = "Open club";
      dateNav?.removeAttribute("hidden");
      if (itemNav) itemNav.style.display = "none";
      itemIndex = 0;
      applyClub(selectSingleFeaturedClub(clubs, featuredDate), 1);
      prevItemBtn?.setAttribute("disabled", "true");
      nextItemBtn?.setAttribute("disabled", "true");
      return;
    }
    modeLabel.textContent = "Tonight’s club flyer";
    if (detailsLnk) detailsLnk.textContent = "Open flyer";
    dateNav?.removeAttribute("hidden");
    if (itemNav) itemNav.style.display = "none";
    itemIndex = 0;
    applyFlyer(selectSingleFlyerForDate(flyers, featuredDate), 1);
    prevItemBtn?.setAttribute("disabled", "true");
    nextItemBtn?.setAttribute("disabled", "true");
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

  function openCurrentFeatured(): void {
    if (mode === "flyers" && activeFlyer) {
      openFlyerModal(activeFlyer, activeClub);
      return;
    }
    if (activeClub) {
      openClubModal(activeClub);
    }
  }

  detailsLnk?.addEventListener("click", (e) => {
    e.preventDefault();
    openCurrentFeatured();
  });
  [thumb, promoTitleEl].forEach((el) => {
    el.classList.add("featured-banner__clickable");
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "link");
    el.addEventListener("click", openCurrentFeatured);
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      openCurrentFeatured();
    });
  });

  refreshFeatured();

  const form = document.getElementById("home-lead-form") as HTMLFormElement | null;
  const successEl = document.getElementById("home-lead-success");
  const errorEl = document.getElementById("home-lead-error");
  const leadFields = document.getElementById("lead-fields");

  function syncContactMode(): void {
    const m = String(
      (form?.querySelector('input[name="contact_method"]:checked') as HTMLInputElement)
        ?.value,
    );
    if (leadFields)
      leadFields.dataset.contactMode = m === "instagram" ? "instagram" : "phone";
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
    const method = String(fd.get("contact_method") || "phone");
    const instagramRaw = String(fd.get("instagram_handle") || "").trim();
    const phone = String(fd.get("phone") || "").trim();

    let ok = true;
    form.querySelectorAll(".lead-invite__input").forEach((el) =>
      el.classList.remove("lead-invite__input--error"),
    );
    hideFormError(errorEl);
    successEl?.classList.remove("is-visible");
    if (!name) ok = false;
    if (method === "instagram" && !validateInstagramHandle(instagramRaw)) ok = false;
    if (method === "phone" && !validatePhone(phone)) ok = false;

    if (!ok) {
      if (!name) document.getElementById("home-name")?.classList.add("lead-invite__input--error");
      if (method === "instagram")
        document.getElementById("home-instagram")?.classList.add("lead-invite__input--error");
      if (method === "phone")
        document.getElementById("home-phone")?.classList.add("lead-invite__input--error");
      return;
    }

    const payload: Record<string, string> = {
      name,
      contactMethod: method,
    };
    if (method === "phone") payload.phone = phone;
    if (method === "instagram") payload.instagram_handle = instagramRaw;
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
