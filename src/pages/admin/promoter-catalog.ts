import type { SupabaseClient } from "@supabase/supabase-js";
import { escAttr, escHtml } from "../../portal/html";
import { mountDataTable } from "../../portal/data-table";
import { renderStatusBadge } from "../../portal/badge";
import type { PromoterRevisionRow } from "../../admin/promoters";
import type {
  FinancialPromoterProfile,
  PromoterInvoice,
  PromoterJob,
  PromoterProfile,
  PromoterSignupRequest,
} from "../../types";
import { renderEntityDetailChrome } from "./admin-entity-chrome";
import { writeEntityUrlParams } from "./entity-url";

export type PromoterCatalogMode = "list" | "detail";

export type PromoterDetailTab =
  | "profile"
  | "financial"
  | "jobs"
  | "invoices"
  | "clubs"
  | "account";

export const PROMOTER_DETAIL_TABS: Array<{ id: PromoterDetailTab; label: string }> = [
  { id: "profile", label: "Profile & revisions" },
  { id: "financial", label: "Financial" },
  { id: "jobs", label: "Jobs" },
  { id: "invoices", label: "Invoices" },
  { id: "clubs", label: "Club access" },
  { id: "account", label: "Account" },
];

export function parsePromoterDetailTab(raw: string): PromoterDetailTab {
  const t = raw.trim().toLowerCase();
  if (PROMOTER_DETAIL_TABS.some((x) => x.id === t)) return t as PromoterDetailTab;
  return "profile";
}

export type PromoterCatalogState = {
  mode: PromoterCatalogMode;
  detailId: string;
  detailTab: PromoterDetailTab;
  quickEditId: string | null;
};

export function defaultPromoterCatalogState(): PromoterCatalogState {
  return {
    mode: "list",
    detailId: "",
    detailTab: "profile",
    quickEditId: null,
  };
}

export function syncPromoterCatalogFromUrl(
  promoters: PromoterProfile[],
  state: PromoterCatalogState,
): PromoterCatalogState {
  const params = new URLSearchParams(window.location.search);
  const entityId = String(params.get("entityId") ?? params.get("slug") ?? "").trim();
  const tab = parsePromoterDetailTab(String(params.get("tab") ?? ""));
  if (entityId && promoters.some((p) => p.id === entityId)) {
    return { ...state, mode: "detail", detailId: entityId, detailTab: tab };
  }
  return {
    ...state,
    mode: "list",
    detailId: "",
    quickEditId: state.quickEditId,
  };
}

export function writePromoterCatalogUrl(
  promoterId: string | null,
  tab: PromoterDetailTab | null,
): void {
  writeEntityUrlParams({
    viewItemId: "admin.promoters",
    entityId: promoterId || null,
    tab: tab || null,
  });
}

function truncate(s: string, max: number): string {
  const t = String(s).replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export function renderPromoterQuickEditModalHtml(p: PromoterProfile): string {
  return `
    <div class="pp-modal-host finx-modal-host" id="promoter-quick-edit-host">
      <div class="pp-modal__overlay">
        <div class="pp-modal finx-modal admin-quick-edit-modal" role="dialog" aria-modal="true">
          <div class="pp-modal__header">
            <h4 class="pp-modal__title">Quick edit — ${escHtml(p.displayName || "Promoter")}</h4>
            <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-promoter-edit-all-details>Edit all details</button>
            <button type="button" class="pp-modal__close" data-promoter-quick-close aria-label="Close">×</button>
          </div>
          <div class="pp-modal__body">
            <form id="promoter-quick-edit-form" class="admin-form">
              <div class="cc-field full"><label>Display name</label><input name="displayName" required value="${escAttr(p.displayName)}" /></div>
              <div class="cc-field full"><label>Bio</label><textarea name="bio" rows="3">${escHtml(p.bio)}</textarea></div>
              <div class="cc-field full"><label>Profile image URL</label><input name="profileImageUrl" value="${escAttr(p.profileImageUrl)}" /></div>
              <div class="cc-field full"><label>Portfolio clubs (comma-separated slugs)</label><input name="portfolioClubSlugs" value="${escAttr(p.portfolioClubSlugs.join(", "))}" /></div>
            </form>
          </div>
          <div class="pp-modal__footer pp-modal__footer--dashboard">
            <button type="button" class="cc-btn cc-btn--ghost" data-promoter-quick-close>Cancel</button>
            <button type="button" class="cc-btn cc-btn--gold" data-promoter-quick-save>Save</button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderPromoterTabProfile(
  p: PromoterProfile,
  revisions: PromoterRevisionRow[],
): string {
  const revRows =
    revisions.length === 0
      ? `<tr><td colspan="4" class="admin-note">No pending revisions.</td></tr>`
      : revisions
          .map(
            (r) =>
              `<tr><td>${escHtml(r.status)}</td><td>${escHtml(r.created_at.slice(0, 10))}</td><td class="admin-list-col--wide"><code>${escHtml(JSON.stringify(r.payload).slice(0, 80))}</code></td><td>
                <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-promoter-rev-approve="${escAttr(r.id)}">Approve</button>
                <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-promoter-rev-reject="${escAttr(r.id)}">Reject</button>
              </td></tr>`,
          )
          .join("");
  return `
    <form id="promoter-tab-profile-form" class="admin-form">
      <div class="cc-field"><label>Approval</label><input readonly value="${escAttr(p.approvalStatus)}" /></div>
      <div class="cc-field"><label>Approved</label><input readonly value="${p.isApproved ? "yes" : "no"}" /></div>
      <div class="cc-field full"><label>Approval notes</label><textarea name="approvalNotes" rows="2">${escHtml(p.approvalNotes)}</textarea></div>
      <h4 class="full">Revisions</h4>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Status</th><th>Date</th><th>Payload</th><th></th></tr></thead><tbody>${revRows}</tbody></table></div>
    </form>`;
}

function renderPromoterTabFinancial(
  p: PromoterProfile,
  fin: FinancialPromoterProfile | null,
): string {
  return `
    <form id="promoter-tab-financial-form" class="admin-form">
      <p class="admin-note full">Portal profile is separate from the ledger promoter row used in bookings.</p>
      <div class="cc-field"><label>Ledger name</label><input name="finName" value="${escAttr(fin?.name ?? p.displayName)}" /></div>
      <div class="cc-field"><label>Commission %</label><input name="commissionPercentage" type="number" step="0.01" value="${fin?.commissionPercentage ?? 0}" /></div>
      <div class="cc-field"><label>Contact</label><input name="contact" value="${escAttr(fin?.contact ?? "")}" /></div>
      <div class="cc-field full"><label>Notes</label><textarea name="finNotes" rows="2">${escHtml(fin?.notes ?? "")}</textarea></div>
      <input type="hidden" name="finId" value="${escAttr(fin?.id ?? "")}" />
    </form>`;
}

function renderPromoterTabJobs(jobs: PromoterJob[]): string {
  const rows =
    jobs.length === 0
      ? `<tr><td colspan="5" class="admin-note">No jobs.</td></tr>`
      : jobs
          .map(
            (j) =>
              `<tr><td>${escHtml(j.jobDate)}</td><td>${escHtml(j.clubSlug || "—")}</td><td>${escHtml(j.service)}</td><td>${renderStatusBadge(j.status)}</td><td>${j.guestsCount}</td></tr>`,
          )
          .join("");
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Date</th><th>Club</th><th>Service</th><th>Status</th><th>Guests</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderPromoterTabInvoices(invoices: PromoterInvoice[]): string {
  const rows =
    invoices.length === 0
      ? `<tr><td colspan="4" class="admin-note">No invoices.</td></tr>`
      : invoices
          .map(
            (inv) =>
              `<tr><td>${escHtml(`${inv.periodStart.slice(0, 10)} – ${inv.periodEnd.slice(0, 10)}`)}</td><td>${escHtml(inv.status)}</td><td>${escHtml(`£${inv.total.toFixed(2)}`)}</td><td>${escHtml(inv.sentAt?.slice(0, 10) ?? "—")}</td></tr>`,
          )
          .join("");
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Period</th><th>Status</th><th>Total</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderPromoterTabClubs(
  prefs: Array<{ clubSlug: string; weekdays: string[]; status: string; notes: string }>,
): string {
  const rows =
    prefs.length === 0
      ? `<tr><td colspan="3" class="admin-note">No club preferences.</td></tr>`
      : prefs
          .map(
            (pr) =>
              `<tr><td><code>${escHtml(pr.clubSlug)}</code></td><td>${renderStatusBadge(pr.status)}</td><td>${escHtml(pr.weekdays.join(", ") || "—")}</td></tr>`,
          )
          .join("");
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Club</th><th>Status</th><th>Weekdays</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderPromoterTabAccount(
  p: PromoterProfile,
  request: PromoterSignupRequest | null,
): string {
  return `
    <div class="admin-form">
      <div class="cc-field"><label>User ID</label><input readonly value="${escAttr(p.userId)}" /></div>
      <div class="cc-field"><label>Signup request</label><input readonly value="${escHtml(request?.status ?? "—")}" /></div>
      ${request ? `<p class="admin-note">Request email: ${escHtml(request.email)} · submitted ${escHtml(request.createdAt.slice(0, 10))}</p>` : ""}
    </div>`;
}

export function renderPromoterDetailHtml(
  p: PromoterProfile,
  tab: PromoterDetailTab,
  tabHtml: string,
): string {
  return renderEntityDetailChrome({
    backLabel: "← Back to catalog",
    backDataAttr: "data-promoter-back-catalog",
    title: p.displayName || "Promoter",
    subtitle: p.userId,
    saveDataAttr: "data-promoter-detail-save",
    saveLabel: "Save changes",
    tabs: PROMOTER_DETAIL_TABS,
    activeTab: tab,
    tabDataAttr: "data-promoter-detail-tab",
    bodyHtml: tabHtml,
  });
}

export function buildPromoterTabHtml(
  tab: PromoterDetailTab,
  p: PromoterProfile,
  ctx: {
    revisions: PromoterRevisionRow[];
    financial: FinancialPromoterProfile | null;
    jobs: PromoterJob[];
    invoices: PromoterInvoice[];
    clubPrefs: Array<{ clubSlug: string; weekdays: string[]; status: string; notes: string }>;
    signupRequest: PromoterSignupRequest | null;
  },
): string {
  switch (tab) {
    case "profile":
      return renderPromoterTabProfile(p, ctx.revisions);
    case "financial":
      return renderPromoterTabFinancial(p, ctx.financial);
    case "jobs":
      return renderPromoterTabJobs(ctx.jobs);
    case "invoices":
      return renderPromoterTabInvoices(ctx.invoices);
    case "clubs":
      return renderPromoterTabClubs(ctx.clubPrefs);
    case "account":
      return renderPromoterTabAccount(p, ctx.signupRequest);
    default:
      return "";
  }
}

export type PromoterCatalogBindCtx = {
  supabase: SupabaseClient;
  adminRoot: HTMLElement;
  promoters: PromoterProfile[];
  state: PromoterCatalogState;
  listSearch: string;
  revisions: PromoterRevisionRow[];
  financialPromoters: FinancialPromoterProfile[];
  jobs: PromoterJob[];
  invoices: PromoterInvoice[];
  clubPrefsByPromoter: Map<string, Array<{ clubSlug: string; weekdays: string[]; status: string; notes: string }>>;
  signupRequests: PromoterSignupRequest[];
  onStateChange: (patch: Partial<PromoterCatalogState>) => void;
  onPromotersReload: () => Promise<void>;
  savePromoterProfile: (p: PromoterProfile) => Promise<{ ok: true } | { ok: false; message: string }>;
  saveFinancialPromoter: (input: {
    id?: string;
    userId: string;
    name: string;
    commissionPercentage: number;
    contact: string;
    notes: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
  approveRevision: (id: string, approve: boolean) => Promise<{ ok: true } | { ok: false; message: string }>;
  flash: (msg: string, kind?: "error") => void;
  renderDashboard: () => void;
};

export function mountPromoterCatalogListTable(
  host: HTMLElement,
  ctx: PromoterCatalogBindCtx,
): void {
  const q = ctx.listSearch.trim().toLowerCase();
  const rows = ctx.promoters.filter((p) => {
    if (!q) return true;
    const hay = `${p.displayName} ${p.userId}`.toLowerCase();
    return hay.includes(q);
  });
  host.innerHTML = "";
  mountDataTable(host, {
    id: "admin-promoters-catalog",
    rows,
    rowId: (p) => p.id,
    columns: [
      {
        key: "photo",
        label: "",
        width: "48px",
        render: (p) =>
          p.profileImageUrl
            ? `<img src="${escAttr(p.profileImageUrl)}" alt="" style="width:32px;height:32px;border-radius:999px;object-fit:cover" />`
            : `<span class="pp-avatar pp-avatar--sm">${escHtml((p.displayName || "?").charAt(0))}</span>`,
      },
      {
        key: "name",
        label: "Name",
        sortable: true,
        accessor: (p) => p.displayName,
        render: (p) => escHtml(truncate(p.displayName, 32)),
      },
      {
        key: "approval",
        label: "Approval",
        sortable: true,
        accessor: (p) => p.approvalStatus,
        render: (p) => renderStatusBadge(p.approvalStatus),
      },
      {
        key: "actions",
        label: "Actions",
        align: "right",
        render: (p) =>
          `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-promoter-quick-edit="${escAttr(p.id)}">Quick edit</button>
           <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-promoter-all-details="${escAttr(p.id)}">All details</button>`,
      },
    ],
    empty: { title: "No promoters", description: "Approve signup requests to add promoters." },
  });
}

export function bindPromoterCatalogEvents(ctx: PromoterCatalogBindCtx): void {
  const { adminRoot } = ctx;
  if (adminRoot.dataset.promoterCatalogBound === "1") return;
  adminRoot.dataset.promoterCatalogBound = "1";

  adminRoot.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    const qid = t.closest("[data-promoter-quick-edit]")?.getAttribute("data-promoter-quick-edit");
    if (qid) {
      ctx.onStateChange({ quickEditId: qid });
      ctx.renderDashboard();
      return;
    }
    const did = t.closest("[data-promoter-all-details]")?.getAttribute("data-promoter-all-details");
    if (did) {
      ctx.onStateChange({ mode: "detail", detailId: did, detailTab: "profile", quickEditId: null });
      writePromoterCatalogUrl(did, "profile");
      ctx.renderDashboard();
      return;
    }
    if (t.closest("[data-promoter-back-catalog]")) {
      ctx.onStateChange({ mode: "list", detailId: "" });
      writePromoterCatalogUrl(null, null);
      ctx.renderDashboard();
      return;
    }
    const tabBtn = t.closest("[data-promoter-detail-tab]");
    if (tabBtn) {
      const tab = parsePromoterDetailTab(tabBtn.getAttribute("data-promoter-detail-tab") || "");
      ctx.onStateChange({ detailTab: tab });
      writePromoterCatalogUrl(ctx.state.detailId, tab);
      ctx.renderDashboard();
      return;
    }
    if (t.closest("[data-promoter-quick-close]")) {
      ctx.onStateChange({ quickEditId: null });
      adminRoot.querySelector("#promoter-quick-edit-host")?.remove();
      return;
    }
    if (t.closest("[data-promoter-edit-all-details]")) {
      const id = ctx.state.quickEditId;
      adminRoot.querySelector("#promoter-quick-edit-host")?.remove();
      if (!id) return;
      ctx.onStateChange({ mode: "detail", detailId: id, detailTab: "profile", quickEditId: null });
      writePromoterCatalogUrl(id, "profile");
      ctx.renderDashboard();
      return;
    }
    if (t.closest("[data-promoter-quick-save]")) {
      const id = ctx.state.quickEditId;
      const form = adminRoot.querySelector("#promoter-quick-edit-form") as HTMLFormElement | null;
      const p = ctx.promoters.find((x) => x.id === id);
      if (!form || !p) return;
      const fd = new FormData(form);
      const updated: PromoterProfile = {
        ...p,
        displayName: String(fd.get("displayName") || "").trim(),
        bio: String(fd.get("bio") || "").trim(),
        profileImageUrl: String(fd.get("profileImageUrl") || "").trim(),
        portfolioClubSlugs: String(fd.get("portfolioClubSlugs") || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      };
      void (async () => {
        const res = await ctx.savePromoterProfile(updated);
        if (!res.ok) {
          ctx.flash(res.message, "error");
          return;
        }
        await ctx.onPromotersReload();
        ctx.onStateChange({ quickEditId: null });
        adminRoot.querySelector("#promoter-quick-edit-host")?.remove();
        ctx.flash("Promoter updated.");
        ctx.renderDashboard();
      })();
      return;
    }
    if (t.closest("[data-promoter-detail-save]")) {
      void savePromoterDetail(ctx);
      return;
    }
    const approve = t.closest("[data-promoter-rev-approve]")?.getAttribute("data-promoter-rev-approve");
    if (approve) {
      void (async () => {
        const res = await ctx.approveRevision(approve, true);
        if (!res.ok) {
          ctx.flash(res.message, "error");
          return;
        }
        await ctx.onPromotersReload();
        ctx.flash("Revision approved.");
        ctx.renderDashboard();
      })();
      return;
    }
    const reject = t.closest("[data-promoter-rev-reject]")?.getAttribute("data-promoter-rev-reject");
    if (reject) {
      void (async () => {
        const res = await ctx.approveRevision(reject, false);
        if (!res.ok) {
          ctx.flash(res.message, "error");
          return;
        }
        await ctx.onPromotersReload();
        ctx.flash("Revision rejected.");
        ctx.renderDashboard();
      })();
    }
  });
}

async function savePromoterDetail(ctx: PromoterCatalogBindCtx): Promise<void> {
  const p = ctx.promoters.find((x) => x.id === ctx.state.detailId);
  if (!p) return;
  if (ctx.state.detailTab === "profile") {
    const form = ctx.adminRoot.querySelector("#promoter-tab-profile-form") as HTMLFormElement | null;
    if (!form) return;
    const fd = new FormData(form);
    const updated = { ...p, approvalNotes: String(fd.get("approvalNotes") || "").trim() };
    const res = await ctx.savePromoterProfile(updated);
    if (!res.ok) {
      ctx.flash(res.message, "error");
      return;
    }
    ctx.flash("Profile saved.");
    await ctx.onPromotersReload();
    ctx.renderDashboard();
    return;
  }
  if (ctx.state.detailTab === "financial") {
    const form = ctx.adminRoot.querySelector("#promoter-tab-financial-form") as HTMLFormElement | null;
    if (!form) return;
    const fd = new FormData(form);
    const res = await ctx.saveFinancialPromoter({
      id: String(fd.get("finId") || "").trim() || undefined,
      userId: p.userId,
      name: String(fd.get("finName") || "").trim() || p.displayName,
      commissionPercentage: Number(fd.get("commissionPercentage") || 0) || 0,
      contact: String(fd.get("contact") || "").trim(),
      notes: String(fd.get("finNotes") || "").trim(),
    });
    if (!res.ok) {
      ctx.flash(res.message, "error");
      return;
    }
    ctx.flash("Financial promoter saved.");
    await ctx.onPromotersReload();
    ctx.renderDashboard();
  }
}
