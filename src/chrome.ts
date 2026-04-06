import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from '@vercel/speed-insights';
import { getSocialLinkItems, whatsappHref } from "./site-config";
import "./styles/global.css";

/** Vite/static sites use `inject()` — not `@vercel/analytics/next` (Next.js only). */
inject();
injectSpeedInsights();

export type ActivePage =
  | "home"
  | "nightlife"
  | "nightlife-map"
  | "security"
  | "chauffeuring"
  | "enquiry"
  | "admin"
  | "privacy"
  | "terms";

const homeHref = "index.html";
const servicesHref = `${homeHref}#services`;

function drawerLinks(active: ActivePage): string {
  const cls = (p: ActivePage | "nightlife-map") =>
    active === p ? ' class="is-active"' : "";
  return `
    <a href="${servicesHref}"${cls("home")}>Services</a>
    <a href="nightlife.html"${cls("nightlife")}>Nightlife</a>
    <a href="chauffeuring.html"${cls("chauffeuring")}>Chauffeur</a>
    <a href="security.html"${cls("security")}>Security</a>
    <a href="enquiry.html"${cls("enquiry")}>Inquiry</a>
  `;
}

export function initChrome(active: ActivePage): void {
  const header = document.getElementById("cc-header");
  const footer = document.getElementById("cc-footer");
  const modalRoot = document.getElementById("cc-modal-root");
  const drawer = document.getElementById("cc-drawer");
  if (!header || !footer || !modalRoot) return;

  const desktopNav = () => `<nav class="site-nav" aria-label="Primary">
    <a href="${servicesHref}" class="${active === "home" ? "is-active" : ""}">Services</a>
    <a href="nightlife.html" class="${active === "nightlife" || active === "nightlife-map" ? "is-active" : ""}">Nightlife</a>
    <a href="chauffeuring.html" class="${active === "chauffeuring" ? "is-active" : ""}">Chauffeur</a>
    <a href="security.html" class="${active === "security" ? "is-active" : ""}">Security</a>
    <a href="enquiry.html" class="${active === "enquiry" ? "is-active" : ""}">Inquiry</a>
  </nav>`;

  header.innerHTML = `
    <div class="site-header__inner">
      <a href="${homeHref}" class="site-header__brand">
        <img src="/media/home/brand-logo.jpeg" alt="Cooper Concierge" width="160" height="48" class="site-header__logo-img" />
      </a>
      ${desktopNav()}
      <div class="site-header__actions">
        <button type="button" class="nav-toggle" id="cc-nav-toggle" aria-expanded="false" aria-controls="cc-drawer" aria-label="Open menu">☰</button>
        <button type="button" class="cc-btn cc-btn--ghost cc-btn--header" id="cc-contact-open">Contact</button>
      </div>
    </div>`;

  const socialHtml = getSocialLinkItems()
    .map(
      (s) =>
        `<a href="${s.href}" target="_blank" rel="noopener noreferrer">${s.label}</a>`,
    )
    .join("");

  footer.innerHTML = `
    <div class="cc-container site-footer__minimal">
      <div class="site-footer__legal">
        <img src="/media/home/brand-logo.jpeg" alt="" class="site-footer__logo-mark" width="28" height="28" />
        <span>© ${new Date().getFullYear()} Cooper Concierge</span>
      </div>
      <div class="site-footer__cluster">
        <nav class="site-footer__pages" aria-label="Site pages">
          <a href="${homeHref}">Home</a>
          <a href="nightlife.html">Nightlife</a>
          <a href="nightlife-map.html">Map</a>
          <a href="chauffeuring.html">Chauffeur</a>
          <a href="security.html">Security</a>
          <a href="enquiry.html">Enquiry</a>
        </nav>
        ${socialHtml ? `<nav class="site-footer__social" aria-label="Social">${socialHtml}</nav>` : ""}
        <nav class="site-footer__links" aria-label="Legal">
          <a href="privacy.html">Privacy</a>
          <a href="terms.html">Terms</a>
          <a href="/sitemap.xml">Sitemap</a>
        </nav>
      </div>
    </div>`;

  modalRoot.innerHTML = `
    <div class="modal-overlay" id="cc-modal" role="dialog" aria-modal="true" aria-labelledby="cc-modal-title">
      <div class="modal">
        <button type="button" class="modal__close" id="cc-modal-close" aria-label="Close">×</button>
        <h3 id="cc-modal-title">Contact Concierge</h3>
        <p class="cc-form-hint">Send a message through the enquiry form—replies go to your concierge inbox.</p>
        <div class="modal__actions">
          <a class="cc-btn cc-btn--gold" href="${whatsappHref("Cooper Concierge enquiry")}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a class="cc-btn cc-btn--ghost" href="enquiry.html">Enquiry form</a>
        </div>
      </div>
    </div>`;

  if (drawer) {
    drawer.innerHTML = drawerLinks(active);
  }

  const modal = document.getElementById("cc-modal");
  const openBtn = document.getElementById("cc-contact-open");
  const closeBtn = document.getElementById("cc-modal-close");
  const toggle = document.getElementById("cc-nav-toggle");

  function setModal(open: boolean): void {
    modal?.classList.toggle("is-open", open);
  }

  openBtn?.addEventListener("click", () => setModal(true));
  closeBtn?.addEventListener("click", () => setModal(false));
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) setModal(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setModal(false);
      setDrawer(false);
    }
  });

  function setDrawer(open: boolean): void {
    drawer?.classList.toggle("is-open", open);
    toggle?.setAttribute("aria-expanded", String(open));
  }

  toggle?.addEventListener("click", () => {
    const open = drawer?.classList.contains("is-open");
    setDrawer(!open);
  });

  drawer?.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => setDrawer(false));
  });
}
