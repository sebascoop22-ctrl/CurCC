import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminUpdatePromoterProfile,
  approvePromoterRevision,
  createPromoterJob,
  type PromoterRevisionRow,
} from "../../admin/promoters";
import { upsertClubToDb } from "../../admin/catalog";
import { upsertFinancialPromoter } from "../../admin/financial-tracking";
import type {
  Club,
  FinancialClubPaymentRate,
  FinancialPromoterProfile,
  FinancialTransactionRow,
  PromoterInvoice,
  PromoterJob,
  PromoterProfile,
  PromoterSignupRequest,
} from "../../types";
import {
  bindClubCatalogEvents,
  defaultClubCatalogState,
  mountClubCatalogDetail,
  mountClubCatalogListTable,
  renderClubQuickEditModalHtml,
  syncClubCatalogFromUrl,
  type ClubCatalogBindCtx,
  type ClubCatalogState,
} from "./club-catalog";
import type { ClubEntry } from "./club-catalog-shared";
import {
  bindPromoterCatalogEvents,
  defaultPromoterCatalogState,
  mountPromoterCatalogListTable,
  refreshPromoterCatalogDetail,
  renderPromoterQuickEditModalHtml,
  syncPromoterCatalogFromUrl,
  type PromoterCatalogBindCtx,
  type PromoterCatalogState,
} from "./promoter-catalog";

export type AdminCatalogWireDeps = {
  supabase: SupabaseClient;
  adminRoot: HTMLElement;
  view: string;
  getClubEntries: () => ClubEntry[];
  setClubEntries: (entries: ClubEntry[]) => void;
  getClubCatalogState: () => ClubCatalogState;
  setClubCatalogState: (s: ClubCatalogState) => void;
  getPromoterCatalogState: () => PromoterCatalogState;
  setPromoterCatalogState: (s: PromoterCatalogState) => void;
  listSearch: string;
  getRates: () => FinancialClubPaymentRate[];
  promoters: PromoterProfile[];
  getPromoterRevisions: () => PromoterRevisionRow[];
  nativeFinancialPromoters: FinancialPromoterProfile[];
  getPromoterJobs: () => PromoterJob[];
  promoterInvoices: PromoterInvoice[];
  promoterSignupRequests: PromoterSignupRequest[];
  getTransactions: () => FinancialTransactionRow[];
  financialPeriodFrom: string;
  financialPeriodTo: string;
  mediaBucket: string;
  safeUploadPath: (name: string) => string;
  validateClub: (club: Club) => string[];
  reloadRates: () => Promise<void>;
  reloadAccounts: () => Promise<void>;
  reloadPromoters: () => Promise<void>;
  reloadAllFromDb: () => Promise<void>;
  flash: (msg: string, kind?: "error") => void;
  renderDashboard: () => void;
};

export function syncCatalogStateFromUrl(deps: AdminCatalogWireDeps): void {
  if (deps.view === "clubs") {
    deps.setClubCatalogState(
      syncClubCatalogFromUrl(deps.getClubEntries(), deps.getClubCatalogState()),
    );
  }
  if (deps.view === "promoters") {
    deps.setPromoterCatalogState(
      syncPromoterCatalogFromUrl(deps.promoters, deps.getPromoterCatalogState()),
    );
  }
}

export function setupAdminCatalogViews(deps: AdminCatalogWireDeps): void {
  syncCatalogStateFromUrl(deps);

  if (deps.view === "clubs") {
    const state = deps.getClubCatalogState();
    const listHost = deps.adminRoot.querySelector("#admin-list") as HTMLElement | null;
    const detailHost = deps.adminRoot.querySelector("#admin-club-catalog-detail-host") as HTMLElement | null;
    const workspace = deps.adminRoot.querySelector(".admin-workspace");
    if (workspace) {
      workspace.classList.remove("admin-workspace--club-list", "admin-workspace--club-detail");
      workspace.classList.add(
        state.mode === "detail" ? "admin-workspace--club-detail" : "admin-workspace--club-list",
      );
    }

    const ctx: ClubCatalogBindCtx = {
      supabase: deps.supabase,
      adminRoot: deps.adminRoot,
      getEntries: deps.getClubEntries,
      getState: deps.getClubCatalogState,
      listSearch: deps.listSearch,
      rates: deps.getRates(),
      promoters: deps.promoters,
      transactions: deps.getTransactions(),
      financialPeriodFrom: deps.financialPeriodFrom,
      financialPeriodTo: deps.financialPeriodTo,
      mediaBucket: deps.mediaBucket,
      safeUploadPath: deps.safeUploadPath,
      validateClub: deps.validateClub,
      upsertClub: (club, meta) => upsertClubToDb(deps.supabase, club, meta),
      reloadRates: deps.reloadRates,
      reloadAccounts: deps.reloadAccounts,
      createJob: (input) =>
        createPromoterJob(deps.supabase, {
          promoter_id: input.promoterId,
          club_slug: input.clubSlug,
          service: input.service,
          job_date: input.jobDate,
          status: "assigned",
          client_name: "",
          client_contact: "",
          shift_fee: 0,
          guestlist_fee: 0,
          guests_count: 0,
          notes: "",
        }),
      onStateChange: (patch) => {
        deps.setClubCatalogState({ ...deps.getClubCatalogState(), ...patch });
      },
      onEntriesChange: (entries) => deps.setClubEntries(entries),
      flash: deps.flash,
      renderDashboard: deps.renderDashboard,
    };

    bindClubCatalogEvents(ctx);

    if (state.mode === "list" && listHost) {
      mountClubCatalogListTable(listHost, ctx);
    }
    if (state.mode === "detail" && detailHost) {
      void mountClubCatalogDetail(detailHost, ctx);
    }

    const qi = state.quickEditIndex;
    if (qi != null && deps.getClubEntries()[qi] && !deps.adminRoot.querySelector("#club-quick-edit-host")) {
      const wrap = document.createElement("div");
      wrap.innerHTML = renderClubQuickEditModalHtml(deps.getClubEntries()[qi]!.club);
      const host = wrap.firstElementChild;
      if (host) deps.adminRoot.append(host);
    }
  }

  if (deps.view === "promoters") {
    const state = deps.getPromoterCatalogState();
    const listHost = deps.adminRoot.querySelector("#admin-list") as HTMLElement | null;
    const detailHost = deps.adminRoot.querySelector("#admin-promoter-catalog-detail-host") as HTMLElement | null;
    const workspace = deps.adminRoot.querySelector(".admin-workspace");
    if (workspace) {
      workspace.classList.remove("admin-workspace--promoter-list", "admin-workspace--promoter-detail");
      workspace.classList.add(
        state.mode === "detail" ? "admin-workspace--promoter-detail" : "admin-workspace--promoter-list",
      );
    }

    const pctx: PromoterCatalogBindCtx = {
      supabase: deps.supabase,
      adminRoot: deps.adminRoot,
      promoters: deps.promoters,
      getState: deps.getPromoterCatalogState,
      listSearch: deps.listSearch,
      revisions: deps.getPromoterRevisions(),
      financialPromoters: deps.nativeFinancialPromoters,
      jobs: deps.getPromoterJobs(),
      invoices: deps.promoterInvoices,
      clubPrefsByPromoter: new Map(),
      signupRequests: deps.promoterSignupRequests,
      onStateChange: (patch) => {
        deps.setPromoterCatalogState({ ...deps.getPromoterCatalogState(), ...patch });
      },
      onPromotersReload: async () => {
        await deps.reloadPromoters();
        await deps.reloadAllFromDb();
      },
      savePromoterProfile: (p) =>
        adminUpdatePromoterProfile(deps.supabase, {
          id: p.id,
          displayName: p.displayName,
          bio: p.bio,
          profileImageUrl: p.profileImageUrl,
          portfolioClubSlugs: p.portfolioClubSlugs,
          approvalNotes: p.approvalNotes,
        }),
      saveFinancialPromoter: async (input) => {
        const res = await upsertFinancialPromoter(deps.supabase, input);
        if (!res.ok) return { ok: false, message: res.message };
        return { ok: true };
      },
      approveRevision: (id, approve) => approvePromoterRevision(deps.supabase, id, approve, ""),
      flash: deps.flash,
      renderDashboard: deps.renderDashboard,
    };

    bindPromoterCatalogEvents(pctx);

    if (state.mode === "list" && listHost) {
      mountPromoterCatalogListTable(listHost, pctx);
    }
    if (state.mode === "detail" && detailHost) {
      void refreshPromoterCatalogDetail(pctx);
    }

    const qid = state.quickEditId;
    if (qid) {
      const p = deps.promoters.find((x) => x.id === qid);
      if (p && !deps.adminRoot.querySelector("#promoter-quick-edit-host")) {
        const wrap = document.createElement("div");
        wrap.innerHTML = renderPromoterQuickEditModalHtml(p);
        const host = wrap.firstElementChild;
        if (host) deps.adminRoot.append(host);
      }
    }
  }
}

export { defaultClubCatalogState, defaultPromoterCatalogState };
