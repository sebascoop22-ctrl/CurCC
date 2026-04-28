import { escAttr, escHtml } from "./html";
import { cycleTheme, getCurrentThemeId, themeIcon, themeLabel } from "../theme";
import type { PortalMode } from "./types";

const THEME_LOGOS: Record<"dark" | "light" | "ocean", string> = {
  dark: "/media/home/logo_darkmode.svg",
  light: "/media/home/logo_lightmode.svg",
  ocean: "/media/home/logo_bluemode.svg",
};

export interface PortalTopbarHandle {
  setBreadcrumb(title: string, subtitle?: string): void;
  setMode(mode: PortalMode): void;
  setAvailableModes(modes: PortalMode[]): void;
  setEmail(email: string | null): void;
  destroy(): void;
}

export interface PortalTopbarOptions {
  mode: PortalMode;
  availableModes: PortalMode[];
  email?: string | null;
  onModeChange: (mode: PortalMode) => void;
  onSignOut: () => void;
  onMobileMenu: () => void;
  initialTitle: string;
  initialSubtitle?: string;
}

const MODE_LABELS: Record<PortalMode, string> = {
  admin: "Admin",
  promoter: "Promoter",
  club: "Club",
};

export function mountTopbar(
  parent: HTMLElement,
  options: PortalTopbarOptions,
): PortalTopbarHandle {
  const root = document.createElement("header");
  root.className = "pp-topbar";
  parent.appendChild(root);

  let title = options.initialTitle;
  let subtitle = options.initialSubtitle ?? "";
  let mode: PortalMode = options.mode;
  let modes = options.availableModes.slice();
  let email = options.email ?? null;
  let modeMenuOpen = false;
  let accountMenuOpen = false;

  function modeSwitcherHtml(): string {
    if (modes.length <= 1) return "";
    const items = modes
      .map(
        (m) =>
          `<button type="button" class="pp-topbar__mode-item${m === mode ? " is-active" : ""}" role="menuitem" data-pp-mode="${escAttr(m)}">${escHtml(MODE_LABELS[m])}</button>`,
      )
      .join("");
    return `<div class="pp-topbar__mode" data-pp-mode-root>
      <button type="button" class="pp-topbar__mode-trigger" data-pp-mode-trigger aria-haspopup="menu" aria-expanded="false">
        <span class="pp-topbar__mode-eyebrow">View as</span>
        <span class="pp-topbar__mode-current">${escHtml(MODE_LABELS[mode])}</span>
        <span class="pp-topbar__chev" aria-hidden="true">▾</span>
      </button>
      <div class="pp-topbar__mode-menu" role="menu" hidden>${items}</div>
    </div>`;
  }

  function accountMenuHtml(): string {
    const initial = (email ?? "?").trim().charAt(0).toUpperCase() || "?";
    return `<div class="pp-topbar__account" data-pp-account-root>
      <button type="button" class="pp-topbar__account-trigger" data-pp-account-trigger aria-haspopup="menu" aria-expanded="false" title="Account">
        <span class="pp-avatar pp-avatar--sm">${escHtml(initial)}</span>
      </button>
      <div class="pp-topbar__account-menu" role="menu" hidden>
        ${email ? `<p class="pp-topbar__account-email">${escHtml(email)}</p>` : ""}
        <a class="pp-menu-item" href="/">Back to site</a>
        <button type="button" class="pp-menu-item pp-menu-item--danger" data-pp-account-signout>Sign out</button>
      </div>
    </div>`;
  }

  function themeBtnHtml(): string {
    const id = getCurrentThemeId();
    return `<button
      type="button"
      class="pp-topbar__icon-btn"
      data-pp-theme-toggle
      title="Theme: ${escAttr(themeLabel(id))} - click for next"
      aria-label="Switch color theme"
    >${escHtml(themeIcon(id))}</button>`;
  }

  function logoLinkHtml(): string {
    const id = getCurrentThemeId();
    const src = THEME_LOGOS[id];
    return `<a class="pp-topbar__brand-link" href="/" aria-label="Back to main site" title="Back to main site">
      <img src="${escAttr(src)}" alt="Cooper Concierge" class="pp-topbar__brand-logo" />
    </a>`;
  }

  function setModeMenuOpen(open: boolean): void {
    modeMenuOpen = open;
    const modeTrigger = root.querySelector("[data-pp-mode-trigger]") as HTMLButtonElement | null;
    const modeMenu = root.querySelector(".pp-topbar__mode-menu") as HTMLElement | null;
    if (!modeTrigger || !modeMenu) return;
    modeMenu.hidden = !open;
    modeTrigger.setAttribute("aria-expanded", String(open));
  }

  function setAccountMenuOpen(open: boolean): void {
    accountMenuOpen = open;
    const accountTrigger = root.querySelector("[data-pp-account-trigger]") as HTMLButtonElement | null;
    const accountMenu = root.querySelector(".pp-topbar__account-menu") as HTMLElement | null;
    if (!accountTrigger || !accountMenu) return;
    accountMenu.hidden = !open;
    accountTrigger.setAttribute("aria-expanded", String(open));
  }

  function render(): void {
    root.innerHTML = `
      <button type="button" class="pp-topbar__menu-btn" data-pp-mobile-menu aria-label="Open menu">≡</button>
      <div class="pp-topbar__title">
        <h1 class="pp-topbar__title-text">${escHtml(title)}</h1>
        ${subtitle ? `<p class="pp-topbar__subtitle">${escHtml(subtitle)}</p>` : ""}
      </div>
      <div class="pp-topbar__actions">
        ${modeSwitcherHtml()}
        ${themeBtnHtml()}
        ${logoLinkHtml()}
        ${accountMenuHtml()}
      </div>
    `;
    bindEvents();
    setModeMenuOpen(modeMenuOpen);
    setAccountMenuOpen(accountMenuOpen);
  }

  function bindEvents(): void {
    document.removeEventListener("click", outsideClickHandler, true);
    root.querySelector("[data-pp-mobile-menu]")?.addEventListener("click", () => {
      options.onMobileMenu();
    });
    const themeBtn = root.querySelector("[data-pp-theme-toggle]") as HTMLButtonElement | null;
    themeBtn?.addEventListener("click", () => {
      const id = cycleTheme();
      const themeContainer = root.querySelector(".pp-topbar__actions") as HTMLElement | null;
      if (themeContainer) {
        const fresh = themeContainer.querySelector("[data-pp-theme-toggle]") as HTMLElement | null;
        if (fresh) {
          fresh.textContent = themeIcon(id);
          fresh.setAttribute("title", `Theme: ${themeLabel(id)} - click for next`);
        }
        const brandLogo = themeContainer.querySelector(".pp-topbar__brand-logo") as HTMLImageElement | null;
        if (brandLogo) brandLogo.src = THEME_LOGOS[id];
      }
    });

    const modeTrigger = root.querySelector("[data-pp-mode-trigger]") as HTMLButtonElement | null;
    if (modeTrigger) {
      modeTrigger.addEventListener("click", () => {
        const open = !modeMenuOpen;
        setModeMenuOpen(open);
        if (open) setAccountMenuOpen(false);
      });
      const modeMenu = root.querySelector(".pp-topbar__mode-menu") as HTMLElement | null;
      if (modeMenu) {
      modeMenu.querySelectorAll<HTMLButtonElement>("[data-pp-mode]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const next = btn.dataset.ppMode as PortalMode | undefined;
          if (!next || next === mode) {
            setModeMenuOpen(false);
            return;
          }
          setModeMenuOpen(false);
          options.onModeChange(next);
        });
      });
      }
    }

    const accountTrigger = root.querySelector("[data-pp-account-trigger]") as HTMLButtonElement | null;
    if (accountTrigger) {
      accountTrigger.addEventListener("click", () => {
        const open = !accountMenuOpen;
        setAccountMenuOpen(open);
        if (open) setModeMenuOpen(false);
      });
    }
    root.querySelector("[data-pp-account-signout]")?.addEventListener("click", () => {
      options.onSignOut();
    });

    document.addEventListener("click", outsideClickHandler, true);
  }

  function outsideClickHandler(e: Event): void {
    const t = e.target as Node | null;
    if (!t) return;
    const modeRoot = root.querySelector("[data-pp-mode-root]");
    const accountRoot = root.querySelector("[data-pp-account-root]");
    const modeMenu = root.querySelector(".pp-topbar__mode-menu") as HTMLElement | null;
    const accountMenu = root.querySelector(".pp-topbar__account-menu") as HTMLElement | null;
    if (modeRoot && !modeRoot.contains(t) && modeMenu && !modeMenu.hidden) {
      setModeMenuOpen(false);
    }
    if (accountRoot && !accountRoot.contains(t) && accountMenu && !accountMenu.hidden) {
      setAccountMenuOpen(false);
    }
  }

  render();

  return {
    setBreadcrumb(nextTitle: string, nextSubtitle?: string): void {
      title = nextTitle;
      subtitle = nextSubtitle ?? "";
      modeMenuOpen = false;
      accountMenuOpen = false;
      render();
    },
    setMode(nextMode: PortalMode): void {
      mode = nextMode;
      modeMenuOpen = false;
      accountMenuOpen = false;
      render();
    },
    setAvailableModes(nextModes: PortalMode[]): void {
      modes = nextModes.slice();
      modeMenuOpen = false;
      accountMenuOpen = false;
      render();
    },
    setEmail(nextEmail: string | null): void {
      email = nextEmail;
      accountMenuOpen = false;
      render();
    },
    destroy(): void {
      document.removeEventListener("click", outsideClickHandler, true);
      if (root.parentElement) root.parentElement.removeChild(root);
    },
  };
}
