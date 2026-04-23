/**
 * Rich hover preview for discovery cards (featured carousel + all-venues grid).
 * Not used on the embedded hero map — map pins keep their own compact label.
 */
import {
  bestVisitKeys,
  clubTonightHint,
  currentWeekdayKey,
} from "../lib/club-hours.js";

export function initNightlifeDiscoverHover(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("nl-discover-hovercard")) return;

  const tip = document.createElement("div");
  tip.id = "nl-discover-hovercard";
  tip.className = "nl-discover-hovercard";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  document.body.appendChild(tip);

  let hideT = 0;
  let activeArticle: HTMLElement | null = null;
  let touchArmedArticle: HTMLElement | null = null;
  let touchArmedUntil = 0;
  const supportsHover =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const touchLike =
    !supportsHover ||
    (typeof navigator !== "undefined" && (navigator.maxTouchPoints || 0) > 0);

  function clearHide(): void {
    window.clearTimeout(hideT);
    hideT = 0;
  }

  function hideSoon(): void {
    clearHide();
    hideT = window.setTimeout(() => {
      tip.hidden = true;
      tip.innerHTML = "";
      activeArticle = null;
      touchArmedArticle = null;
      touchArmedUntil = 0;
    }, 140);
  }

  function clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, n));
  }

  function layout(article: HTMLElement): void {
    const cr = article.getBoundingClientRect();
    const vw = window.innerWidth;
    const margin = 12;
    const width = clamp(320, 260, vw - margin * 2);
    tip.style.width = `${width}px`;
    tip.style.maxWidth = `${width}px`;

    const left = clamp(
      cr.left + cr.width / 2 - width / 2,
      margin,
      vw - width - margin,
    );
    tip.style.left = `${left}px`;

    const gap = 10;
    tip.hidden = false;
    const h = tip.offsetHeight || 200;
    let top = cr.top - h - gap;
    if (top < margin) {
      top = cr.bottom + gap;
    }
    if (top + h > window.innerHeight - margin) {
      top = clamp(window.innerHeight - h - margin, margin, cr.bottom + gap);
    }
    tip.style.top = `${top}px`;
  }

  function show(article: HTMLElement): void {
    clearHide();
    activeArticle = article;

    const title =
      article.querySelector(".nl-card__title")?.textContent?.trim() ?? "";
    const desc =
      article.querySelector(".nl-card__desc")?.textContent?.trim() ?? "";
    const cardImg = article.querySelector(
      ".nl-card__media img",
    ) as HTMLImageElement | null;
    const cardImgSrc = cardImg?.currentSrc || cardImg?.src || "";
    const href =
      article.querySelector("a.nl-card__link")?.getAttribute("href") ?? "#";

    const loc = article.dataset.locationTag?.trim() ?? "";
    const days = article.dataset.daysOpen?.trim() ?? "";
    const known = article.dataset.knownFor?.trim() ?? "";
    const ew = article.dataset.entryWomen?.trim() ?? "";
    const em = article.dataset.entryMen?.trim() ?? "";
    const bestVisitRaw =
      article.dataset.bestVisit
        ?.split(",")
        .map((x) => x.trim())
        .filter(Boolean) ?? [];
    const rawGallery = article.dataset.gallery?.trim() ?? "";
    const galleryUrls = rawGallery
      .split("|")
      .map((x) => {
        try {
          return decodeURIComponent(x);
        } catch {
          return "";
        }
      })
      .filter(Boolean);
    const photoUrls =
      galleryUrls.length > 0
        ? galleryUrls
        : cardImgSrc
          ? [cardImgSrc]
          : [];

    const metaBits = [loc, days].filter(Boolean);
    const metaHtml = metaBits.length
      ? `<p class="nl-discover-hovercard__meta">${metaBits.map((x) => `<span>${escapeText(x)}</span>`).join(" · ")}</p>`
      : "";
    const knownHtml = known
      ? `<p class="nl-discover-hovercard__known">${escapeText(known)}</p>`
      : "";

    const visitKeys = bestVisitKeys(bestVisitRaw);
    const today = currentWeekdayKey();
    let statusHtml = "";
    if (visitKeys.length) {
      const peak = visitKeys.includes(today);
      const badgeClass = peak
        ? "nl-discover-hovercard__status nl-discover-hovercard__status--peak"
        : "nl-discover-hovercard__status nl-discover-hovercard__status--off";
      const badge = peak
        ? "Listed peak night tonight"
        : "Not a listed peak night tonight";
      const sub = peak
        ? "Busy nights are typical — confirm door times before you travel."
        : clubTonightHint(bestVisitRaw, days);
      statusHtml = `<div class="nl-discover-hovercard__status-block">
        <p class="${badgeClass}">${escapeText(badge)}</p>
        <p class="nl-discover-hovercard__status-hint">${escapeText(sub)}</p>
      </div>`;
    } else if (days) {
      const hint = clubTonightHint(bestVisitRaw, days);
      statusHtml = `<div class="nl-discover-hovercard__status-block">
        <p class="nl-discover-hovercard__status nl-discover-hovercard__status--neutral">${escapeText("Schedule on file")}</p>
        <p class="nl-discover-hovercard__status-hint">${escapeText(days)}${hint ? ` · ${escapeText(hint)}` : ""}</p>
      </div>`;
    }

    const entryRows: string[] = [];
    if (ew)
      entryRows.push(
        `<div class="nl-discover-hovercard__entry-row"><span class="nl-discover-hovercard__entry-k">Women</span><span class="nl-discover-hovercard__entry-v">${escapeText(ew)}</span></div>`,
      );
    if (em)
      entryRows.push(
        `<div class="nl-discover-hovercard__entry-row"><span class="nl-discover-hovercard__entry-k">Men</span><span class="nl-discover-hovercard__entry-v">${escapeText(em)}</span></div>`,
      );
    const entryHtml = entryRows.length
      ? `<div class="nl-discover-hovercard__entry" aria-label="Door pricing on file">
        <p class="nl-discover-hovercard__entry-title">Entry (on file)</p>
        ${entryRows.join("")}
      </div>`
      : "";

    const showNav = photoUrls.length > 1;
    const galleryBar = showNav
      ? `<div class="nl-discover-hovercard__gallery-bar">
          <button type="button" class="nl-discover-hovercard__gal-btn nl-discover-hovercard__gal-btn--prev" aria-label="Previous photo">‹</button>
          <span class="nl-discover-hovercard__gal-idx" aria-live="polite"></span>
          <button type="button" class="nl-discover-hovercard__gal-btn nl-discover-hovercard__gal-btn--next" aria-label="Next photo">›</button>
        </div>`
      : "";

    const firstSrc = photoUrls[0] ? escapeAttr(photoUrls[0]) : "";
    const mediaHtml = firstSrc
      ? `<div class="nl-discover-hovercard__media">
        <div class="nl-discover-hovercard__gallery">
          <img class="nl-discover-hovercard__gal-img" src="${firstSrc}" alt="" width="640" height="360" loading="lazy" decoding="async" />
          ${galleryBar}
        </div>
      </div>`
      : "";

    tip.innerHTML = `
      ${mediaHtml}
      <div class="nl-discover-hovercard__body">
        <p class="nl-discover-hovercard__title">${escapeText(title)}</p>
        ${desc ? `<p class="nl-discover-hovercard__desc">${escapeText(desc)}</p>` : ""}
        ${statusHtml}
        ${entryHtml}
        ${metaHtml}
        ${knownHtml}
        <a class="nl-discover-hovercard__cta" href="${escapeAttr(href)}">View club</a>
      </div>
    `;

    if (photoUrls.length && firstSrc) {
      let idx = 0;
      const imgEl = tip.querySelector(
        ".nl-discover-hovercard__gal-img",
      ) as HTMLImageElement | null;
      const idxEl = tip.querySelector(".nl-discover-hovercard__gal-idx");

      function renderFrame(): void {
        const u = photoUrls[idx];
        if (imgEl && u) imgEl.src = u;
        if (idxEl) {
          idxEl.textContent =
            photoUrls.length > 1 ? `${idx + 1} / ${photoUrls.length}` : "";
        }
      }

      const prev = tip.querySelector(".nl-discover-hovercard__gal-btn--prev");
      const next = tip.querySelector(".nl-discover-hovercard__gal-btn--next");
      prev?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        idx = (idx - 1 + photoUrls.length) % photoUrls.length;
        renderFrame();
      });
      next?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        idx = (idx + 1) % photoUrls.length;
        renderFrame();
      });
      renderFrame();
    }

    requestAnimationFrame(() => layout(article));
  }

  function openActiveArticle(): void {
    const href =
      activeArticle
        ?.querySelector("a.nl-card__link")
        ?.getAttribute("href")
        ?.trim() || "";
    if (!href) return;
    window.location.href = href;
  }

  function bindRegion(root: Element | null | undefined): void {
    if (!root) return;
    if (supportsHover) {
      root.addEventListener(
        "pointerenter",
        (ev) => {
          const a = (ev.target as HTMLElement).closest(
            "article.nl-card",
          ) as HTMLElement | null;
          if (!a || !root.contains(a)) return;
          show(a);
        },
        true,
      );
      root.addEventListener(
        "pointerleave",
        (ev) => {
          const related = (ev as PointerEvent).relatedTarget as Node | null;
          if (related && (tip.contains(related) || root.contains(related)))
            return;
          hideSoon();
        },
        true,
      );
    }
    if (touchLike) {
      root.addEventListener(
        "click",
        (ev) => {
          const t = ev.target as HTMLElement | null;
          const link = t?.closest("a.nl-card__link") as HTMLAnchorElement | null;
          const article = t?.closest("article.nl-card") as HTMLElement | null;
          if (!link || !article || !root.contains(article)) return;
          const now = Date.now();
          const armed =
            touchArmedArticle === article && now < touchArmedUntil && !tip.hidden;
          if (armed) {
            touchArmedArticle = null;
            touchArmedUntil = 0;
            return;
          }
          ev.preventDefault();
          show(article);
          touchArmedArticle = article;
          touchArmedUntil = now + 7000;
        },
        true,
      );
    }
  }

  tip.addEventListener("pointerenter", clearHide);
  tip.addEventListener("pointerleave", hideSoon);
  if (touchLike) {
    tip.addEventListener(
      "click",
      (ev) => {
        const t = ev.target as HTMLElement | null;
        if (!t) return;
        if (t.closest(".nl-discover-hovercard__gal-btn")) return;
        if (t.closest("a.nl-discover-hovercard__cta")) return;
        ev.preventDefault();
        ev.stopPropagation();
        openActiveArticle();
      },
      true,
    );
  }

  bindRegion(document.getElementById("nl-carousel-track"));
  bindRegion(document.getElementById("clubs-grid"));

  window.addEventListener(
    "scroll",
    () => {
      if (activeArticle && !tip.hidden) layout(activeArticle);
    },
    { passive: true, capture: true },
  );
  if (touchLike) {
    document.addEventListener(
      "click",
      (ev) => {
        const t = ev.target as HTMLElement | null;
        if (!t) return;
        if (tip.contains(t) || (activeArticle && activeArticle.contains(t))) return;
        hideSoon();
      },
      true,
    );
  }
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
