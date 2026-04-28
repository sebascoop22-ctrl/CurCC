import { getSupabaseClient } from "../lib/supabase";
import { resolveSignedInRole, type AppRole } from "../lib/session-role";
import {
  PORTAL_OVERVIEW_VIEW,
  allowedModesForRole,
  defaultModeForRole,
  findNavItem,
  getNavConfigForMode,
} from "../portal/nav-config";
import { mountPortalShell, type PortalShellHandle } from "../portal/shell";
import type { PortalMode } from "../portal/types";
import { renderPortalOverview } from "./portal-overview";
import { initAdminPortal } from "./admin";
import { initClubPortal } from "./club";
import { initPromoterPortal } from "./promoter";
import "../styles/pages/portal-shell.css";

interface ModuleState {
  initialized: boolean;
  /** Resolves once the module's first render is in the DOM. */
  ready: Promise<void> | null;
}

export async function initPortalPage(): Promise<void> {
  const rootElMaybe = document.getElementById("portal-root");
  if (!rootElMaybe) return;
  const rootEl: HTMLElement = rootElMaybe;
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    rootEl.innerHTML = `<div class="admin-card"><p class="admin-flash admin-flash--error">Supabase is not configured.</p></div>`;
    return;
  }
  const supabase = supabaseClient;

  let shell: PortalShellHandle | null = null;
  let mountedRole: AppRole = null;
  const moduleState: Record<PortalMode, ModuleState> = {
    admin: { initialized: false, ready: null },
    promoter: { initialized: false, ready: null },
    club: { initialized: false, ready: null },
  };
  let currentMode: PortalMode = "admin";
  let activeItemId: string | null = null;

  function readUrlState(): { mode: PortalMode | null; itemId: string | null } {
    const params = new URLSearchParams(window.location.search);
    const rawView = params.get("view");
    if (!rawView) return { mode: null, itemId: null };
    const dot = rawView.indexOf(".");
    if (dot < 0) return { mode: null, itemId: null };
    const modeRaw = rawView.slice(0, dot);
    if (modeRaw !== "admin" && modeRaw !== "promoter" && modeRaw !== "club") {
      return { mode: null, itemId: null };
    }
    return { mode: modeRaw, itemId: rawView };
  }

  function writeUrlState(itemId: string | null): void {
    const params = new URLSearchParams(window.location.search);
    if (itemId) params.set("view", itemId);
    else params.delete("view");
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }

  function buildLegacyHosts(host: HTMLElement): {
    overviewHost: HTMLElement;
    legacyMount: HTMLElement;
    adminMount: HTMLElement;
    promoterMount: HTMLElement;
    clubMount: HTMLElement;
  } {
    host.innerHTML = `
      <div id="portal-overview-root"></div>
      <div id="legacy-mount" hidden>
        <div id="admin-root" hidden></div>
        <div id="promoter-root" hidden></div>
        <div id="club-root" hidden></div>
      </div>
    `;
    return {
      overviewHost: host.querySelector("#portal-overview-root") as HTMLElement,
      legacyMount: host.querySelector("#legacy-mount") as HTMLElement,
      adminMount: host.querySelector("#admin-root") as HTMLElement,
      promoterMount: host.querySelector("#promoter-root") as HTMLElement,
      clubMount: host.querySelector("#club-root") as HTMLElement,
    };
  }

  async function ensureModuleMounted(mode: PortalMode): Promise<void> {
    const state = moduleState[mode];
    if (state.initialized) return state.ready ?? Promise.resolve();
    state.initialized = true;
    state.ready = (async () => {
      if (mode === "admin") await initAdminPortal();
      else if (mode === "promoter") await initPromoterPortal();
      else if (mode === "club") await initClubPortal();
    })();
    await state.ready;
  }

  function showMount(mode: PortalMode | null, hosts: {
    overviewHost: HTMLElement;
    legacyMount: HTMLElement;
    adminMount: HTMLElement;
    promoterMount: HTMLElement;
    clubMount: HTMLElement;
  }, isOverview: boolean): void {
    hosts.overviewHost.hidden = !isOverview;
    if (isOverview) {
      hosts.legacyMount.hidden = true;
      hosts.adminMount.hidden = true;
      hosts.promoterMount.hidden = true;
      hosts.clubMount.hidden = true;
      return;
    }
    hosts.legacyMount.hidden = false;
    hosts.adminMount.hidden = mode !== "admin";
    hosts.promoterMount.hidden = mode !== "promoter";
    hosts.clubMount.hidden = mode !== "club";
  }

  /**
   * Drive the legacy module's internal view-state by clicking the matching
   * `[data-view]` button (which is rendered into the hidden legacy sidebar).
   * The click fires the existing handler so all module business logic works.
   */
  function dispatchLegacyView(mode: PortalMode, legacyView: string): void {
    if (legacyView === PORTAL_OVERVIEW_VIEW) return;
    const root =
      mode === "admin"
        ? document.getElementById("admin-root")
        : mode === "promoter"
          ? document.getElementById("promoter-root")
          : document.getElementById("club-root");
    if (!root) return;
    const selector =
      mode === "admin"
        ? `[data-view="${legacyView}"]`
        : mode === "promoter"
          ? `[data-promoter-view="${legacyView}"]`
          : `[data-club-view="${legacyView}"]`;
    const btn = root.querySelector(selector) as HTMLElement | null;
    if (btn) btn.click();
  }

  async function renderShellOnce(role: AppRole, email: string | null): Promise<void> {
    if (!role) return;
    if (mountedRole === role && shell) return;

    if (shell) shell.destroy();
    moduleState.admin = { initialized: false, ready: null };
    moduleState.promoter = { initialized: false, ready: null };
    moduleState.club = { initialized: false, ready: null };

    const allowedModes = allowedModesForRole(role);
    const urlState = readUrlState();
    const initialMode: PortalMode =
      urlState.mode && allowedModes.includes(urlState.mode)
        ? urlState.mode
        : (defaultModeForRole(role) ?? "promoter");
    currentMode = initialMode;
    const initialItemId =
      urlState.itemId &&
      findNavItem(getNavConfigForMode(initialMode), urlState.itemId)
        ? urlState.itemId
        : null;

    shell = mountPortalShell({
      rootEl,
      role: role as Exclude<AppRole, null>,
      email,
      initialMode,
      initialItemId,
      onSignOut: () => {
        void supabase.auth.signOut().then(() => {
          window.location.href = "/account";
        });
      },
      onModeChange: async (next) => {
        if (!allowedModes.includes(next)) return;
        currentMode = next;
      },
      onNavigate: async ({ mode, item, isOverview }) => {
        currentMode = mode;
        activeItemId = item.id;
        writeUrlState(item.id);
        const hosts = collectHosts();
        if (isOverview) {
          showMount(mode, hosts, true);
          await renderPortalOverview({
            host: hosts.overviewHost,
            supabase,
            mode,
            email,
            shell: shell!,
          });
          return;
        }
        await ensureModuleMounted(mode);
        showMount(mode, hosts, false);
        dispatchLegacyView(mode, item.legacyView);
      },
    });

    const hosts = buildLegacyHosts(shell.contentHost);

    mountedRole = role;
    activeItemId = initialItemId;

    if (initialItemId) {
      const navItem = findNavItem(
        getNavConfigForMode(initialMode),
        initialItemId,
      );
      const isOverview = navItem?.legacyView === PORTAL_OVERVIEW_VIEW;
      if (isOverview) {
        showMount(initialMode, hosts, true);
        await renderPortalOverview({
          host: hosts.overviewHost,
          supabase,
          mode: initialMode,
          email,
          shell,
        });
      } else if (navItem) {
        await ensureModuleMounted(initialMode);
        showMount(initialMode, hosts, false);
        dispatchLegacyView(initialMode, navItem.legacyView);
      }
    } else {
      showMount(initialMode, hosts, true);
      await renderPortalOverview({
        host: hosts.overviewHost,
        supabase,
        mode: initialMode,
        email,
        shell,
      });
    }
  }

  function collectHosts(): {
    overviewHost: HTMLElement;
    legacyMount: HTMLElement;
    adminMount: HTMLElement;
    promoterMount: HTMLElement;
    clubMount: HTMLElement;
  } {
    return {
      overviewHost: document.getElementById("portal-overview-root") as HTMLElement,
      legacyMount: document.getElementById("legacy-mount") as HTMLElement,
      adminMount: document.getElementById("admin-root") as HTMLElement,
      promoterMount: document.getElementById("promoter-root") as HTMLElement,
      clubMount: document.getElementById("club-root") as HTMLElement,
    };
  }

  async function render(): Promise<void> {
    const auth = await resolveSignedInRole(supabase);
    if (!auth.signedIn) {
      if (shell) {
        shell.destroy();
        shell = null;
        mountedRole = null;
      }
      rootEl.innerHTML = `<div class="admin-card"><p class="admin-note">Please sign in to continue.</p><a class="cc-btn cc-btn--gold" href="/account">Sign in</a></div>`;
      return;
    }
    if (!auth.role) {
      if (shell) {
        shell.destroy();
        shell = null;
        mountedRole = null;
      }
      rootEl.innerHTML = `<div class="admin-card"><p class="admin-flash admin-flash--error">Your account has no assigned portal role.</p></div>`;
      return;
    }
    let email: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      email = data.session?.user?.email ?? null;
    } catch {
      email = null;
    }

    void activeItemId;
    void currentMode;

    await renderShellOnce(auth.role, email);
  }

  supabase.auth.onAuthStateChange(() => {
    void render();
  });
  await render();
}
