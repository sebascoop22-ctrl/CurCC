import { getSocialLinkItems, whatsappHref } from "./site-config";
import {
  cycleTheme,
  getCurrentThemeId,
  initThemeFromStorage,
  themeIcon,
  themeLabel,
} from "./theme";
import { getSupabaseClient } from "./lib/supabase";
import { resolveSignedInRole } from "./lib/session-role";
import {
  acceptAllConsent,
  analyticsConsentGranted,
  buildConsentBannerHtml,
  initConsentState,
  loadAnalyticsIntegrations,
  rejectAllConsent,
} from "./lib/consent";
import "./styles/global.css";

initThemeFromStorage();

export type ActivePage =
  | "home"
  | "nightlife"
  | "nightlife-map"
  | "club"
  | "promoter"
  | "security"
  | "chauffeuring"
  | "enquiry"
  | "admin"
  | "portal"
  | "account"
  | "privacy"
  | "terms";

const homeHref = "/";
const classicHomeHref = "/classic";
const servicesHref = `${classicHomeHref}#services`;

const THEME_LOGOS: Record<"dark" | "light" | "ocean", string> = {
  dark: "/media/home/logo_darkmode.svg",
  light: "/media/home/logo_lightmode.svg",
  ocean: "/media/home/logo_bluemode.svg",
};

function drawerLinks(active: ActivePage): string {
  const cls = (p: ActivePage | "nightlife-map") =>
    active === p ? ' class="is-active"' : "";
  return `
    <a href="${servicesHref}"${cls("home")}>Services</a>
    <a href="/"${cls("nightlife")}>Nightlife</a>
    <a href="/chauffeuring"${cls("chauffeuring")}>Chauffeur</a>
    <a href="/security"${cls("security")}>Security</a>
    <a href="/enquiry"${cls("enquiry")}>Inquiry</a>
    <a href="/account"${cls("account")}>Account</a>
  `;
}

function accountMenuHtml(
  state: {
  signedIn: boolean;
  role: "admin" | "promoter" | "club" | "host" | null;
  },
  active: ActivePage,
): string {
  if (!state.signedIn) {
    return [
      `<a class="site-account__item" href="/account">Sign in</a>`,
      `<a class="site-account__item" href="/account?mode=signup">Sign up</a>`,
    ].join("");
  }
  const links: string[] = [];
  if (state.role === "admin") {
    const allowRoleSwitch = active === "portal";
    if (allowRoleSwitch) {
      links.push(`<a class="site-account__item" href="/portal">Portal</a>`);
    } else {
      links.push(`<a class="site-account__item" href="/portal">Portal</a>`);
    }
  } else if (state.role === "promoter") {
    links.push(`<a class="site-account__item" href="/portal">Portal</a>`);
  } else if (state.role === "club") {
    links.push(`<a class="site-account__item" href="/portal">Portal</a>`);
  } else {
    links.push(`<a class="site-account__item" href="/portal">Portal</a>`);
  }
  links.push(`<button type="button" class="site-account__item site-account__item--danger" id="site-account-signout">Sign out</button>`);
  return links.join("");
}

export function initChrome(active: ActivePage): void {
  const header = document.getElementById("cc-header");
  const footer = document.getElementById("cc-footer");
  const modalRoot = document.getElementById("cc-modal-root");
  const drawer = document.getElementById("cc-drawer");
  if (!header || !footer || !modalRoot) return;

  const nightlifeActive = active === "nightlife" || active === "nightlife-map" || active === "club";
  const travelActive = active === "chauffeuring";
  const operationsActive = active === "security";
  const desktopNav = () => `<nav class="site-nav" aria-label="Primary">
    <div class="site-nav__group">
      <button type="button" class="site-nav__trigger ${nightlifeActive ? "is-active" : ""}">Access</button>
      <div class="site-nav__menu" role="menu" aria-label="Nightlife">
        <a href="/nightlife" class="site-nav__item ${nightlifeActive ? "is-active" : ""}" role="menuitem">Clubs</a>
        <!--<span class="site-nav__item is-disabled" role="menuitem" aria-disabled="true">Events</span>-->
      </div>
    </div>
    <div class="site-nav__group">
      <button type="button" class="site-nav__trigger ${travelActive ? "is-active" : ""}">Travel</button>
      <div class="site-nav__menu" role="menu" aria-label="Travel">
        <a href="/chauffeuring" class="site-nav__item ${travelActive ? "is-active" : ""}" role="menuitem">Chauffeur</a>
        <!--<span class="site-nav__item is-disabled" role="menuitem" aria-disabled="true">Yachts</span>-->
      </div>
    </div>
    <div class="site-nav__group">
      <button type="button" class="site-nav__trigger ${operationsActive ? "is-active" : ""}">Protection</button>
      <div class="site-nav__menu" role="menu" aria-label="Protection">
        <!--<span class="site-nav__item is-disabled" role="menuitem" aria-disabled="true">Close protection</span>-->
        <a href="/security" class="site-nav__item ${operationsActive ? "is-active" : ""}" role="menuitem">Security</a>
      </div>
    </div>
  </nav>`;

  header.innerHTML = `
    <div class="site-header__inner">
      <a href="${homeHref}" class="site-header__brand">
        <img src="${THEME_LOGOS[getCurrentThemeId()]}" alt="Cooper Concierge" width="160" height="48" class="site-header__logo-img" id="site-brand-logo" />
      </a>
      ${desktopNav()}
      <div class="site-header__actions">
        <button type="button" class="nav-toggle" id="cc-nav-toggle" aria-expanded="false" aria-controls="cc-drawer" aria-label="Open menu">☰</button>
        <button type="button" class="cc-theme-toggle" id="cc-theme-toggle" aria-label="Switch color theme" title="Theme">☾</button>
        <div class="site-account" id="site-account">
          <button type="button" class="site-account__btn" id="site-account-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu" title="Account">👤</button>
          <div class="site-account__menu" id="site-account-menu" role="menu" hidden></div>
        </div>
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
        <img src="${THEME_LOGOS[getCurrentThemeId()]}" alt="" class="site-footer__logo-mark" width="28" height="28" id="site-footer-logo" />
        <span>© ${new Date().getFullYear()} Cooper Concierge</span>
      </div>
      <div class="site-footer__cluster">
        <nav class="site-footer__pages" aria-label="Site pages">
          <a href="/nightlife">Nightlife</a>
          <a href="${classicHomeHref}">Classic home</a>
          <a href="/portal">Portal</a>
          <a href="/nightlife-map">Map</a>
          <a href="/chauffeuring">Chauffeur</a>
          <a href="/security">Security</a>
          <a href="/enquiry">Enquiry</a>
        </nav>
        ${socialHtml ? `<nav class="site-footer__social" aria-label="Social">${socialHtml}</nav>` : ""}
        <nav class="site-footer__links" aria-label="Legal">
          <a href="/privacy">Privacy</a>
          <a href="/privacy#privacy-choices">Do Not Sell or Share</a>
          <a href="/terms">Terms</a>
          <a href="/sitemap.xml">Sitemap</a>
          <button type="button" class="site-footer__prefs-btn" id="cc-open-consent">Cookie preferences</button>
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
          <a class="cc-btn cc-btn--ghost" href="/enquiry">Enquiry form</a>
        </div>
      </div>
    </div>
    ${buildConsentBannerHtml()}`;

  if (drawer) {
    drawer.innerHTML = drawerLinks(active);
  }

  const modal = document.getElementById("cc-modal");
  const openBtn = document.getElementById("cc-contact-open");
  const closeBtn = document.getElementById("cc-modal-close");
  const toggle = document.getElementById("cc-nav-toggle");
  const themeBtn = document.getElementById("cc-theme-toggle");
  const accountBtn = document.getElementById("site-account-btn") as HTMLButtonElement | null;
  const accountMenu = document.getElementById("site-account-menu") as HTMLElement | null;
  const brandLogo = document.getElementById("site-brand-logo") as HTMLImageElement | null;
  const footerLogo = document.getElementById("site-footer-logo") as HTMLImageElement | null;
  const consentBanner = document.getElementById("cc-consent-banner");
  const consentAccept = document.getElementById("cc-consent-accept");
  const consentReject = document.getElementById("cc-consent-reject");
  const consentOpen = document.getElementById("cc-open-consent");
  const supabase = getSupabaseClient();

  function refreshThemeToggle(): void {
    if (!themeBtn) return;
    const id = getCurrentThemeId();
    themeBtn.textContent = themeIcon(id);
    const name = themeLabel(id);
    themeBtn.title = `Theme: ${name} — click for next`;
    themeBtn.setAttribute("aria-label", `Color theme: ${name}. Click to switch theme.`);
    const logoSrc = THEME_LOGOS[id];
    if (brandLogo) brandLogo.src = logoSrc;
    if (footerLogo) footerLogo.src = logoSrc;
  }

  refreshThemeToggle();
  themeBtn?.addEventListener("click", () => {
    cycleTheme();
    refreshThemeToggle();
  });

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

  function setAccountMenu(open: boolean): void {
    if (!accountBtn || !accountMenu) return;
    accountBtn.setAttribute("aria-expanded", String(open));
    accountMenu.hidden = !open;
  }

  async function hydrateAccountMenu(): Promise<void> {
    if (!accountMenu || !accountBtn) return;
    const state = await resolveSignedInRole();
    accountMenu.innerHTML = accountMenuHtml(state, active);
    accountMenu.querySelector("#site-account-signout")?.addEventListener("click", () => {
      if (!supabase) {
        window.location.href = "/account";
        return;
      }
      void supabase.auth.signOut().then(() => {
        setAccountMenu(false);
        window.location.href = "/account";
      });
    });
  }

  void hydrateAccountMenu();
  supabase?.auth.onAuthStateChange(() => {
    void hydrateAccountMenu();
  });
  accountBtn?.addEventListener("click", () => {
    const open = accountBtn.getAttribute("aria-expanded") === "true";
    setAccountMenu(!open);
  });
  document.addEventListener("click", (e) => {
    const t = e.target as Node | null;
    if (!t) return;
    if (accountBtn?.contains(t) || accountMenu?.contains(t)) return;
    setAccountMenu(false);
  });

  toggle?.addEventListener("click", () => {
    const open = drawer?.classList.contains("is-open");
    setDrawer(!open);
  });

  drawer?.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => setDrawer(false));
  });

  const consentState = initConsentState();
  if (analyticsConsentGranted(consentState)) {
    loadAnalyticsIntegrations();
    consentBanner?.classList.remove("is-visible");
  } else {
    consentBanner?.classList.add("is-visible");
  }

  consentAccept?.addEventListener("click", () => {
    acceptAllConsent();
    loadAnalyticsIntegrations();
    consentBanner?.classList.remove("is-visible");
  });

  consentReject?.addEventListener("click", () => {
    rejectAllConsent();
    consentBanner?.classList.remove("is-visible");
  });

  consentOpen?.addEventListener("click", () => {
    consentBanner?.classList.add("is-visible");
  });
}
