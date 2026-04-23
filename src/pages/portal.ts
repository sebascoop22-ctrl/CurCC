import { getSupabaseClient } from "../lib/supabase";
import { resolveSignedInRole, type AppRole } from "../lib/session-role";
import { initAdminPortal } from "./admin";
import { initClubPortal } from "./club";
import { initPromoterPortal } from "./promoter";
import "../styles/pages/portal.css";

type PortalMode = "admin" | "promoter" | "club";

export async function initPortalPage(): Promise<void> {
  const rootEl = document.getElementById("portal-root");
  if (!rootEl) return;
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    rootEl.innerHTML = `<div class="admin-card"><p class="admin-flash admin-flash--error">Supabase is not configured.</p></div>`;
    return;
  }
  const root = rootEl;
  const supabase = supabaseClient;

  let currentMode: PortalMode = "promoter";
  let adminInitialized = false;
  let promoterInitialized = false;
  let clubInitialized = false;
  let mountedRole: AppRole = null;

  function shellHtml(role: AppRole): string {
    const adminAllowed = role === "admin";
    const promoterAllowed = role === "admin" || role === "promoter";
    const clubAllowed = role === "admin" || role === "club";
    return `
      <div class="portal-shell">
        <div class="portal-switcher" id="portal-switcher">
          <button type="button" class="cc-btn cc-btn--ghost" data-portal-mode="admin">Admin workspace</button>
          <button type="button" class="cc-btn cc-btn--ghost" data-portal-mode="promoter">Promoter workspace</button>
          <button type="button" class="cc-btn cc-btn--ghost" data-portal-mode="club">Club workspace</button>
        </div>
        <div id="portal-admin-wrap"${adminAllowed && currentMode === "admin" ? "" : " hidden"}>
          <div id="admin-root"></div>
        </div>
        <div id="portal-promoter-wrap"${promoterAllowed && currentMode === "promoter" ? "" : " hidden"}>
          <div id="promoter-root"></div>
        </div>
        <div id="portal-club-wrap"${clubAllowed && currentMode === "club" ? "" : " hidden"}>
          <div id="club-root"></div>
        </div>
      </div>
    `;
  }

  function applyMode(role: AppRole): void {
    const adminWrap = root.querySelector("#portal-admin-wrap") as HTMLElement | null;
    const promoterWrap = root.querySelector("#portal-promoter-wrap") as HTMLElement | null;
    const clubWrap = root.querySelector("#portal-club-wrap") as HTMLElement | null;
    const switcher = root.querySelector("#portal-switcher") as HTMLElement | null;
    const adminAllowed = role === "admin";
    const promoterAllowed = role === "admin" || role === "promoter";
    const clubAllowed = role === "admin" || role === "club";
    if (switcher) {
      switcher.hidden = !adminAllowed;
      const adminBtn = switcher.querySelector(
        '[data-portal-mode="admin"]',
      ) as HTMLButtonElement | null;
      const promoterBtn = switcher.querySelector(
        '[data-portal-mode="promoter"]',
      ) as HTMLButtonElement | null;
      const clubBtn = switcher.querySelector(
        '[data-portal-mode="club"]',
      ) as HTMLButtonElement | null;
      if (adminBtn) {
        adminBtn.className = `cc-btn ${currentMode === "admin" ? "cc-btn--gold" : "cc-btn--ghost"}`;
        adminBtn.hidden = !adminAllowed;
      }
      if (promoterBtn) {
        promoterBtn.className = `cc-btn ${currentMode === "promoter" ? "cc-btn--gold" : "cc-btn--ghost"}`;
        promoterBtn.hidden = !promoterAllowed;
      }
      if (clubBtn) {
        clubBtn.className = `cc-btn ${currentMode === "club" ? "cc-btn--gold" : "cc-btn--ghost"}`;
        clubBtn.hidden = !clubAllowed;
      }
    }
    if (adminWrap) adminWrap.hidden = !(adminAllowed && currentMode === "admin");
    if (promoterWrap) promoterWrap.hidden = !(promoterAllowed && currentMode === "promoter");
    if (clubWrap) clubWrap.hidden = !(clubAllowed && currentMode === "club");
  }

  function bindModeSwitch(role: AppRole): void {
    if (role !== "admin") return;
    root.querySelectorAll("[data-portal-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = (btn as HTMLElement).getAttribute("data-portal-mode");
        if (next !== "admin" && next !== "promoter" && next !== "club") return;
        currentMode = next;
        applyMode(role);
        void ensureMounted(role);
      });
    });
  }

  async function ensureMounted(role: AppRole): Promise<void> {
    if (role === "admin" && currentMode === "admin" && !adminInitialized) {
      adminInitialized = true;
      await initAdminPortal();
      return;
    }
    if ((role === "admin" || role === "promoter") && currentMode === "promoter" && !promoterInitialized) {
      promoterInitialized = true;
      await initPromoterPortal();
      return;
    }
    if ((role === "admin" || role === "club") && currentMode === "club" && !clubInitialized) {
      clubInitialized = true;
      await initClubPortal();
    }
  }

  async function render(): Promise<void> {
    const auth = await resolveSignedInRole(supabase);
    if (!auth.signedIn) {
      root.innerHTML = `<div class="admin-card"><p class="admin-note">Please sign in to continue.</p><a class="cc-btn cc-btn--gold" href="/account">Sign in</a></div>`;
      return;
    }
    if (!auth.role) {
      root.innerHTML = `<div class="admin-card"><p class="admin-flash admin-flash--error">Your account has no assigned portal role.</p></div>`;
      return;
    }
    if (auth.role !== "admin" && currentMode === "admin") {
      currentMode = auth.role === "club" ? "club" : "promoter";
    }
    if (auth.role === "club" && currentMode !== "club") {
      currentMode = "club";
    }
    if (mountedRole !== auth.role || !root.querySelector("#admin-root") || !root.querySelector("#promoter-root") || !root.querySelector("#club-root")) {
      root.innerHTML = shellHtml(auth.role);
      bindModeSwitch(auth.role);
      adminInitialized = false;
      promoterInitialized = false;
      clubInitialized = false;
      mountedRole = auth.role;
    }
    applyMode(auth.role);
    await ensureMounted(auth.role);
    applyMode(auth.role);
  }

  supabase.auth.onAuthStateChange(() => {
    void render();
  });
  await render();
}
