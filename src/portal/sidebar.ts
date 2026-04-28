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
  let openGroups = new Set<string>(cfg.groups.map((g) => g.id));

  function ensureOpenGroups(): void {
    const validIds = new Set(cfg.groups.map((g) => g.id));
    openGroups = new Set(Array.from(openGroups).filter((id) => validIds.has(id)));
    if (!openGroups.size) {
      cfg.groups.forEach((g) => openGroups.add(g.id));
    }
    const activeGroup = cfg.groups.find((g) => g.items.some((item) => item.id === activeId));
    if (activeGroup) openGroups.add(activeGroup.id);
  }

  function navHtml(): string {
    ensureOpenGroups();
    return cfg.groups
      .map((group) => {
        const isOpen = openGroups.has(group.id);
        const groupLabel = group.label
          ? `<button type="button" class="pp-sidebar__group-label" data-pp-group-toggle="${escAttr(group.id)}" aria-expanded="${isOpen ? "true" : "false"}">
              <span class="pp-sidebar__group-label-text">${escHtml(group.label)}</span>
              <span class="pp-sidebar__group-caret" aria-hidden="true">${isOpen ? "▾" : "▸"}</span>
            </button>`
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
        return `<div class="pp-sidebar__group${isOpen ? " is-open" : ""}" data-pp-group="${escAttr(group.id)}">${groupLabel}<div class="pp-sidebar__items${isOpen ? "" : " is-collapsed"}">${items}</div></div>`;
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
    root.querySelectorAll<HTMLButtonElement>("[data-pp-group-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const groupId = btn.dataset.ppGroupToggle;
        if (!groupId) return;
        if (openGroups.has(groupId)) openGroups.delete(groupId);
        else openGroups.add(groupId);
        render();
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
       ensureOpenGroups();
      render();
    },
    destroy(): void {
      if (root.parentElement) root.parentElement.removeChild(root);
    },
  };
}
