import type { SupabaseClient } from "@supabase/supabase-js";
import { escAttr, escHtml } from "../../portal/html";
import { mountDataTable } from "../../portal/data-table";
import type {
  Club,
  FinancialClubPaymentRate,
  FinancialTransactionRow,
  PromoterProfile,
} from "../../types";
import {
  CLUB_DETAIL_TABS,
  type ClubDetailTab,
  type ClubEntry,
  applyClubFinancialFromFormData,
  applyClubFullFromFormData,
  applyClubMediaFromFormData,
  applyClubPublicFromFormData,
  findClubEntryIndex,
  normalizeCatalogSlug,
  parseClubDetailTab,
  resolveClubCatalogSlug,
} from "./club-catalog-shared";
import {
  loadClubTabCache,
  renderClubTabPanelHtml,
  saveClubRateFromForm,
  inviteClubAccountFromForm,
  setPromoterAccessFromRow,
  wireClubDetailFieldEnhancements,
  type ClubTabCache,
} from "./club-catalog-tabs";
import { renderEntityDetailChrome } from "./admin-entity-chrome";
import {
  adminFieldText,
  adminFieldTextarea,
  adminSettingsSection,
} from "./admin-form-fields";
import { readEntityUrlParams, writeEntityUrlParams } from "./entity-url";

export type ClubCatalogMode = "list" | "detail";

export type ClubCatalogState = {
  mode: ClubCatalogMode;
  detailSlug: string;
  detailTab: ClubDetailTab;
  quickEditIndex: number | null;
  editingRateId: string | null;
  tabCache: ClubTabCache | null;
  heroImageIndex: number;
};

export function defaultClubCatalogState(): ClubCatalogState {
  return {
    mode: "list",
    detailSlug: "",
    detailTab: "general",
    quickEditIndex: null,
    editingRateId: null,
    tabCache: null,
    heroImageIndex: 0,
  };
}

export function syncClubCatalogFromUrl(
  entries: ClubEntry[],
  state: ClubCatalogState,
): ClubCatalogState {
  const params = new URLSearchParams(window.location.search);
  const urlSlug = String(params.get("slug") ?? "").trim();
  const urlTab = parseClubDetailTab(String(params.get("tab") ?? ""));
  const hasTabParam = params.has("tab");
  const slug = resolveClubCatalogSlug(
    entries,
    urlSlug,
    state.mode === "detail" ? state.detailSlug : "",
  );
  if (slug) {
    return {
      ...state,
      mode: "detail",
      detailSlug: slug,
      detailTab: hasTabParam ? urlTab : state.detailTab,
      quickEditIndex: null,
    };
  }
  return {
    ...state,
    mode: "list",
    detailSlug: "",
    quickEditIndex: state.quickEditIndex,
  };
}

export function writeClubCatalogUrl(
  slug: string | null,
  tab: ClubDetailTab | null,
): void {
  writeEntityUrlParams({
    viewItemId: "admin.clubs",
    slug: slug || null,
    tab: tab || null,
  });
}

function truncate(s: string, max: number): string {
  const t = String(s).replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export function renderClubQuickEditModalHtml(club: Club): string {
  return `
    <div class="pp-modal-host finx-modal-host" id="club-quick-edit-host">
      <div class="pp-modal__overlay" data-club-quick-edit-overlay>
        <div class="pp-modal finx-modal admin-quick-edit-modal" role="dialog" aria-modal="true" aria-label="Quick edit club">
          <div class="pp-modal__header">
            <h4 class="pp-modal__title">Quick edit — ${escHtml(club.name || club.slug || "Club")}</h4>
            <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-club-edit-all-details>Edit all details</button>
            <button type="button" class="pp-modal__close" data-club-quick-close aria-label="Close">×</button>
          </div>
          <div class="pp-modal__body">
            <form id="club-quick-edit-form" class="admin-settings-form">${adminSettingsSection(
              "Public profile",
              "Listing copy",
              `${adminFieldText({ name: "name", label: "Venue name", value: club.name, required: true, col: "full", autocomplete: "organization" })}
               ${adminFieldTextarea({ name: "shortDescription", label: "Short description", value: club.shortDescription, col: "full", rows: 2, maxlength: 280 })}
               ${adminFieldTextarea({ name: "longDescription", label: "Long description", value: club.longDescription, col: "full", rows: 4 })}
               ${adminFieldText({ name: "locationTag", label: "Location tag", value: club.locationTag, placeholder: "e.g. Mayfair", col: "pp-col-6" })}
               ${adminFieldText({ name: "address", label: "Street address", value: club.address, col: "pp-col-6", autocomplete: "street-address" })}
               ${adminFieldText({ name: "daysOpen", label: "Days open", value: club.daysOpen, placeholder: "Thu–Sat", col: "pp-col-6" })}
               ${adminFieldText({ name: "bestVisitDays", label: "Best visit days", value: club.bestVisitDays.join("|"), hint: "Use | between days", col: "pp-col-6" })}`,
            )}</form>
          </div>
          <div class="pp-modal__footer pp-modal__footer--dashboard">
            <button type="button" class="cc-btn cc-btn--ghost" data-club-quick-close>Cancel</button>
            <button type="button" class="cc-btn cc-btn--gold" data-club-quick-save>Save</button>
          </div>
        </div>
      </div>
    </div>`;
}

export function renderClubDetailHtml(
  club: Club,
  tab: ClubDetailTab,
  tabPanelHtml: string,
): string {
  return renderEntityDetailChrome({
    backLabel: "← Back to catalog",
    backDataAttr: "data-club-back-catalog",
    title: club.name || "Unnamed club",
    subtitle: club.slug,
    saveDataAttr: "data-club-detail-save",
    saveLabel: "Save changes",
    tabs: CLUB_DETAIL_TABS,
    activeTab: tab,
    tabDataAttr: "data-club-detail-tab",
    bodyHtml: tabPanelHtml,
    catalogSlug: club.slug.trim(),
  });
}

function resolveClubSlugFromCtx(ctx: ClubCatalogBindCtx): string | null {
  const detailRoot = ctx.adminRoot.querySelector(
    "#admin-club-catalog-detail-host .admin-entity-detail",
  ) as HTMLElement | null;
  const state = ctx.getState();
  return resolveClubCatalogSlug(
    ctx.getEntries(),
    state.detailSlug,
    readEntityUrlParams().slug,
    detailRoot?.dataset.catalogSlug ?? "",
  );
}

export type ClubCatalogBindCtx = {
  supabase: SupabaseClient;
  adminRoot: HTMLElement;
  getEntries: () => ClubEntry[];
  getState: () => ClubCatalogState;
  listSearch: string;
  rates: FinancialClubPaymentRate[];
  promoters: PromoterProfile[];
  transactions: FinancialTransactionRow[];
  financialPeriodFrom: string;
  financialPeriodTo: string;
  mediaBucket: string;
  safeUploadPath: (name: string) => string;
  validateClub: (club: Club) => string[];
  upsertClub: (
    club: Club,
    meta: { sortOrder: number; isActive: boolean; previousSlug?: string },
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  reloadRates: () => Promise<void>;
  reloadAccounts: () => Promise<void>;
  createJob: (input: {
    promoterId: string;
    clubSlug: string;
    jobDate: string;
    service: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
  onStateChange: (patch: Partial<ClubCatalogState>) => void;
  onEntriesChange: (entries: ClubEntry[]) => void;
  flash: (msg: string, kind?: "error") => void;
  renderDashboard: () => void;
};

function getEntry(ctx: ClubCatalogBindCtx, slug: string): ClubEntry | null {
  const entries = ctx.getEntries();
  const i = findClubEntryIndex(entries, slug);
  return i >= 0 ? entries[i]! : null;
}

function updateEntryClub(ctx: ClubCatalogBindCtx, slug: string, club: Club): void {
  const entries = ctx.getEntries();
  const i = findClubEntryIndex(entries, slug);
  if (i < 0) return;
  const next = [...entries];
  next[i] = { ...next[i]!, club };
  ctx.onEntriesChange(next);
}

/** Merge the visible tab form into in-memory catalog entries (only one tab is mounted at a time). */
function persistClubDetailDomToEntries(ctx: ClubCatalogBindCtx): void {
  const slug = resolveClubSlugFromCtx(ctx);
  if (!slug) return;
  const entry = getEntry(ctx, slug);
  if (!entry) return;

  let club = { ...entry.club };
  const publicForm = ctx.adminRoot.querySelector("#club-detail-public-form") as HTMLFormElement | null;
  const finForm = ctx.adminRoot.querySelector("#club-tab-financial-form") as HTMLFormElement | null;
  const mediaForm = ctx.adminRoot.querySelector("#club-tab-media-form") as HTMLFormElement | null;

  if (publicForm) {
    club = applyClubFullFromFormData(club, new FormData(publicForm));
  }
  if (finForm) {
    club = applyClubFinancialFromFormData(club, new FormData(finForm));
  }
  if (mediaForm) {
    club = applyClubMediaFromFormData(club, new FormData(mediaForm));
    const heroRaw = new FormData(mediaForm).get("heroImageIndex");
    const heroIndex = Number(heroRaw ?? 0);
    if (Number.isFinite(heroIndex) && heroIndex >= 0) {
      ctx.onStateChange({ heroImageIndex: heroIndex });
    }
  }

  updateEntryClub(ctx, slug, club);
}

let clubDetailMountSeq = 0;

function clubDetailMountStillCurrent(
  seq: number,
  ctx: ClubCatalogBindCtx,
  slug: string,
  tab: ClubDetailTab,
): boolean {
  if (seq !== clubDetailMountSeq) return false;
  const s = ctx.getState();
  const current = resolveClubCatalogSlug(ctx.getEntries(), s.detailSlug, slug);
  return s.mode === "detail" && current === slug && s.detailTab === tab;
}

export async function refreshClubCatalogDetail(ctx: ClubCatalogBindCtx): Promise<void> {
  const host = ctx.adminRoot.querySelector("#admin-club-catalog-detail-host") as HTMLElement | null;
  if (!host) {
    ctx.renderDashboard();
    return;
  }
  await mountClubCatalogDetail(host, ctx);
}

export function mountClubCatalogListTable(
  host: HTMLElement,
  ctx: ClubCatalogBindCtx,
): void {
  const q = ctx.listSearch.trim().toLowerCase();
  const rows = ctx.getEntries()
    .map((entry, idx) => ({ entry, idx }))
    .filter(({ entry }) => {
      if (!q) return true;
      const hay = `${entry.club.slug} ${entry.club.name} ${entry.club.locationTag}`.toLowerCase();
      return hay.includes(q);
    });
  host.innerHTML = "";
  mountDataTable(host, {
    id: "admin-clubs-catalog",
    rows,
    rowId: (r) => r.entry.club.slug || String(r.idx),
    columns: [
      {
        key: "image",
        label: "",
        width: "52px",
        render: ({ entry }) => {
          const img = entry.club.images?.[0];
          return img
            ? `<img src="${escAttr(img)}" alt="" style="width:40px;height:28px;border-radius:6px;object-fit:cover" />`
            : `<span class="pp-avatar pp-avatar--sm">•</span>`;
        },
      },
      { key: "slug", label: "Slug", sortable: true, accessor: ({ entry }) => entry.club.slug, render: ({ entry }) => `<code>${escHtml(entry.club.slug)}</code>` },
      { key: "name", label: "Name", sortable: true, accessor: ({ entry }) => entry.club.name, render: ({ entry }) => escHtml(truncate(entry.club.name, 36)) },
      { key: "location", label: "Location", sortable: true, accessor: ({ entry }) => entry.club.locationTag, render: ({ entry }) => escHtml(truncate(entry.club.locationTag || "—", 24)) },
      { key: "days", label: "Days open", sortable: true, accessor: ({ entry }) => entry.club.daysOpen, render: ({ entry }) => escHtml(truncate(entry.club.daysOpen || "—", 20)) },
      {
        key: "featured",
        label: "Featured",
        sortable: true,
        accessor: ({ entry }) => (entry.club.featured ? "yes" : "no"),
      },
      {
        key: "actions",
        label: "Actions",
        align: "right",
        render: ({ idx }) =>
          `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-club-quick-edit="${idx}">Quick edit</button>
           <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-club-all-details="${idx}">All details</button>
           <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-club-delete="${idx}">Delete</button>`,
      },
    ],
    empty: { title: "No clubs", description: "Add a club to get started." },
  });
}

export async function mountClubCatalogDetail(
  host: HTMLElement,
  ctx: ClubCatalogBindCtx,
): Promise<void> {
  const seq = ++clubDetailMountSeq;
  const state = ctx.getState();
  if (state.mode !== "detail") return;
  const slug =
    resolveClubCatalogSlug(
      ctx.getEntries(),
      state.detailSlug,
      readEntityUrlParams().slug,
    ) ?? "";
  const tab = state.detailTab;
  if (!slug) return;

  const entry = getEntry(ctx, slug);
  if (!entry) {
    if (!clubDetailMountStillCurrent(seq, ctx, slug, tab)) return;
    host.innerHTML = `<p class="admin-note">Club not found. <button type="button" class="cc-btn cc-btn--ghost" data-club-back-catalog>Back to catalog</button></p>`;
    return;
  }
  const tabHtml = await buildClubDetailTabHtml(ctx, entry.club, tab, seq);
  if (!clubDetailMountStillCurrent(seq, ctx, slug, tab)) return;
  host.innerHTML = renderClubDetailHtml(entry.club, tab, tabHtml);
  wireClubDetailFieldEnhancements(host);
}

export function bindClubCatalogEvents(ctx: ClubCatalogBindCtx): void {
  const { adminRoot } = ctx;
  if (adminRoot.dataset.clubCatalogBound === "1") return;
  adminRoot.dataset.clubCatalogBound = "1";

  adminRoot.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    const entries = ctx.getEntries();

    // Clicks inside the quick-edit dialog must not bubble to other admin handlers (e.g. list row actions).
    if (t.closest("#club-quick-edit-host .pp-modal")) {
      ev.stopPropagation();
    }

    const quickBtn = t.closest("[data-club-quick-edit]") as HTMLElement | null;
    const quickIdx = quickBtn?.getAttribute("data-club-quick-edit");
    if (quickIdx != null) {
      ev.preventDefault();
      ev.stopPropagation();
      const i = Number(quickIdx);
      if (!Number.isFinite(i) || !entries[i]) return;
      ctx.onStateChange({ quickEditIndex: i });
      ctx.renderDashboard();
      return;
    }
    const allIdx = t.closest("[data-club-all-details]")?.getAttribute("data-club-all-details");
    if (allIdx != null) {
      ev.preventDefault();
      ev.stopPropagation();
      const i = Number(allIdx);
      const slug = entries[i]?.club.slug?.trim();
      if (!slug) return;
      ctx.onStateChange({ mode: "detail", detailSlug: slug, detailTab: "general", tabCache: null });
      writeClubCatalogUrl(slug, "general");
      ctx.renderDashboard();
      return;
    }
    const delIdx = t.closest("[data-club-delete]")?.getAttribute("data-club-delete");
    if (delIdx != null) {
      const i = Number(delIdx);
      const entry = entries[i];
      if (!entry) return;
      if (!window.confirm(`Delete club “${entry.club.slug}”?`)) return;
      void (async () => {
        const { deleteClubFromDb } = await import("../../admin/catalog");
        const res = await deleteClubFromDb(ctx.supabase, entry.club.slug);
        if (!res.ok) {
          ctx.flash(res.message, "error");
          return;
        }
        const next = entries.filter((_, j) => j !== i);
        ctx.onEntriesChange(next);
        ctx.flash("Club deleted.");
        ctx.renderDashboard();
      })();
      return;
    }
    if (t.closest("[data-club-back-catalog]")) {
      ctx.onStateChange({ mode: "list", detailSlug: "", tabCache: null, editingRateId: null });
      writeClubCatalogUrl(null, null);
      ctx.renderDashboard();
      return;
    }
    const tabBtn = t.closest("[data-club-detail-tab]") as HTMLElement | null;
    if (tabBtn) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      const state = ctx.getState();
      const tab = parseClubDetailTab(tabBtn.getAttribute("data-club-detail-tab") || "");
      const slug = resolveClubSlugFromCtx(ctx);
      if (!slug) return;
      if (state.mode === "detail" && state.detailTab === tab && state.detailSlug.trim() === slug) {
        return;
      }
      persistClubDetailDomToEntries(ctx);
      writeClubCatalogUrl(slug, tab);
      ctx.onStateChange({
        mode: "detail",
        detailSlug: slug,
        detailTab: tab,
        tabCache: null,
        editingRateId: null,
      });
      ctx.renderDashboard();
      return;
    }
    const quickOverlay = t.closest("[data-club-quick-edit-overlay]");
    if (quickOverlay && ev.target === quickOverlay) {
      ctx.onStateChange({ quickEditIndex: null });
      adminRoot.querySelector("#club-quick-edit-host")?.remove();
      return;
    }
    if (t.closest("[data-club-quick-close]")) {
      ctx.onStateChange({ quickEditIndex: null });
      adminRoot.querySelector("#club-quick-edit-host")?.remove();
      return;
    }
    if (t.closest("[data-club-edit-all-details]")) {
      const state = ctx.getState();
      const i = state.quickEditIndex;
      const slug = i != null ? entries[i]?.club.slug?.trim() : "";
      adminRoot.querySelector("#club-quick-edit-host")?.remove();
      if (!slug) return;
      ctx.onStateChange({ mode: "detail", detailSlug: slug, detailTab: "general", quickEditIndex: null, tabCache: null });
      writeClubCatalogUrl(slug, "general");
      ctx.renderDashboard();
      return;
    }
    if (t.closest("[data-club-quick-save]")) {
      const state = ctx.getState();
      const i = state.quickEditIndex;
      if (i == null) return;
      const form = adminRoot.querySelector("#club-quick-edit-form") as HTMLFormElement | null;
      const entry = entries[i];
      if (!form || !entry) return;
      const previousSlug = entry.club.slug.trim();
      const club = {
        ...applyClubPublicFromFormData(entry.club, new FormData(form)),
        slug: normalizeCatalogSlug(previousSlug),
      };
      const errs = ctx.validateClub(club);
      if (errs.length) {
        ctx.flash(errs.join(" "), "error");
        return;
      }
      void (async () => {
        const res = await ctx.upsertClub(club, {
          sortOrder: i + 1,
          isActive: true,
          previousSlug,
        });
        if (!res.ok) {
          ctx.flash(res.message, "error");
          return;
        }
        updateEntryClub(ctx, previousSlug, club);
        ctx.onStateChange({ quickEditIndex: null });
        adminRoot.querySelector("#club-quick-edit-host")?.remove();
        ctx.flash("Club updated.");
        ctx.renderDashboard();
      })();
      return;
    }
    if (t.closest("[data-club-detail-save]")) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      void saveClubDetail(ctx);
      return;
    }
    const rateEdit = t.closest("[data-club-rate-edit]")?.getAttribute("data-club-rate-edit");
    if (rateEdit) {
      ctx.onStateChange({ editingRateId: rateEdit });
      ctx.renderDashboard();
      return;
    }
    if (t.closest("[data-club-rate-cancel]")) {
      ctx.onStateChange({ editingRateId: null });
      ctx.renderDashboard();
      return;
    }
  });

  adminRoot.addEventListener("submit", (ev) => {
    const form = (ev.target as HTMLElement).closest("form");
    if (!form) return;
    const slug = resolveClubSlugFromCtx(ctx);
    if (!slug) return;
    if (form.id === "club-detail-public-form") {
      ev.preventDefault();
      void saveClubDetail(ctx);
      return;
    }
    if (form.id === "club-tab-rates-form") {
      ev.preventDefault();
      void (async () => {
        const res = await saveClubRateFromForm(ctx.supabase, slug, form as HTMLFormElement, ctx.rates);
        if (!res.ok) {
          ctx.flash(res.message, "error");
          return;
        }
        await ctx.reloadRates();
        ctx.onStateChange({ editingRateId: null, tabCache: null });
        ctx.flash("Rate saved.");
        ctx.renderDashboard();
      })();
      return;
    }
    if (form.id === "club-tab-account-invite") {
      ev.preventDefault();
      void (async () => {
        const res = await inviteClubAccountFromForm(ctx.supabase, slug, form as HTMLFormElement);
        if (!res.ok) {
          ctx.flash(res.message, "error");
          return;
        }
        await ctx.reloadAccounts();
        ctx.onStateChange({ tabCache: null });
        ctx.flash(`Invite created. Code: ${res.inviteCode}`);
        ctx.renderDashboard();
      })();
      return;
    }
    if (form.id === "club-tab-job-create") {
      ev.preventDefault();
      const fd = new FormData(form as HTMLFormElement);
      void (async () => {
        const res = await ctx.createJob({
          promoterId: String(fd.get("promoterId") || "").trim(),
          clubSlug: slug,
          jobDate: String(fd.get("jobDate") || "").trim(),
          service: String(fd.get("service") || "guestlist").trim(),
        });
        if (!res.ok) {
          ctx.flash(res.message, "error");
          return;
        }
        ctx.onStateChange({ tabCache: null });
        ctx.flash("Job created.");
        ctx.renderDashboard();
      })();
    }
  });

  adminRoot.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    const allowBtn = t.closest("[data-club-promoter-allow]") as HTMLElement | null;
    if (!allowBtn) return;
    const tr = allowBtn.closest("tr");
    const prefId = tr?.getAttribute("data-pref-id")?.trim();
    if (!prefId) return;
    const allow = allowBtn.getAttribute("data-club-promoter-allow") === "true";
    const note = String(
      (adminRoot.querySelector("#club-tab-promoter-note") as HTMLTextAreaElement | null)?.value ?? "",
    ).trim();
    void (async () => {
      const res = await setPromoterAccessFromRow(ctx.supabase, prefId, allow, note);
      if (!res.ok) {
        ctx.flash(res.message, "error");
        return;
      }
      ctx.onStateChange({ tabCache: null });
      ctx.flash(allow ? "Promoter access restored." : "Promoter access revoked.");
      ctx.renderDashboard();
    })();
  });

  const uploadBtn = adminRoot.querySelector("#club-tab-image-upload");
  uploadBtn?.addEventListener("click", () => {
    const slug = ctx.getState().detailSlug.trim();
    if (!slug) return;
    const input = adminRoot.querySelector("#club-tab-image-file") as HTMLInputElement | null;
    const ta = adminRoot.querySelector("#club-tab-images-text") as HTMLTextAreaElement | null;
    const file = input?.files?.[0];
    if (!file || !ta) {
      ctx.flash("Choose an image file.", "error");
      return;
    }
    void (async () => {
      const path = `catalog/clubs/${slug}/${ctx.safeUploadPath(file.name)}`;
      const { error } = await ctx.supabase.storage
        .from(ctx.mediaBucket)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        ctx.flash(`Upload failed: ${error.message}`, "error");
        return;
      }
      const pub = ctx.supabase.storage.from(ctx.mediaBucket).getPublicUrl(path);
      const line = pub.data.publicUrl;
      const cur = ta.value.trim();
      ta.value = cur ? `${cur}\n${line}` : line;
      ctx.flash("Image uploaded.");
    })();
  });
}

async function saveClubDetail(ctx: ClubCatalogBindCtx): Promise<void> {
  const previousSlug = resolveClubSlugFromCtx(ctx);
  if (!previousSlug) {
    ctx.flash("Club not found.", "error");
    return;
  }
  persistClubDetailDomToEntries(ctx);
  const entry = getEntry(ctx, previousSlug);
  if (!entry) {
    ctx.flash("Club not found.", "error");
    return;
  }
  const club = { ...entry.club, slug: normalizeCatalogSlug(entry.club.slug) };
  const idx = findClubEntryIndex(ctx.getEntries(), previousSlug);
  const errs = ctx.validateClub(club);
  if (errs.length) {
    ctx.flash(errs.join(" "), "error");
    return;
  }
  const res = await ctx.upsertClub(club, {
    sortOrder: Math.max(1, idx + 1),
    isActive: true,
    previousSlug,
  });
  if (!res.ok) {
    ctx.flash(res.message, "error");
    return;
  }
  const savedSlug = club.slug;
  updateEntryClub(ctx, previousSlug, club);
  const state = ctx.getState();
  const tab = state.detailTab;
  ctx.onStateChange({
    mode: "detail",
    detailSlug: savedSlug,
    detailTab: tab,
    tabCache: null,
    editingRateId: null,
  });
  writeClubCatalogUrl(savedSlug, tab);
  ctx.flash("Club saved.");
  ctx.renderDashboard();
}

export async function buildClubDetailTabHtml(
  ctx: ClubCatalogBindCtx,
  club: Club,
  tab: ClubDetailTab,
  mountSeq: number,
): Promise<string> {
  const slug = club.slug.trim();
  if (!clubDetailMountStillCurrent(mountSeq, ctx, slug, tab)) return "";

  let cache = ctx.getState().tabCache;
  if (!cache) {
    cache = await loadClubTabCache(
      ctx.supabase,
      club.slug,
      ctx.financialPeriodFrom,
      ctx.financialPeriodTo,
    );
    if (!clubDetailMountStillCurrent(mountSeq, ctx, slug, tab)) return "";
    const afterLoad = ctx.getState();
    if (!afterLoad.tabCache) {
      ctx.onStateChange({ tabCache: cache });
    }
  }
  if (!clubDetailMountStillCurrent(mountSeq, ctx, slug, tab)) return "";

  const latest = ctx.getState();
  const txForClub = ctx.transactions.filter(
    (t) =>
      String(t.notes || "")
        .toLowerCase()
        .includes(club.slug.toLowerCase()) ||
      String(t.payeeLabel || "")
        .toLowerCase()
        .includes(club.name.toLowerCase()),
  );
  return renderClubTabPanelHtml(tab, club, {
    rates: ctx.rates,
    editingRateId: latest.editingRateId,
    heroIndex: latest.heroImageIndex,
    bookings: cache.bookings,
    transactions: txForClub,
    jobs: cache.jobs,
    promoters: ctx.promoters,
    clubPromoters: cache.clubPromoters,
    accounts: cache.accounts,
  });
}
