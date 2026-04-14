import { gatePromoterUser, signInPromoter, signOutAdmin, signUpPromoter } from "../admin/auth";
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
import { getSupabaseClient } from "../lib/supabase";
import type { Club, PromoterAvailabilitySlot, PromoterClubPreference, PromoterInvoice, PromoterJob, PromoterProfile } from "../types";
import "../styles/pages/promoter.css";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
            <div class="cc-field full"><label>Email</label><input name="email" type="email" required /></div>
            <div class="cc-field full"><label>Password</label><input name="password" type="password" required /></div>
            <button class="cc-btn cc-btn--gold" type="submit">Sign in</button>
          </form>
          <form id="promoter-signup-form" class="admin-form">
            <h3>Create promoter account</h3>
            <div class="cc-field"><label>Email</label><input name="email" type="email" required /></div>
            <div class="cc-field"><label>Password</label><input name="password" type="password" minlength="8" required /></div>
            <div class="cc-field full"><label>Display name</label><input name="displayName" required /></div>
            <div class="cc-field full"><label>Short bio</label><textarea name="bio"></textarea></div>
            <div class="cc-field full"><label>Profile image URL (optional)</label><input name="profileImageUrl" placeholder="https://..." /></div>
            <button class="cc-btn cc-btn--ghost" type="submit">Create account</button>
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
        await loadAndRender();
      })();
    });
    root.querySelector("#promoter-signup-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      void (async () => {
        const r = await signUpPromoter(supabase, {
          email: String(fd.get("email") || ""),
          password: String(fd.get("password") || ""),
          displayName: String(fd.get("displayName") || ""),
          bio: String(fd.get("bio") || ""),
          profileImageUrl: String(fd.get("profileImageUrl") || ""),
        });
        if (!r.ok) {
          flash(r.message, true);
          return;
        }
        flash("Account created. If email confirmation is enabled, verify your email then sign in.");
      })();
    });
  }

  function renderDashboard(): void {
    if (!profile) {
      renderAuth();
      return;
    }
    const jobsDone = jobs.filter((j) => j.status === "completed");
    const totalGuests = jobsDone.reduce((acc, j) => acc + j.guestsCount, 0);
    const totalEarned = jobsDone.reduce(
      (acc, j) => acc + j.shiftFee + j.guestlistFee * j.guestsCount,
      0,
    );
    const approvalBadge =
      profile.approvalStatus === "approved"
        ? "Approved"
        : profile.approvalStatus === "rejected"
          ? "Rejected"
          : "Pending";

    root.innerHTML = `
      <div class="admin-card">
        <div class="admin-toolbar">
          <h3 style="margin:0">Welcome, ${esc(profile.displayName || "Promoter")}</h3>
          <button class="cc-btn cc-btn--ghost" id="promoter-signout" type="button">Sign out</button>
        </div>
        <p class="promoter-status">Approval: <strong>${esc(approvalBadge)}</strong>${profile.approvalNotes ? ` — ${esc(profile.approvalNotes)}` : ""}</p>
        <div class="promoter-kpi-grid">
          <article><p>Completed jobs</p><strong>${jobsDone.length}</strong></article>
          <article><p>Guestlist people</p><strong>${totalGuests}</strong></article>
          <article><p>Earnings (tracked)</p><strong>${money(totalEarned)}</strong></article>
          <article><p>Invoices</p><strong>${invoices.length}</strong></article>
        </div>

        <div class="promoter-sections">
          <section class="admin-form">
            <h4 class="full">Profile revision request</h4>
            <div class="cc-field"><label>Display name</label><input id="p-display-name" value="${esc(profile.displayName)}" /></div>
            <div class="cc-field full"><label>Bio</label><textarea id="p-bio">${esc(profile.bio)}</textarea></div>
            <div class="cc-field full"><label>Image URL</label><input id="p-image" value="${esc(profile.profileImageUrl)}" /></div>
            <button class="cc-btn cc-btn--gold full" id="p-save-profile" type="button">Submit for approval</button>
          </section>

          <section class="admin-form">
            <h4 class="full">Availability (weekly)</h4>
            ${WEEKDAY_LABELS.map((label, idx) => {
              const row = availability.find((a) => a.weekday === idx);
              const available = row ? row.isAvailable : false;
              const st = row?.startTime ?? "";
              const et = row?.endTime ?? "";
              return `<div class="promoter-day-row full">
                <label><input type="checkbox" data-weekday="${idx}" data-available ${available ? "checked" : ""}/> ${label}</label>
                <input type="time" data-weekday="${idx}" data-start value="${esc(st)}" />
                <input type="time" data-weekday="${idx}" data-end value="${esc(et)}" />
              </div>`;
            }).join("")}
            <button class="cc-btn cc-btn--ghost full" id="p-save-availability" type="button">Save availability</button>
          </section>

          <section class="admin-form">
            <h4 class="full">Preferred clubs & days</h4>
            <div class="cc-field"><label>Club</label>
              <select id="p-pref-club">${clubs.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join("")}</select>
            </div>
            <div class="cc-field"><label>Days (pipe)</label><input id="p-pref-days" placeholder="Thu|Fri|Sat" /></div>
            <div class="cc-field full"><label>Notes</label><textarea id="p-pref-notes"></textarea></div>
            <button class="cc-btn cc-btn--ghost full" id="p-save-preference" type="button">Submit preference</button>
            <div class="full promoter-list">
              ${preferences.map((p) => `<p>${esc(p.clubSlug)} · ${esc(p.weekdays.join("|"))} · ${esc(p.status)}</p>`).join("") || "<p>No preferences yet.</p>"}
            </div>
          </section>
        </div>

        <section class="promoter-jobs">
          <h4>Assigned jobs</h4>
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Club</th><th>Status</th><th>Guests</th><th>Earnings basis</th></tr></thead>
              <tbody>
              ${jobs.map((j) => `<tr><td>${esc(j.jobDate)}</td><td>${esc(j.clubSlug ?? "—")}</td><td>${esc(j.status)}</td><td>${j.guestsCount}</td><td>${money(j.shiftFee)} + ${money(j.guestlistFee)}/guest</td></tr>`).join("") || "<tr><td colspan='5'>No jobs assigned yet.</td></tr>"}
              </tbody>
            </table>
          </div>
        </section>

        <section class="promoter-jobs">
          <h4>Invoices</h4>
          <div class="promoter-table-wrap">
            <table>
              <thead><tr><th>Period</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>
              ${invoices.map((i) => `<tr><td>${esc(i.periodStart)} to ${esc(i.periodEnd)}</td><td>${esc(i.status)}</td><td>${money(i.total)}</td></tr>`).join("") || "<tr><td colspan='3'>No invoices generated yet.</td></tr>"}
              </tbody>
            </table>
          </div>
        </section>

        <div class="admin-flash" id="promoter-flash"></div>
      </div>
    `;

    root.querySelector("#promoter-signout")?.addEventListener("click", () => {
      void signOutAdmin(supabase).then(() => renderAuth());
    });
    root.querySelector("#p-save-profile")?.addEventListener("click", () => {
      if (!profile) return;
      const displayName = String((root.querySelector("#p-display-name") as HTMLInputElement)?.value || "").trim();
      const bio = String((root.querySelector("#p-bio") as HTMLTextAreaElement)?.value || "").trim();
      const profileImageUrl = String((root.querySelector("#p-image") as HTMLInputElement)?.value || "").trim();
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
    root.querySelector("#p-save-availability")?.addEventListener("click", () => {
      if (!profile) return;
      const rows = WEEKDAY_LABELS.map((_, idx) => {
        const chk = root.querySelector(`[data-weekday="${idx}"][data-available]`) as HTMLInputElement | null;
        const st = root.querySelector(`[data-weekday="${idx}"][data-start]`) as HTMLInputElement | null;
        const et = root.querySelector(`[data-weekday="${idx}"][data-end]`) as HTMLInputElement | null;
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
      const clubSlug = String((root.querySelector("#p-pref-club") as HTMLSelectElement)?.value || "").trim();
      const days = parseClubDays(String((root.querySelector("#p-pref-days") as HTMLInputElement)?.value || ""));
      const notes = String((root.querySelector("#p-pref-notes") as HTMLTextAreaElement)?.value || "").trim();
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
      renderAuth();
      return;
    }
    void loadAndRender();
  });

  await loadAndRender();
}
