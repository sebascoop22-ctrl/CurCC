import { escAttr, escHtml } from "./html";
import type { PortalNavConfig } from "./types";

export interface PortalSidebarHandle {
  setActiveItem(itemId: string): void;
  setConfig(config: PortalNavConfig, activeItemId: string): void;
  destroy(): void;
}

export interface PortalSidebarOptions {
  config: PortalNavConfig;
  activeItemId: string;
  onSelect: (itemId: string) => void;
  onSignOut?: () => void;
  /** Header content rendered above the nav. */
  brandHtml?: string;
  /** Footer slot below the nav (e.g., environment label). */
  footerHtml?: string;
}

export function mountSidebar(
  parent: HTMLElement,
  options: PortalSidebarOptions,
): PortalSidebarHandle {
  const root = document.createElement("aside");
  root.className = "pp-sidebar";
  root.setAttribute("aria-label", "Portal navigation");
  parent.appendChild(root);

  let activeId = options.activeItemId;
  let cfg = options.config;

  function navHtml(): string {
    return cfg.groups
      .map((group) => {
        const groupLabel = group.label
          ? `<p class="pp-sidebar__group-label">${escHtml(group.label)}</p>`
          : "";
        const items = group.items
          .map((item) => {
            const isActive = item.id === activeId;
            const icon = item.icon
              ? `<span class="pp-sidebar__icon" aria-hidden="true">${escHtml(item.icon)}</span>`
              : `<span class="pp-sidebar__icon" aria-hidden="true">·</span>`;
            return `<button type="button" class="pp-sidebar__item${isActive ? " is-active" : ""}" data-pp-nav-item="${escAttr(item.id)}">
              ${icon}<span class="pp-sidebar__label">${escHtml(item.label)}</span>
            </button>`;
          })
          .join("");
        return `<div class="pp-sidebar__group">${groupLabel}<div class="pp-sidebar__items">${items}</div></div>`;
      })
      .join("");
  }

  function render(): void {
    root.innerHTML = `
      ${options.brandHtml ?? `
        <div class="pp-sidebar__brand">
          <p class="pp-sidebar__brand-eyebrow">Cooper Concierge</p>
          <p class="pp-sidebar__brand-title">Portal</p>
        </div>
      `}
      <nav class="pp-sidebar__nav">${navHtml()}</nav>
      <div class="pp-sidebar__footer">
        ${options.footerHtml ?? ""}
        ${options.onSignOut ? `<button type="button" class="pp-sidebar__signout" data-pp-signout>Sign out</button>` : ""}
      </div>
    `;
    bindEvents();
  }

  function bindEvents(): void {
    root.querySelectorAll<HTMLButtonElement>("[data-pp-nav-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.ppNavItem;
        if (!id || id === activeId) return;
        options.onSelect(id);
      });
    });
    if (options.onSignOut) {
      root.querySelector("[data-pp-signout]")?.addEventListener("click", () => {
        options.onSignOut?.();
      });
    }
  }

  render();

  return {
    setActiveItem(id: string): void {
      activeId = id;
      render();
    },
    setConfig(nextConfig: PortalNavConfig, nextActive: string): void {
      cfg = nextConfig;
      activeId = nextActive;
      render();
    },
    destroy(): void {
      if (root.parentElement) root.parentElement.removeChild(root);
    },
  };
}
