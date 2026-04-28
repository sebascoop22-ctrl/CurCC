import { mountDrawerHost } from "./drawer";
import { mountModalHost } from "./modal";
import {
  PORTAL_OVERVIEW_VIEW,
  allowedModesForRole,
  defaultModeForRole,
  findNavItem,
  firstNavItemId,
  getNavConfigForMode,
} from "./nav-config";
import { mountSidebar } from "./sidebar";
import { mountToastHost } from "./toast";
import { mountTopbar } from "./topbar";
import type {
  PortalDrawerOptions,
  PortalMode,
  PortalModalOptions,
  PortalNavItem,
  PortalRole,
  PortalShellApi,
  PortalToastVariant,
} from "./types";

export interface MountPortalShellOptions {
  rootEl: HTMLElement;
  role: PortalRole;
  email?: string | null;
  initialMode?: PortalMode | null;
  initialItemId?: string | null;
  /** Called whenever the user picks a sidebar item. */
  onNavigate: (params: {
    mode: PortalMode;
    item: PortalNavItem;
    isOverview: boolean;
  }) => void | Promise<void>;
  /** Called when the user changes the active mode (admin only). */
  onModeChange?: (mode: PortalMode) => void | Promise<void>;
  /** Called from topbar account menu sign-out. */
  onSignOut: () => void;
}

export interface PortalShellHandle extends PortalShellApi {
  /** The container the active mode/module should mount into. */
  contentHost: HTMLElement;
  setMode(mode: PortalMode, itemId?: string): void;
  setActiveItem(itemId: string): void;
  destroy(): void;
}

/**
 * Builds the unified portal shell (sidebar + topbar + content host + drawer/
 * modal/toast hosts) inside `rootEl` and returns a handle for the caller to
 * mount module content into `contentHost` and orchestrate navigation.
 */
export function mountPortalShell(
  options: MountPortalShellOptions,
): PortalShellHandle {
  const { rootEl } = options;
  rootEl.innerHTML = "";
  rootEl.classList.add("pp-shell-host");

  const allowedModes = allowedModesForRole(options.role);
  let mode: PortalMode =
    options.initialMode && allowedModes.includes(options.initialMode)
      ? options.initialMode
      : defaultModeForRole(options.role) ?? allowedModes[0] ?? "promoter";
  let navConfig = getNavConfigForMode(mode);
  let activeId: string =
    (options.initialItemId && findNavItem(navConfig, options.initialItemId)?.id) ??
    firstNavItemId(navConfig);

  const shell = document.createElement("div");
  shell.className = "pp-shell";
  rootEl.appendChild(shell);

  const sidebarWrap = document.createElement("div");
  sidebarWrap.className = "pp-shell__sidebar-wrap";
  shell.appendChild(sidebarWrap);

  const main = document.createElement("div");
  main.className = "pp-shell__main";
  shell.appendChild(main);

  const topbarWrap = document.createElement("div");
  topbarWrap.className = "pp-shell__topbar-wrap";
  main.appendChild(topbarWrap);

  const content = document.createElement("section");
  content.className = "pp-shell__content";
  main.appendChild(content);

  const overlayHost = document.createElement("div");
  overlayHost.className = "pp-shell__overlay";
  rootEl.appendChild(overlayHost);

  const initialItem = findNavItem(navConfig, activeId);

  const topbar = mountTopbar(topbarWrap, {
    mode,
    availableModes: allowedModes,
    email: options.email ?? null,
    initialTitle: initialItem?.label ?? "Portal",
    initialSubtitle: initialItem?.subtitle,
    onModeChange: (next) => {
      void handleModeChange(next);
    },
    onSignOut: options.onSignOut,
    onMobileMenu: () => {
      if (window.matchMedia("(max-width: 899px)").matches) {
        sidebarWrap.classList.toggle("is-open");
        shell.classList.toggle("is-mobile-menu-open");
        return;
      }
      shell.classList.toggle("is-sidebar-collapsed");
    },
  });

  const sidebar = mountSidebar(sidebarWrap, {
    config: navConfig,
    activeItemId: activeId,
    onSelect: (id) => {
      void handleSelect(id);
    },
    onSignOut: options.onSignOut,
  });

  const drawer = mountDrawerHost(overlayHost);
  const modal = mountModalHost(overlayHost);
  const toast = mountToastHost(overlayHost);

  function handleSelect(id: string): void {
    const item = findNavItem(navConfig, id);
    if (!item) return;
    activeId = id;
    sidebar.setActiveItem(id);
    topbar.setBreadcrumb(item.label, item.subtitle);
    sidebarWrap.classList.remove("is-open");
    shell.classList.remove("is-mobile-menu-open");
    void options.onNavigate({
      mode,
      item,
      isOverview: item.legacyView === PORTAL_OVERVIEW_VIEW,
    });
  }

  async function handleModeChange(next: PortalMode): Promise<void> {
    if (!allowedModes.includes(next) || next === mode) return;
    mode = next;
    navConfig = getNavConfigForMode(mode);
    activeId = firstNavItemId(navConfig);
    sidebar.setConfig(navConfig, activeId);
    topbar.setMode(mode);
    const item = findNavItem(navConfig, activeId);
    topbar.setBreadcrumb(item?.label ?? "Portal", item?.subtitle);
    if (options.onModeChange) await options.onModeChange(mode);
    if (item) {
      await options.onNavigate({
        mode,
        item,
        isOverview: item.legacyView === PORTAL_OVERVIEW_VIEW,
      });
    }
  }

  const api: PortalShellHandle = {
    contentHost: content,
    openDrawer(opts: PortalDrawerOptions): void {
      drawer.open(opts);
    },
    closeDrawer(): void {
      drawer.close();
    },
    openModal(opts: PortalModalOptions): void {
      modal.open(opts);
    },
    closeModal(): void {
      modal.close();
    },
    toast(message: string, variant: PortalToastVariant = "info"): void {
      toast.push(message, variant);
    },
    navigate(itemId: string): void {
      handleSelect(itemId);
    },
    setBreadcrumb(title: string, subtitle?: string): void {
      topbar.setBreadcrumb(title, subtitle);
    },
    setMode(next: PortalMode, itemId?: string): void {
      if (!allowedModes.includes(next)) return;
      const targetItem = itemId ?? null;
      mode = next;
      navConfig = getNavConfigForMode(mode);
      activeId =
        (targetItem && findNavItem(navConfig, targetItem)?.id) ??
        firstNavItemId(navConfig);
      sidebar.setConfig(navConfig, activeId);
      topbar.setMode(mode);
      const item = findNavItem(navConfig, activeId);
      topbar.setBreadcrumb(item?.label ?? "Portal", item?.subtitle);
    },
    setActiveItem(itemId: string): void {
      activeId = itemId;
      sidebar.setActiveItem(itemId);
      const item = findNavItem(navConfig, itemId);
      if (item) topbar.setBreadcrumb(item.label, item.subtitle);
    },
    destroy(): void {
      sidebar.destroy();
      topbar.destroy();
      drawer.destroy();
      modal.destroy();
      toast.destroy();
      rootEl.innerHTML = "";
      rootEl.classList.remove("pp-shell-host");
    },
  };

  return api;
}
