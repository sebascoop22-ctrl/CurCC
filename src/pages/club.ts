import { gateAdminUser, gateClubUser } from "../admin/auth";
import {
  decideClubJob,
  issueClubInvite,
  loadClubBySlug,
  loadClubFlyers,
  loadClubJobs,
  loadClubPromoters,
  saveClubFlyer,
  setClubPromoterAccess,
  submitClubEditRevision,
  submitJobDispute,
} from "../admin/clubs";
import {
  listFinancialBookings,
  listFinancialRules,
  submitFinancialConfigChangeRequest,
} from "../admin/financial-tracking";
import { renderStatusBadge } from "../portal/badge";
import { mountDataTable } from "../portal/data-table";
import { getSupabaseClient } from "../lib/supabase";
import type { Club } from "../types";
import "../styles/pages/club.css";

function esc(v: string): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function initClubPortal(): Promise<void> {
  const root = document.getElementById("club-root");
  if (!root) return;
  const supabase = getSupabaseClient();
  if (!supabase) {
    root.innerHTML = `<div class="admin-card"><p>Supabase is not configured.</p></div>`;
    return;
  }

  const [clubGate, adminGate] = await Promise.all([
    gateClubUser(supabase),
    gateAdminUser(supabase),
  ]);
  if (!clubGate.ok && !adminGate.ok) {
    root.innerHTML = `<div class="admin-card"><p>Sign in with a club or admin account to access the club workspace.</p></div>`;
    return;
  }

  const actingAsAdmin = adminGate.ok && !clubGate.ok;
  let clubSlug = clubGate.ok ? clubGate.clubSlug : null;
  let accountRows: Array<{ club_slug: string; role: string; status: string }> = [];
  let adminClubSlugs: string[] = [];
  let flashText = "";
  let flashBad = false;
  let sidebarCollapsed = false;
  let clubProfileFormOpen = false;
  let clubFlyerFormOpen = false;
  let clubView: "overview" | "profile" | "flyers" | "promoters" | "jobs" | "admin_tools" =
    "overview";

  if (actingAsAdmin) {
    const { data } = await supabase
      .from("club_accounts")
      .select("club_slug,role,status")
      .eq("status", "active")
      .order("club_slug", { ascending: true });
    accountRows = Array.isArray(data)
      ? data.map((r) => ({
          club_slug: String((r as { club_slug?: string }).club_slug ?? ""),
          role: String((r as { role?: string }).role ?? ""),
          status: String((r as { status?: string }).status ?? ""),
        }))
      : [];
    const { data: clubsData } = await supabase
      .from("clubs")
      .select("slug")
      .order("slug", { ascending: true });
    adminClubSlugs = Array.isArray(clubsData)
      ? clubsData
          .map((r) => String((r as { slug?: string }).slug ?? "").trim())
          .filter(Boolean)
      : [];
    clubSlug = accountRows[0]?.club_slug ?? adminClubSlugs[0] ?? null;
  }

  const flash = (msg: string, bad = false): void => {
    flashText = msg;
    flashBad = bad;
  };

  const parseLines = (raw: string): string[] =>
    String(raw || "")
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

  const navBlocks = (
    actingAdmin: boolean,
  ): Array<{ heading: string; views: Array<{ id: typeof clubView; label: string }> }> => {
    const blocks: Array<{
      heading: string;
      views: Array<{ id: typeof clubView; label: string }>;
    }> = [
      { heading: "Summary", views: [{ id: "overview", label: "Overview" }] },
      {
        heading: "Content",
        views: [
          { id: "profile", label: "Club profile" },
          { id: "flyers", label: "Flyers & media" },
        ],
      },
      {
        heading: "Operations",
        views: [
          { id: "promoters", label: "Promoter access" },
          { id: "jobs", label: "Jobs & disputes" },
        ],
      },
    ];
    if (actingAdmin) {
      blocks.push({
        heading: "Admin",
        views: [{ id: "admin_tools", label: "Invites & testing" }],
      });
    }
    return blocks;
  };

  const applyCollapsibleFormSections = (scope: ParentNode): void => {
    const blocks = Array.from(
      scope.querySelectorAll<HTMLElement>(".admin-form[data-collapsible='true'], .club-form-grid[data-collapsible='true']"),
    );
    for (const block of blocks) {
      if (block.dataset.collapsibleReady === "1") continue;
      const headings = Array.from(block.querySelectorAll<HTMLElement>(":scope > h4.full"));
      if (!headings.length) {
        block.dataset.collapsibleReady = "1";
        continue;
      }

      for (let i = 0; i < headings.length; i += 1) {
        const heading = headings[i];
        const nextHeading = headings[i + 1] ?? null;
        const details = document.createElement("details");
        details.className = "pp-form-section full";
        details.open = i === 0;

        const summary = document.createElement("summary");
        summary.className = "pp-form-section__summary";
        summary.textContent = heading.textContent?.trim() || `Section ${i + 1}`;
        details.append(summary);

        const body = document.createElement("div");
        body.className = "pp-form-section__body";
        details.append(body);

        let node = heading.nextElementSibling as HTMLElement | null;
        while (node && node !== nextHeading) {
          const nextNode = node.nextElementSibling as HTMLElement | null;
          body.append(node);
          node = nextNode;
        }

        heading.replaceWith(details);
      }
      block.dataset.collapsibleReady = "1";
    }
  };

  const render = async (): Promise<void> => {
    const pickerOptions = actingAsAdmin
      ? (accountRows.length
          ? accountRows
              .map(
                (r) =>
                  `<option value="${esc(r.club_slug)}"${r.club_slug === clubSlug ? " selected" : ""}>${esc(r.club_slug)} (${esc(r.role)})</option>`,
              )
              .join("")
          : adminClubSlugs
              .map(
                (slug) =>
                  `<option value="${esc(slug)}"${slug === clubSlug ? " selected" : ""}>${esc(slug)} (admin preview)</option>`,
              )
              .join(""))
      : "";
    const picker = actingAsAdmin
      ? `<div class="cc-field"><label>Admin club preview</label><select id="club-admin-picker">${pickerOptions}</select></div>`
      : "";

    if (!clubSlug) {
      root.innerHTML = `
        <section class="promoter-main">
          <header class="promoter-main__header">
            <div>
              <h2 class="promoter-main__title">Club workspace</h2>
              <p class="promoter-main__subtitle">No active club account is linked yet.</p>
            </div>
          </header>
          <div class="admin-card admin-form">
            ${picker}
            <p class="admin-note">No active club account yet. Admin preview mode lets you test any existing club directly.</p>
          </div>
        </section>
      `;
      if (actingAsAdmin) {
        root.querySelector("#club-admin-picker")?.addEventListener("change", (e) => {
          clubSlug = String((e.target as HTMLSelectElement).value || "").trim() || null;
          void render();
        });
      }
      return;
    }

    const activeClubSlug = clubSlug;
    const [clubRes, flyerRes, promoterRes, jobsRes, disputeRes] = await Promise.all([
      loadClubBySlug(supabase, activeClubSlug),
      loadClubFlyers(supabase, activeClubSlug),
      loadClubPromoters(supabase, activeClubSlug),
      loadClubJobs(supabase, activeClubSlug),
      supabase
        .from("job_disputes")
        .select("id,status", { count: "exact", head: true })
        .eq("club_slug", activeClubSlug)
        .in("status", ["open", "under_review"]),
    ]);
    const ruleRes = await listFinancialRules(supabase);
    const year = new Date().getFullYear();
    const bookingRes = await listFinancialBookings(supabase, {
      from: `${year}-01-01`,
      to: `${year}-12-31`,
    });
    if (!clubRes.ok) {
      root.innerHTML = `<div class="admin-card"><p class="admin-flash admin-flash--error">${esc(clubRes.message)}</p></div>`;
      return;
    }
    const club = clubRes.row;
    const flyers = flyerRes.ok ? flyerRes.rows : [];
    const promoterRows = promoterRes.ok ? promoterRes.rows : [];
    const jobRows = jobsRes.ok ? jobsRes.rows : [];
    const pendingDisputes = disputeRes.count ?? 0;
    const clubFinancialRule = ruleRes.ok
      ? ruleRes.data.find(
          (r) =>
            r.department === "nightlife" &&
            r.isActive &&
            (r.clubSlug?.toLowerCase() === activeClubSlug.toLowerCase() ||
              r.venueOrServiceName.toLowerCase() === activeClubSlug.toLowerCase() ||
              r.venueOrServiceName.toLowerCase() === String(club.name || "").toLowerCase()),
        ) ?? null
      : null;
    const clubFinancialBookings = bookingRes.ok
      ? bookingRes.data.filter(
          (row) => String(row.clubSlug || "").toLowerCase() === activeClubSlug.toLowerCase(),
        )
      : [];
    const clubPaidFinalProfit = clubFinancialBookings
      .filter((row) => row.paymentStatus === "paid_final")
      .reduce((sum, row) => sum + row.realizedAgencyProfit, 0);

    const sidebarHtml = navBlocks(actingAsAdmin)
      .map(
        (b) => `<div class="club-nav-group">
      <p class="club-nav-group__heading">${esc(b.heading)}</p>
      ${b.views
        .map(
          (v) =>
            `<button type="button" class="club-nav__btn ${clubView === v.id ? "is-active" : ""}" data-club-view="${v.id}">${esc(v.label)}</button>`,
        )
        .join("")}
    </div>`,
      )
      .join("");
    const topFlash = flashText
      ? `<p class="admin-flash ${flashBad ? "admin-flash--error" : ""}">${esc(flashText)}</p>`
      : "";
    const overviewSection = `
      <div class="club-kpis">
        <article><p>Club</p><strong>${esc(club.name || clubSlug)}</strong></article>
        <article><p>Promoters</p><strong>${promoterRows.length}</strong></article>
        <article><p>Jobs linked</p><strong>${jobRows.length}</strong></article>
        <article><p>Open disputes</p><strong>${pendingDisputes}</strong></article>
        <article><p>Finance bookings (YTD)</p><strong>${clubFinancialBookings.length}</strong></article>
        <article><p>Paid-final profit (YTD)</p><strong>£${clubPaidFinalProfit.toFixed(2)}</strong></article>
      </div>
      <p class="admin-note">Use the sidebar to jump between profile, flyers, promoters, jobs/disputes, and club-linked finance controls.</p>
    `;
    const profileSection = `
      ${
        clubProfileFormOpen
          ? `<form class="admin-form club-form-grid" id="club-profile-form" data-collapsible="true">
        <p class="admin-note full">Basic marketing/display fields auto-publish. Tax/payment fields are submitted for admin review.</p>
        <h4 class="full">Core Details</h4>
        <div class="cc-field pp-col-8"><label>Name</label><input name="name" value="${esc(club.name || "")}" /></div>
        <div class="cc-field pp-col-4"><label>Location Tag</label><input name="locationTag" value="${esc(club.locationTag || "")}" /></div>
        <div class="cc-field full"><label>Short description</label><textarea name="shortDescription">${esc(club.shortDescription || "")}</textarea></div>
        <div class="cc-field full"><label>Long description</label><textarea name="longDescription">${esc(club.longDescription || "")}</textarea></div>
        <div class="cc-field pp-col-8"><label>Website URL</label><input name="website" value="${esc(club.website || "")}" /></div>
        <div class="cc-field pp-col-4"><label>Minimum Spend</label><input name="minSpend" value="${esc(club.minSpend || "")}" /></div>
        <div class="cc-field full"><label>Known For (one per line)</label><textarea name="knownFor">${esc((club.knownFor || []).join("\n"))}</textarea></div>
        <h4 class="full">Payment & Tax (Review Required)</h4>
        <div class="cc-field pp-col-4"><label>Payment method</label><input name="paymentMethod" value="${esc(club.paymentDetails?.method || "")}" /></div>
        <div class="cc-field pp-col-8"><label>Tax registered name</label><input name="taxRegisteredName" value="${esc(club.taxDetails?.registeredName || "")}" /></div>
        <h4 class="full">Financial Rates (Club Tracking)</h4>
        ${
          clubFinancialRule
            ? `<div class="cc-field pp-col-4"><label>Male ratio</label><input name="clubMaleRate" type="number" step="0.01" value="${clubFinancialRule.maleRate}" /></div>
        <div class="cc-field pp-col-4"><label>Female ratio</label><input name="clubFemaleRate" type="number" step="0.01" value="${clubFinancialRule.femaleRate}" /></div>
        <div class="cc-field pp-col-4"><label>Base rate (£)</label><input name="clubBaseRate" type="number" step="0.01" value="${clubFinancialRule.baseRate}" /></div>
        <p class="admin-note full">Current rule: ${esc(clubFinancialRule.venueOrServiceName)} (${esc(clubFinancialRule.logicType)}). Base rate is charged per guest; ratio values are for planning/tracking and changes are sent to admin approvals.</p>`
            : `<p class="admin-note full">No active nightlife financial rule is linked to this club yet. Ask admin to create one first.</p>`
        }
        <div class="admin-actions full">
          <button type="button" class="cc-btn cc-btn--gold" data-club-save="autopublish">Save Changes</button>
          <button type="button" class="cc-btn cc-btn--ghost" data-club-save="review">Submit for Review</button>
          ${
            clubFinancialRule
              ? `<button type="button" class="cc-btn cc-btn--ghost" data-club-financial-request="${esc(clubFinancialRule.id)}">Submit rate update for approval</button>`
              : ""
          }
        </div>
      </form>`
          : `<p class="admin-note">Profile form hidden until you click edit/new.</p><button type="button" class="pp-btn pp-btn--primary" id="club-open-profile-form">Open Form</button>`
      }
    `;
    const flyersSection = `
      <div id="club-flyers-table"></div>
      <hr />
      ${
        clubFlyerFormOpen
          ? `<form class="admin-form club-form-grid" id="club-flyer-form" data-collapsible="true">
        <input type="hidden" name="id" value="" />
        <h4 class="full">Event Details</h4>
        <div class="cc-field pp-col-4"><label>Date</label><input type="date" name="eventDate" required /></div>
        <div class="cc-field pp-col-8"><label>Title</label><input name="title" /></div>
        <div class="cc-field full"><label>Description</label><textarea name="description"></textarea></div>
        <h4 class="full">Media & publishing</h4>
        <div class="cc-field pp-col-6"><label>Image URL</label><input name="imageUrl" /></div>
        <div class="cc-field pp-col-6"><label>Storage Path</label><input name="imagePath" /></div>
        <div class="cc-field pp-col-4"><label>Display Order</label><input type="number" name="sortOrder" value="0" /></div>
        <div class="cc-field pp-col-4"><label>Publish Status</label><select name="isActive"><option value="true">Active</option><option value="false">Inactive</option></select></div>
        <div class="admin-actions full"><button type="button" class="cc-btn cc-btn--gold" data-save-flyer>Save Changes</button></div>
      </form>`
          : `<p class="admin-note">Flyer form hidden until you click Add new or Edit.</p><button type="button" class="pp-btn pp-btn--primary" id="club-open-flyer-form">Open Form</button>`
      }
    `;
    const promotersSection = `
      <div id="club-promoters-table"></div>
      <div class="cc-field" style="margin-top:0.8rem"><label>Access note</label><textarea id="club-promoter-note" rows="3" placeholder="Optional note when removing/restoring access"></textarea></div>
    `;
    const jobsSection = `
      <div id="club-jobs-table"></div>
      <div class="cc-field" style="margin-top:0.8rem"><label>Decision/dispute note</label><textarea id="club-job-note" rows="3" placeholder="Optional note for approve/deny/dispute"></textarea></div>
    `;
    const adminToolsSection = actingAsAdmin
      ? `
      <div class="admin-form club-form-grid">
        <div class="cc-field"><label>Email</label><input id="club-invite-email" type="email" placeholder="club@domain.com" /></div>
        <div class="cc-field"><label>Role</label><select id="club-invite-role"><option value="owner">owner</option><option value="manager">manager</option><option value="editor">editor</option></select></div>
        <div class="cc-field full"><label>Notes (Internal)</label><input id="club-invite-notes" /></div>
        <div class="admin-actions full"><button type="button" class="cc-btn cc-btn--gold" id="club-invite-issue">Generate Invite Code</button></div>
        <p class="admin-note full" id="club-invite-code"></p>
      </div>
      `
      : `<p class="admin-note">Admin-only tools.</p>`;
    const sectionBody =
      clubView === "overview"
        ? overviewSection
        : clubView === "profile"
          ? profileSection
          : clubView === "flyers"
            ? flyersSection
            : clubView === "promoters"
              ? promotersSection
              : clubView === "jobs"
                ? jobsSection
                : adminToolsSection;
    const sectionTitle =
      clubView === "overview"
        ? "Overview"
        : clubView === "profile"
          ? "Club profile"
          : clubView === "flyers"
            ? "Flyers & media"
            : clubView === "promoters"
              ? "Promoter access"
              : clubView === "jobs"
                ? "Jobs & disputes"
                : "Invites & testing";
    root.innerHTML = `
      <section class="club-shell ${sidebarCollapsed ? "is-collapsed" : ""}">
        <aside class="club-sidebar">
          <div class="club-sidebar__brand">
            <p class="club-sidebar__eyebrow">Portal</p>
            <p class="club-sidebar__title">Club workspace</p>
          </div>
          ${picker}
          <nav class="club-nav">${sidebarHtml}</nav>
        </aside>
        <div class="club-main">
          <header class="club-main__header">
            <button type="button" class="club-main__menu-btn" id="club-sidebar-toggle" aria-expanded="${sidebarCollapsed ? "false" : "true"}">
              ${sidebarCollapsed ? "Open menu" : "Collapse menu"}
            </button>
            <div>
              <h2 class="club-main__title">${esc(sectionTitle)}</h2>
              <p class="club-main__subtitle">Managing <strong>${esc(club.name || clubSlug)}</strong></p>
            </div>
          </header>
          <div class="club-main__content admin-card">
            ${topFlash}
            ${sectionBody}
          </div>
        </div>
      </section>
    `;
    applyCollapsibleFormSections(root);
    const mountFormModal = (
      formSelector: string,
      title: string,
      onClose: () => void,
    ): void => {
      const form = root.querySelector(formSelector) as HTMLElement | null;
      if (!form || form.closest(".pp-modal")) return;
      const host = document.createElement("div");
      host.className = "pp-modal-host finx-modal-host";
      host.innerHTML = `<div class="pp-modal__overlay">
        <div class="pp-modal finx-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="pp-modal__header">
            <h4 class="pp-modal__title">${esc(title)}</h4>
            <button type="button" class="pp-modal__close" aria-label="Close">×</button>
          </div>
          <div class="pp-modal__body"></div>
        </div>
      </div>`;
      (host.querySelector(".pp-modal__body") as HTMLElement | null)?.append(form);
      host.querySelector(".pp-modal__close")?.addEventListener("click", onClose);
      host.querySelector(".pp-modal__overlay")?.addEventListener("click", (ev) => {
        if (ev.target === ev.currentTarget) onClose();
      });
      root.append(host);
    };
    if (clubView === "profile" && clubProfileFormOpen) {
      mountFormModal("#club-profile-form", "Club profile", () => {
        clubProfileFormOpen = false;
        void render();
      });
    }
    if (clubView === "flyers" && clubFlyerFormOpen) {
      mountFormModal("#club-flyer-form", "Flyer editor", () => {
        clubFlyerFormOpen = false;
        void render();
      });
    }

    if (actingAsAdmin) {
      root.querySelector("#club-admin-picker")?.addEventListener("change", (e) => {
        clubSlug = String((e.target as HTMLSelectElement).value || "").trim() || null;
        flashText = "";
        void render();
      });
    }

    const flyersTableHost = root.querySelector("#club-flyers-table") as HTMLElement | null;
    if (flyersTableHost) {
      mountDataTable(flyersTableHost, {
        id: "club-flyers",
        rows: flyers,
        columns: [
          { key: "date", label: "Date", sortable: true, accessor: (f) => f.eventDate },
          {
            key: "title",
            label: "Title",
            sortable: true,
            accessor: (f) => f.title || "Untitled",
            render: (f) => esc(f.title || "Untitled"),
          },
          { key: "order", label: "Order", sortable: true, accessor: (f) => f.sortOrder },
          {
            key: "status",
            label: "Status",
            sortable: true,
            accessor: (f) => (f.isActive ? "active" : "inactive"),
            render: (f) => renderStatusBadge(f.isActive ? "active" : "inactive"),
          },
          {
            key: "action",
            label: "Action",
            render: (f) =>
              `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-flyer-edit="${esc(f.id)}">Edit</button>`,
          },
        ],
        empty: { title: "No flyers yet." },
        paginated: false,
      });
    }

    const promotersTableHost = root.querySelector("#club-promoters-table") as HTMLElement | null;
    if (promotersTableHost) {
      mountDataTable(promotersTableHost, {
        id: "club-promoters",
        rows: promoterRows,
        columns: [
          {
            key: "name",
            label: "Promoter",
            sortable: true,
            accessor: (p) => p.displayName,
          },
          {
            key: "days",
            label: "Days",
            accessor: (p) => p.weekdays.join("|") || "—",
            render: (p) => esc(p.weekdays.join("|") || "—"),
          },
          {
            key: "status",
            label: "Status",
            sortable: true,
            accessor: (p) => p.status,
            render: (p) => renderStatusBadge(p.status),
          },
          {
            key: "notes",
            label: "Notes",
            accessor: (p) => p.notes || "—",
            render: (p) => esc(p.notes || "—"),
          },
          {
            key: "access",
            label: "Access",
            render: (p) =>
              `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-promoter-access="${esc(p.preferenceId)}" data-allow="false">Remove</button>
               <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-promoter-access="${esc(p.preferenceId)}" data-allow="true">Restore</button>`,
          },
        ],
        empty: { title: "No promoter preference records for this club yet." },
        paginated: false,
      });
    }

    const jobsTableHost = root.querySelector("#club-jobs-table") as HTMLElement | null;
    if (jobsTableHost) {
      mountDataTable(jobsTableHost, {
        id: "club-jobs",
        rows: jobRows,
        columns: [
          { key: "date", label: "Date", sortable: true, accessor: (j) => j.jobDate },
          { key: "service", label: "Service", sortable: true, accessor: (j) => j.service },
          {
            key: "status",
            label: "Status",
            sortable: true,
            accessor: (j) => j.status,
            render: (j) => renderStatusBadge(j.status),
          },
          { key: "guests", label: "Guests", sortable: true, accessor: (j) => j.guestsCount },
          { key: "client", label: "Client", accessor: (j) => j.clientName || "—", render: (j) => esc(j.clientName || "—") },
          {
            key: "decision",
            label: "Decision",
            render: (j) =>
              `<button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-job-action="${esc(j.id)}" data-decision="approve">Approve</button>
               <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-job-action="${esc(j.id)}" data-decision="deny">Deny</button>
               <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-job-dispute="${esc(j.id)}">Dispute</button>`,
          },
        ],
        empty: { title: "No jobs mapped to this club." },
        paginated: false,
      });
    }

    root.querySelectorAll("[data-club-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = String((btn as HTMLElement).getAttribute("data-club-view") || "").trim();
        if (
          next !== "overview" &&
          next !== "profile" &&
          next !== "flyers" &&
          next !== "promoters" &&
          next !== "jobs" &&
          next !== "admin_tools"
        ) {
          return;
        }
        clubView = next;
        void render();
      });
    });
    root.querySelector("#club-open-profile-form")?.addEventListener("click", () => {
      clubProfileFormOpen = true;
      void render();
    });
    root.querySelector("#club-open-flyer-form")?.addEventListener("click", () => {
      clubFlyerFormOpen = true;
      void render();
    });
    root.querySelector("#club-sidebar-toggle")?.addEventListener("click", () => {
      sidebarCollapsed = !sidebarCollapsed;
      void render();
    });

    const getNote = (): string =>
      String((root.querySelector("#club-job-note") as HTMLTextAreaElement | null)?.value || "").trim();
    const getPromoterNote = (): string =>
      String((root.querySelector("#club-promoter-note") as HTMLTextAreaElement | null)?.value || "").trim();

    root.querySelectorAll("[data-promoter-access]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = String((btn as HTMLElement).getAttribute("data-promoter-access") || "").trim();
        const allow = String((btn as HTMLElement).getAttribute("data-allow") || "") === "true";
        if (!id) return;
        void (async () => {
          const res = await setClubPromoterAccess(supabase, id, allow, getPromoterNote());
          flash(res.ok ? `Promoter access ${allow ? "restored" : "removed"}.` : res.message, !res.ok);
          await render();
        })();
      });
    });

    root.querySelectorAll("[data-job-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const jobId = String((btn as HTMLElement).getAttribute("data-job-action") || "").trim();
        const decision = String((btn as HTMLElement).getAttribute("data-decision") || "").trim() as "approve" | "deny";
        if (!jobId || (decision !== "approve" && decision !== "deny")) return;
        void (async () => {
          const res = await decideClubJob(supabase, jobId, decision, getNote());
          flash(res.ok ? `Job ${decision}d.` : res.message, !res.ok);
          await render();
        })();
      });
    });

    root.querySelectorAll("[data-job-dispute]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const jobId = String((btn as HTMLElement).getAttribute("data-job-dispute") || "").trim();
        if (!jobId) return;
        void (async () => {
          const res = await submitJobDispute(supabase, {
            promoterJobId: jobId,
            reasonCode: "club_dispute",
            description: getNote() || "Club requested dispute review.",
          });
          flash(res.ok ? "Dispute raised." : res.message, !res.ok);
          await render();
        })();
      });
    });

    root.querySelector("[data-club-save='autopublish']")?.addEventListener("click", () => {
      const form = root.querySelector("#club-profile-form") as HTMLFormElement | null;
      if (!form) return;
      const fd = new FormData(form);
      const payload: Club = {
        ...club,
        name: String(fd.get("name") || "").trim(),
        locationTag: String(fd.get("locationTag") || "").trim(),
        shortDescription: String(fd.get("shortDescription") || "").trim(),
        longDescription: String(fd.get("longDescription") || "").trim(),
        website: String(fd.get("website") || "").trim(),
        minSpend: String(fd.get("minSpend") || "").trim(),
        knownFor: parseLines(String(fd.get("knownFor") || "")),
      };
      void (async () => {
        const { error } = await supabase
          .from("clubs")
          .update({
            name: payload.name.trim() || club.name,
            payload,
            updated_at: new Date().toISOString(),
          })
          .eq("slug", activeClubSlug);
        flash(error ? error.message : "Club display fields updated.", Boolean(error));
        await render();
      })();
    });

    root.querySelector("[data-club-save='review']")?.addEventListener("click", () => {
      const form = root.querySelector("#club-profile-form") as HTMLFormElement | null;
      if (!form) return;
      const fd = new FormData(form);
      void (async () => {
        const res = await submitClubEditRevision(supabase, {
          clubSlug: activeClubSlug,
          targetType: "club_payload",
          payload: {
            ...club,
            paymentDetails: {
              ...(club.paymentDetails ?? {}),
              method: String(fd.get("paymentMethod") || "").trim(),
            },
            taxDetails: {
              ...(club.taxDetails ?? {}),
              registeredName: String(fd.get("taxRegisteredName") || "").trim(),
            },
          },
        });
        flash(res.ok ? "Sensitive club edits submitted for admin review." : res.message, !res.ok);
        await render();
      })();
    });
    root.querySelector("[data-club-financial-request]")?.addEventListener("click", () => {
      const form = root.querySelector("#club-profile-form") as HTMLFormElement | null;
      const targetId = String(
        (root.querySelector("[data-club-financial-request]") as HTMLElement | null)?.getAttribute(
          "data-club-financial-request",
        ) || "",
      ).trim();
      if (!form || !targetId) return;
      const fd = new FormData(form);
      void (async () => {
        const res = await submitFinancialConfigChangeRequest(supabase, {
          targetType: "financial_rule",
          targetId,
          payload: {
            male_rate: Number(fd.get("clubMaleRate") || 0) || 0,
            female_rate: Number(fd.get("clubFemaleRate") || 0) || 0,
            base_rate: Number(fd.get("clubBaseRate") || 0) || 0,
          },
        });
        flash(res.ok ? "Rate update submitted for admin approval." : res.message, !res.ok);
        await render();
      })();
    });

    root.querySelector("[data-save-flyer]")?.addEventListener("click", () => {
      const form = root.querySelector("#club-flyer-form") as HTMLFormElement | null;
      if (!form) return;
      const fd = new FormData(form);
      void (async () => {
        const res = await saveClubFlyer(supabase, {
          id: String(fd.get("id") || "").trim() || undefined,
          clubSlug: activeClubSlug,
          eventDate: String(fd.get("eventDate") || "").trim(),
          title: String(fd.get("title") || "").trim(),
          description: String(fd.get("description") || "").trim(),
          imagePath: String(fd.get("imagePath") || "").trim(),
          imageUrl: String(fd.get("imageUrl") || "").trim(),
          sortOrder: Number(fd.get("sortOrder") || 0) || 0,
          isActive: String(fd.get("isActive") || "true") === "true",
        });
        flash(res.ok ? "Flyer saved." : res.message, !res.ok);
        await render();
      })();
    });

    root.querySelectorAll("[data-flyer-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        clubFlyerFormOpen = true;
        const id = String((btn as HTMLElement).getAttribute("data-flyer-edit") || "").trim();
        if (!id) return;
        const row = flyers.find((f) => f.id === id);
        const form = root.querySelector("#club-flyer-form") as HTMLFormElement | null;
        if (!row || !form) return;
        (form.elements.namedItem("id") as HTMLInputElement).value = row.id;
        (form.elements.namedItem("eventDate") as HTMLInputElement).value = row.eventDate;
        (form.elements.namedItem("title") as HTMLInputElement).value = row.title;
        (form.elements.namedItem("description") as HTMLTextAreaElement).value = row.description;
        (form.elements.namedItem("imagePath") as HTMLInputElement).value = row.imagePath;
        (form.elements.namedItem("imageUrl") as HTMLInputElement).value = row.imageUrl;
        (form.elements.namedItem("sortOrder") as HTMLInputElement).value = String(row.sortOrder);
        (form.elements.namedItem("isActive") as HTMLSelectElement).value = row.isActive ? "true" : "false";
      });
    });

    if (actingAsAdmin) {
      root.querySelector("#club-invite-issue")?.addEventListener("click", () => {
        const email = String(
          (root.querySelector("#club-invite-email") as HTMLInputElement | null)?.value || "",
        ).trim();
        const role = String(
          (root.querySelector("#club-invite-role") as HTMLSelectElement | null)?.value || "owner",
        ) as "owner" | "manager" | "editor";
        const notes = String(
          (root.querySelector("#club-invite-notes") as HTMLInputElement | null)?.value || "",
        ).trim();
        void (async () => {
          const res = await issueClubInvite(supabase, {
            clubSlug: activeClubSlug,
            inviteEmail: email,
            role,
            notes,
          });
          const out = root.querySelector("#club-invite-code") as HTMLElement | null;
          if (!out) return;
          out.textContent = res.ok ? `Invite code: ${res.row.inviteCode}` : res.message;
        })();
      });
    }
  };

  await render();
}
