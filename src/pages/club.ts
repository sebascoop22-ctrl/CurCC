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
    if (!clubRes.ok) {
      root.innerHTML = `<div class="admin-card"><p class="admin-flash admin-flash--error">${esc(clubRes.message)}</p></div>`;
      return;
    }
    const club = clubRes.row;
    const flyers = flyerRes.ok ? flyerRes.rows : [];
    const promoterRows = promoterRes.ok ? promoterRes.rows : [];
    const jobRows = jobsRes.ok ? jobsRes.rows : [];
    const pendingDisputes = disputeRes.count ?? 0;

    const promoterTableRows = promoterRows.length
      ? promoterRows
          .map(
            (p) => `<tr>
          <td>${esc(p.displayName)}</td>
          <td>${esc(p.weekdays.join("|") || "—")}</td>
          <td>${esc(p.status)}</td>
          <td>${esc(p.notes || "—")}</td>
          <td>
            <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-promoter-access="${esc(p.preferenceId)}" data-allow="false">Remove</button>
            <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-promoter-access="${esc(p.preferenceId)}" data-allow="true">Restore</button>
          </td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="5">No promoter preference records for this club yet.</td></tr>`;

    const jobRowsHtml = jobRows.length
      ? jobRows
          .map(
            (j) => `<tr>
          <td>${esc(j.jobDate)}</td>
          <td>${esc(j.service)}</td>
          <td>${esc(j.status)}</td>
          <td>${j.guestsCount}</td>
          <td>${esc(j.clientName || "—")}</td>
          <td>
            <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-job-action="${esc(j.id)}" data-decision="approve">Approve</button>
            <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-job-action="${esc(j.id)}" data-decision="deny">Deny</button>
            <button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-job-dispute="${esc(j.id)}">Dispute</button>
          </td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="6">No jobs mapped to this club.</td></tr>`;

    const flyerRows = flyers.length
      ? flyers
          .map(
            (f) => `<tr>
          <td>${esc(f.eventDate)}</td>
          <td>${esc(f.title || "Untitled")}</td>
          <td>${f.sortOrder}</td>
          <td>${f.isActive ? "active" : "inactive"}</td>
          <td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-flyer-edit="${esc(f.id)}">Load</button></td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="5">No flyers yet.</td></tr>`;

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
      </div>
      <p class="admin-note">Use the sidebar to jump between profile, flyers, promoters, and jobs/disputes management.</p>
    `;
    const profileSection = `
      <form class="admin-form club-form-grid" id="club-profile-form">
        <p class="admin-note full">Basic marketing/display fields auto-publish. Tax/payment fields are submitted for admin review.</p>
        <div class="cc-field"><label>Name</label><input name="name" value="${esc(club.name || "")}" /></div>
        <div class="cc-field"><label>Location tag</label><input name="locationTag" value="${esc(club.locationTag || "")}" /></div>
        <div class="cc-field full"><label>Short description</label><textarea name="shortDescription">${esc(club.shortDescription || "")}</textarea></div>
        <div class="cc-field full"><label>Long description</label><textarea name="longDescription">${esc(club.longDescription || "")}</textarea></div>
        <div class="cc-field"><label>Website</label><input name="website" value="${esc(club.website || "")}" /></div>
        <div class="cc-field"><label>Min spend</label><input name="minSpend" value="${esc(club.minSpend || "")}" /></div>
        <div class="cc-field full"><label>Known for (one per line)</label><textarea name="knownFor">${esc((club.knownFor || []).join("\n"))}</textarea></div>
        <h4 class="full">Sensitive (admin review required)</h4>
        <div class="cc-field"><label>Payment method</label><input name="paymentMethod" value="${esc(club.paymentDetails?.method || "")}" /></div>
        <div class="cc-field"><label>Tax registered name</label><input name="taxRegisteredName" value="${esc(club.taxDetails?.registeredName || "")}" /></div>
        <div class="admin-actions full">
          <button type="button" class="cc-btn cc-btn--gold" data-club-save="autopublish">Save display fields</button>
          <button type="button" class="cc-btn cc-btn--ghost" data-club-save="review">Submit sensitive edits for review</button>
        </div>
      </form>
    `;
    const flyersSection = `
      <div class="club-table-wrap"><table class="admin-list-table"><thead><tr><th>Date</th><th>Title</th><th>Order</th><th>Status</th><th></th></tr></thead><tbody>${flyerRows}</tbody></table></div>
      <hr />
      <form class="admin-form club-form-grid" id="club-flyer-form">
        <input type="hidden" name="id" value="" />
        <div class="cc-field"><label>Date</label><input type="date" name="eventDate" required /></div>
        <div class="cc-field"><label>Title</label><input name="title" /></div>
        <div class="cc-field full"><label>Description</label><textarea name="description"></textarea></div>
        <div class="cc-field"><label>Image URL</label><input name="imageUrl" /></div>
        <div class="cc-field"><label>Image path</label><input name="imagePath" /></div>
        <div class="cc-field"><label>Sort order</label><input type="number" name="sortOrder" value="0" /></div>
        <div class="cc-field"><label>Status</label><select name="isActive"><option value="true">active</option><option value="false">inactive</option></select></div>
        <div class="admin-actions full"><button type="button" class="cc-btn cc-btn--gold" data-save-flyer>Save flyer</button></div>
      </form>
    `;
    const promotersSection = `
      <div class="club-table-wrap"><table class="admin-list-table"><thead><tr><th>Promoter</th><th>Days</th><th>Status</th><th>Notes</th><th>Access</th></tr></thead><tbody>${promoterTableRows}</tbody></table></div>
      <div class="cc-field" style="margin-top:0.8rem"><label>Access note</label><textarea id="club-promoter-note" rows="3" placeholder="Optional note when removing/restoring access"></textarea></div>
    `;
    const jobsSection = `
      <div class="club-table-wrap"><table class="admin-list-table"><thead><tr><th>Date</th><th>Service</th><th>Status</th><th>Guests</th><th>Client</th><th>Decision</th></tr></thead><tbody>${jobRowsHtml}</tbody></table></div>
      <div class="cc-field" style="margin-top:0.8rem"><label>Decision/dispute note</label><textarea id="club-job-note" rows="3" placeholder="Optional note for approve/deny/dispute"></textarea></div>
    `;
    const adminToolsSection = actingAsAdmin
      ? `
      <div class="admin-form club-form-grid">
        <div class="cc-field"><label>Email</label><input id="club-invite-email" type="email" placeholder="club@domain.com" /></div>
        <div class="cc-field"><label>Role</label><select id="club-invite-role"><option value="owner">owner</option><option value="manager">manager</option><option value="editor">editor</option></select></div>
        <div class="cc-field full"><label>Notes</label><input id="club-invite-notes" /></div>
        <div class="admin-actions full"><button type="button" class="cc-btn cc-btn--gold" id="club-invite-issue">Generate invite code</button></div>
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

    if (actingAsAdmin) {
      root.querySelector("#club-admin-picker")?.addEventListener("change", (e) => {
        clubSlug = String((e.target as HTMLSelectElement).value || "").trim() || null;
        flashText = "";
        void render();
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
