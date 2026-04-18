import { gatePromoterUser, signInPromoter, signOutAdmin } from "../admin/auth";
import {
  loadPromoterAvailability,
  loadPromoterByUser,
  loadPromoterInvoices,
  loadPromoterJobs,
  loadPromoterPreferences,
  savePromoterAvailability,
  savePromoterPreference,
  submitPromoterRevision,
} from "../admin/promoters";
import { fetchClubs } from "../data/fetch-data";
import { notifyPromoterRequestSubmitted } from "../lib/promoter-request-edge";
import { getSupabaseClient } from "../lib/supabase";
import type {
  Club,
  PromoterAvailabilitySlot,
  PromoterClubPreference,
  PromoterInvoice,
  PromoterJob,
  PromoterProfile,
} from "../types";
import "../styles/pages/promoter.css";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type PromoterView = "overview" | "profile" | "preferences" | "jobs" | "invoices";

const PROMOTER_VIEW_HEADINGS: Record<
  PromoterView,
  { title: string; subtitle: string }
> = {
  overview: {
    title: "Overview",
    subtitle:
      "Snapshot of your approval status, completed work, and earnings from tracked jobs.",
  },
  profile: {
    title: "My profile",
    subtitle:
      "Update how you appear to the team: bio text, profile photo (upload or paste URL), then submit for admin approval.",
  },
  preferences: {
    title: "Work preferences",
    subtitle:
      "Set when you are available each week and tell us which clubs and nights you prefer.",
  },
  jobs: {
    title: "Jobs",
    subtitle:
      "Upcoming assignments, completed shifts, and cancelled work — same information your coordinator sees.",
  },
  invoices: {
    title: "Invoices",
    subtitle: "Period statements generated for your account.",
  },
};

function esc(v: string): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function parseClubDays(raw: string): string[] {
  return raw
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

function money(v: number): string {
  return `£${v.toFixed(2)}`;
}

/** Public bucket shared with admin catalog / flyers (`src/pages/admin.ts`). */
const PROMOTER_PROFILE_IMAGE_BUCKET = "club-flyers";

function safePromoterProfileFileSegment(fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${new Date().toISOString().slice(0, 10)}/${Date.now()}_${safe}`;
}

function jobsTableRows(
  rows: PromoterJob[],
  emptyColspan: number,
  emptyMessage: string,
): string {
  if (!rows.length) {
    return `<tr><td colspan="${emptyColspan}">${esc(emptyMessage)}</td></tr>`;
  }
  return rows
    .map(
      (j) =>
        `<tr><td>${esc(j.jobDate)}</td><td>${esc(j.clubSlug ?? "—")}</td><td>${esc(j.service)}</td><td>${esc(j.status)}</td><td>${j.guestsCount}</td><td>${money(j.shiftFee)} + ${money(j.guestlistFee)}/guest</td></tr>`,
    )
    .join("");
}

export async function initPromoterPortal(): Promise<void> {
  const root = document.getElementById("promoter-root");
  if (!root) return;
  const supabase = getSupabaseClient();
  if (!supabase) {
    root.innerHTML = `<div class="admin-card"><p>Supabase is not configured.</p></div>`;
    return;
  }

  let profile: PromoterProfile | null = null;
  let availability: PromoterAvailabilitySlot[] = [];
  let preferences: PromoterClubPreference[] = [];
  let jobs: PromoterJob[] = [];
  let invoices: PromoterInvoice[] = [];
  let promoterView: PromoterView = "overview";
  const clubs = await fetchClubs().catch(() => [] as Club[]);

  function flash(msg: string, bad = false): void {
    const el = root.querySelector("#promoter-flash");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("admin-flash--error", bad);
    setTimeout(() => {
      if (el.textContent === msg) {
        el.textContent = "";
        el.classList.remove("admin-flash--error");
      }
    }, 3500);
  }

  async function reloadPromoterData(userId: string): Promise<void> {
    const p = await loadPromoterByUser(supabase, userId);
    if (!p.ok || !p.row) {
      profile = null;
      availability = [];
      preferences = [];
      jobs = [];
      invoices = [];
      return;
    }
    profile = p.row;
    const [a, pref, j, inv] = await Promise.all([
      loadPromoterAvailability(supabase, p.row.id),
      loadPromoterPreferences(supabase, p.row.id),
      loadPromoterJobs(supabase, p.row.id),
      loadPromoterInvoices(supabase, p.row.id),
    ]);
    availability = a.ok ? a.rows : [];
    preferences = pref.ok ? pref.rows : [];
    jobs = j.ok ? j.rows : [];
    invoices = inv.ok ? inv.rows : [];
  }

  function renderAuth(): void {
    root.innerHTML = `
      <div class="admin-card">
        <div class="promoter-auth-grid">
          <form id="promoter-login-form" class="admin-form">
            <h3>Sign in</h3>
            <p class="promoter-auth-hint">Use the email and password you received when your access request was approved.</p>
            <div class="cc-field full"><label>Email</label><input name="email" type="email" required autocomplete="username" /></div>
            <div class="cc-field full"><label>Password</label><input name="password" type="password" required autocomplete="current-password" /></div>
            <button class="cc-btn cc-btn--gold" type="submit">Sign in</button>
          </form>
          <form id="promoter-access-request-form" class="admin-form">
            <h3>Request promoter access</h3>
            <p class="promoter-auth-hint">Submit your name and email. We will confirm by email and notify our team. If approved, you will receive login details to complete your profile.</p>
            <div class="cc-field full"><label>Full name</label><input name="fullName" type="text" required autocomplete="name" /></div>
            <div class="cc-field full"><label>Email</label><input name="email" type="email" required autocomplete="email" /></div>
            <button class="cc-btn cc-btn--ghost" type="submit">Submit request</button>
          </form>
        </div>
        <div class="admin-flash" id="promoter-flash"></div>
      </div>
    `;
    root.querySelector("#promoter-login-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const email = String(fd.get("email") || "");
      const password = String(fd.get("password") || "");
      void (async () => {
        const r = await signInPromoter(supabase, email, password);
        if (!r.ok) {
          flash(r.message, true);
          return;
        }
        promoterView = "overview";
        await loadAndRender();
      })();
    });
    root.querySelector("#promoter-access-request-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      const fullName = String(fd.get("fullName") || "").trim();
      const email = String(fd.get("email") || "").trim().toLowerCase();
      void (async () => {
        if (!fullName || !email) {
          flash("Please enter your name and email.", true);
          return;
        }
        const id = crypto.randomUUID();
        const { error } = await supabase.from("promoter_signup_requests").insert({
          id,
          full_name: fullName,
          email,
          status: "pending",
        });
        if (error) {
          flash(error.message, true);
          return;
        }
        const key =
          (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
          (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
          "";
        let emailed = false;
        if (key) {
          const n = await notifyPromoterRequestSubmitted(key, id);
          emailed = n.ok;
        }
        flash(
          emailed
            ? "Request received. Check your email for a confirmation message. We will be in touch after review."
            : "Request received. We could not send the confirmation email (deploy the notify-promoter-request Edge Function and set RESEND_API_KEY in function secrets, or check the browser Network tab). Your request is still saved for admin review.",
          !emailed,
        );
        (e.target as HTMLFormElement).reset();
      })();
    });
  }

  function renderWorkspaceBody(): string {
    if (!profile) return "";
    const v = promoterView;

    if (v === "overview") {
      const jobsDone = jobs.filter((j) => j.status === "completed");
      const totalGuests = jobsDone.reduce((acc, j) => acc + j.guestsCount, 0);
      const totalEarned = jobsDone.reduce(
        (acc, j) => acc + j.shiftFee + j.guestlistFee * j.guestsCount,
        0,
      );
      const upcoming = jobs.filter((j) => j.status === "assigned").length;
      const approvalBadge =
        profile.approvalStatus === "approved"
          ? "Approved"
          : profile.approvalStatus === "rejected"
            ? "Rejected"
            : "Pending";
      return `
        <p class="promoter-status">Signed in as <strong>${esc(profile.displayName || "Promoter")}</strong>. Approval: <strong>${esc(approvalBadge)}</strong>${profile.approvalNotes ? ` — ${esc(profile.approvalNotes)}` : ""}</p>
        <div class="promoter-panel">
          <p class="promoter-panel__title">At a glance</p>
          <div class="promoter-kpi-grid">
            <article><p>Upcoming jobs</p><strong>${upcoming}</strong></article>
            <article><p>Completed jobs</p><strong>${jobsDone.length}</strong></article>
            <article><p>Guestlist guests (completed)</p><strong>${totalGuests}</strong></article>
            <article><p>Earnings (tracked)</p><strong>${money(totalEarned)}</strong></article>
          </div>
        </div>
        <div class="promoter-panel">
          <p class="promoter-panel__title">Quick links</p>
          <p class="promoter-main__subtitle" style="margin:0">Use the sidebar to edit your profile, set availability and club preferences, review jobs by status, or open invoices.</p>
        </div>`;
    }

    if (v === "profile") {
      const imgUrl = profile.profileImageUrl?.trim() ?? "";
      const previewSrc = imgUrl ? ` src="${esc(imgUrl)}"` : "";
      return `
        <div class="promoter-panel">
          <section class="admin-form">
            <h4 class="full">Profile revision</h4>
            <div class="cc-field"><label>Display name</label><input id="p-display-name" value="${esc(profile.displayName)}" /></div>
            <div class="cc-field full"><label>Bio</label><textarea id="p-bio" rows="6" placeholder="Experience, venues, languages…">${esc(profile.bio)}</textarea></div>
            <div class="cc-field full">
              <label for="p-profile-image-file">Profile photo</label>
              <div class="promoter-profile-upload">
                <input id="p-profile-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
                <button type="button" class="cc-btn cc-btn--ghost" id="p-profile-image-upload">Upload photo</button>
              </div>
              <p class="promoter-upload-hint">JPEG, PNG, WebP or GIF (about 6MB max). Fills the URL field below — still submit the form for admin approval.</p>
              <div id="p-image-preview-wrap" class="promoter-image-preview-wrap${imgUrl ? "" : " is-empty"}">
                <img id="p-image-preview" class="promoter-image-preview__img"${previewSrc} alt="Profile preview" referrerpolicy="no-referrer"${imgUrl ? "" : " hidden"} />
              </div>
            </div>
            <div class="cc-field full"><label>Image URL</label><input id="p-image" value="${esc(profile.profileImageUrl)}" placeholder="https://… or upload above" /></div>
            <div class="admin-actions full">
              <button class="cc-btn cc-btn--gold" id="p-save-profile" type="button">Submit for approval</button>
            </div>
          </section>
        </div>`;
    }

    if (v === "preferences") {
      const availabilityBlock = WEEKDAY_LABELS.map((label, idx) => {
        const row = availability.find((a) => a.weekday === idx);
        const available = row ? row.isAvailable : false;
        const st = row?.startTime ?? "";
        const et = row?.endTime ?? "";
        return `<div class="promoter-day-row full">
          <label><input type="checkbox" data-weekday="${idx}" data-available ${available ? "checked" : ""}/> ${label}</label>
          <input type="time" data-weekday="${idx}" data-start value="${esc(st)}" />
          <input type="time" data-weekday="${idx}" data-end value="${esc(et)}" />
        </div>`;
      }).join("");

      const prefLines =
        preferences
          .map(
            (p) =>
              `<p><strong>${esc(p.clubSlug)}</strong> · ${esc(p.weekdays.join("|"))} · <span class="promoter-pref-status">${esc(p.status)}</span>${p.notes ? ` — ${esc(p.notes)}` : ""}</p>`,
          )
          .join("") || "<p>No club preferences submitted yet.</p>";

      return `
        <div class="promoter-panel">
          <h4>Weekly availability</h4>
          <p class="promoter-main__subtitle" style="margin-top:0">Tick the days you can work and optional start / end times.</p>
          <section class="admin-form" style="margin-top:0.75rem">
            ${availabilityBlock}
            <div class="admin-actions full">
              <button class="cc-btn cc-btn--gold" id="p-save-availability" type="button">Save availability</button>
            </div>
          </section>
        </div>
        <div class="promoter-panel">
          <h4>Preferred clubs &amp; nights</h4>
          <p class="promoter-main__subtitle" style="margin-top:0">Submit where you like to work; the team will review each preference.</p>
          <section class="admin-form" style="margin-top:0.75rem">
            <div class="cc-field"><label>Club</label>
              <select id="p-pref-club">${clubs.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join("")}</select>
            </div>
            <div class="cc-field"><label>Days (pipe-separated)</label><input id="p-pref-days" placeholder="Thu|Fri|Sat" /></div>
            <div class="cc-field full"><label>Notes</label><textarea id="p-pref-notes" rows="3" placeholder="Door experience, languages, etc."></textarea></div>
            <div class="admin-actions full">
              <button class="cc-btn cc-btn--ghost" id="p-save-preference" type="button">Submit preference</button>
            </div>
          </section>
          <div class="promoter-pref-list">
            <p class="promoter-panel__title">Your submissions</p>
            ${prefLines}
          </div>
        </div>`;
    }

    if (v === "jobs") {
      const upcoming = jobs.filter((j) => j.status === "assigned");
      const completed = jobs.filter((j) => j.status === "completed");
      const cancelled = jobs.filter((j) => j.status === "cancelled");
      return `
        <div class="promoter-job-section">
          <h4>Upcoming</h4>
          <p class="promoter-job-hint">Assigned shifts you have not completed yet.</p>
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Club</th><th>Service</th><th>Status</th><th>Guests</th><th>Earnings basis</th></tr></thead>
              <tbody>${jobsTableRows(upcoming, 6, "No upcoming jobs.")}</tbody>
            </table>
          </div>
        </div>
        <div class="promoter-job-section">
          <h4>Completed</h4>
          <p class="promoter-job-hint">Finished shifts — totals feed your overview earnings figure.</p>
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Club</th><th>Service</th><th>Status</th><th>Guests</th><th>Earnings basis</th></tr></thead>
              <tbody>${jobsTableRows(completed, 6, "No completed jobs yet.")}</tbody>
            </table>
          </div>
        </div>
        <div class="promoter-job-section">
          <h4>Cancelled</h4>
          <p class="promoter-job-hint">Assignments that were called off or removed.</p>
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Club</th><th>Service</th><th>Status</th><th>Guests</th><th>Earnings basis</th></tr></thead>
              <tbody>${jobsTableRows(cancelled, 6, "No cancelled jobs.")}</tbody>
            </table>
          </div>
        </div>`;
    }

    /* invoices */
    const invBody =
      invoices.length === 0
        ? "<tr><td colspan='3'>No invoices generated yet.</td></tr>"
        : invoices
            .map(
              (i) =>
                `<tr><td>${esc(i.periodStart)} to ${esc(i.periodEnd)}</td><td>${esc(i.status)}</td><td>${money(i.total)}</td></tr>`,
            )
            .join("");
    return `
      <div class="promoter-panel">
        <p class="promoter-panel__title">Statements</p>
        <div class="promoter-table-wrap">
          <table>
            <thead><tr><th>Period</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>${invBody}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderDashboard(): void {
    if (!profile) {
      renderAuth();
      return;
    }
    const v = promoterView;
    const vh = PROMOTER_VIEW_HEADINGS[v];
    const tab = (id: PromoterView, label: string) =>
      `<button type="button" class="promoter-view-tab ${v === id ? "is-active" : ""}" data-promoter-view="${id}">${esc(label)}</button>`;

    root.innerHTML = `
      <div class="promoter-shell">
        <aside class="promoter-sidebar" aria-label="Promoter portal">
          <div class="promoter-sidebar__brand">
            <p class="promoter-sidebar__eyebrow">Cooper Concierge</p>
            <p class="promoter-sidebar__title">Promoter</p>
          </div>
          <nav class="promoter-sidebar__nav">
            ${tab("overview", "Overview")}
            ${tab("profile", "My profile")}
            ${tab("preferences", "Work preferences")}
            ${tab("jobs", "Jobs")}
            ${tab("invoices", "Invoices")}
          </nav>
          <div class="promoter-sidebar__footer">
            <button class="promoter-sidebar__btn" id="promoter-signout" type="button">Sign out</button>
          </div>
        </aside>
        <div class="promoter-main">
          <header class="promoter-main__header">
            <div>
              <h2 class="promoter-main__title">${esc(vh.title)}</h2>
              <p class="promoter-main__subtitle">${esc(vh.subtitle)}</p>
            </div>
          </header>
          <div class="promoter-workspace">
            ${renderWorkspaceBody()}
            <div class="admin-flash" id="promoter-flash" style="margin-top:1rem"></div>
          </div>
        </div>
      </div>
    `;

    root.querySelectorAll(".promoter-view-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = (btn as HTMLButtonElement).dataset.promoterView as
          | PromoterView
          | undefined;
        if (!id) return;
        promoterView = id;
        renderDashboard();
      });
    });

    root.querySelector("#promoter-signout")?.addEventListener("click", () => {
      void signOutAdmin(supabase).then(() => {
        promoterView = "overview";
        renderAuth();
      });
    });

    root.querySelector("#p-save-profile")?.addEventListener("click", () => {
      if (!profile) return;
      const displayName = String(
        (root.querySelector("#p-display-name") as HTMLInputElement)?.value || "",
      ).trim();
      const bio = String(
        (root.querySelector("#p-bio") as HTMLTextAreaElement)?.value || "",
      ).trim();
      const profileImageUrl = String(
        (root.querySelector("#p-image") as HTMLInputElement)?.value || "",
      ).trim();
      void (async () => {
        const r = await submitPromoterRevision(supabase, profile.id, {
          display_name: displayName,
          bio,
          profile_image_url: profileImageUrl,
        });
        if (!r.ok) {
          flash(r.message, true);
          return;
        }
        flash("Revision submitted for approval.");
      })();
    });

    const syncProfileImagePreview = (): void => {
      const urlInput = root.querySelector("#p-image") as HTMLInputElement | null;
      const prev = root.querySelector("#p-image-preview") as HTMLImageElement | null;
      const wrap = root.querySelector("#p-image-preview-wrap") as HTMLElement | null;
      if (!urlInput || !prev || !wrap) return;
      const url = urlInput.value.trim();
      if (url && /^https?:\/\//i.test(url)) {
        prev.src = url;
        prev.removeAttribute("hidden");
        wrap.classList.remove("is-empty");
      } else {
        prev.removeAttribute("src");
        prev.setAttribute("hidden", "");
        wrap.classList.add("is-empty");
      }
    };

    root.querySelector("#p-image")?.addEventListener("input", syncProfileImagePreview);

    root.querySelector("#p-profile-image-upload")?.addEventListener("click", () => {
      if (!profile) return;
      const fileInput = root.querySelector(
        "#p-profile-image-file",
      ) as HTMLInputElement | null;
      const urlInput = root.querySelector("#p-image") as HTMLInputElement | null;
      const file = fileInput?.files?.[0];
      if (!file || !urlInput) {
        flash("Choose an image file first.", true);
        return;
      }
      if (!file.type.startsWith("image/")) {
        flash("Please choose an image file (JPEG, PNG, WebP, or GIF).", true);
        return;
      }
      if (file.size > 6 * 1024 * 1024) {
        flash("Image is too large — try under 6MB.", true);
        return;
      }
      void (async () => {
        const path = `promoter-profiles/${profile.id}/${safePromoterProfileFileSegment(file.name)}`;
        const { error } = await supabase.storage
          .from(PROMOTER_PROFILE_IMAGE_BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) {
          flash(
            `Upload failed: ${error.message}. Admin: add Storage policies on bucket club-flyers (see scripts/sql/promoter_profile_storage.sql — use the Dashboard, not raw SQL on storage.objects).`,
            true,
          );
          return;
        }
        const pub = supabase.storage
          .from(PROMOTER_PROFILE_IMAGE_BUCKET)
          .getPublicUrl(path);
        urlInput.value = pub.data.publicUrl;
        syncProfileImagePreview();
        if (fileInput) fileInput.value = "";
        flash("Photo uploaded — check the preview, then submit for approval when ready.");
      })();
    });

    root.querySelector("#p-save-availability")?.addEventListener("click", () => {
      if (!profile) return;
      const rows = WEEKDAY_LABELS.map((_, idx) => {
        const chk = root.querySelector(
          `[data-weekday="${idx}"][data-available]`,
        ) as HTMLInputElement | null;
        const st = root.querySelector(
          `[data-weekday="${idx}"][data-start]`,
        ) as HTMLInputElement | null;
        const et = root.querySelector(
          `[data-weekday="${idx}"][data-end]`,
        ) as HTMLInputElement | null;
        return {
          weekday: idx,
          is_available: Boolean(chk?.checked),
          start_time: st?.value || null,
          end_time: et?.value || null,
        };
      });
      void (async () => {
        const r = await savePromoterAvailability(supabase, profile.id, rows);
        if (!r.ok) {
          flash(r.message, true);
          return;
        }
        flash("Availability updated.");
      })();
    });

    root.querySelector("#p-save-preference")?.addEventListener("click", () => {
      if (!profile) return;
      const clubSlug = String(
        (root.querySelector("#p-pref-club") as HTMLSelectElement)?.value || "",
      ).trim();
      const days = parseClubDays(
        String((root.querySelector("#p-pref-days") as HTMLInputElement)?.value || ""),
      );
      const notes = String(
        (root.querySelector("#p-pref-notes") as HTMLTextAreaElement)?.value || "",
      ).trim();
      if (!clubSlug || !days.length) {
        flash("Select a club and at least one day.", true);
        return;
      }
      void (async () => {
        const r = await savePromoterPreference(supabase, profile.id, {
          club_slug: clubSlug,
          weekdays: days,
          notes,
        });
        if (!r.ok) {
          flash(r.message, true);
          return;
        }
        await loadAndRender();
        flash("Preference submitted.");
      })();
    });
  }

  async function loadAndRender(): Promise<void> {
    const gate = await gatePromoterUser(supabase);
    if (!gate.ok) {
      renderAuth();
      return;
    }
    await reloadPromoterData(gate.user.id);
    renderDashboard();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      promoterView = "overview";
      renderAuth();
      return;
    }
    void loadAndRender();
  });

  await loadAndRender();
}
