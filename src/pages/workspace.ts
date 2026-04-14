import {
  checkInSignup,
  createAudience,
  loadAudienceMembers,
  loadAudiences,
  loadConversionMetrics,
  loadGuestEvents,
  loadGuestSignupsByEvent,
} from "../admin/guest-intel";
import { gateAdminUser, gatePromoterUser } from "../admin/auth";
import { getSupabaseClient } from "../lib/supabase";

type Panel = "operations" | "guests" | "performance" | "campaigns";

function csvEscape(v: string): string {
  if (/["\n,]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadCsv(name: string, headers: string[], rows: string[][]): void {
  const csv = [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function initWorkspacePage(): Promise<void> {
  const root = document.getElementById("workspace-root");
  if (!root) return;
  const supabase = getSupabaseClient();
  if (!supabase) {
    root.innerHTML = `<div class="admin-card"><p>Supabase is not configured.</p></div>`;
    return;
  }
  const adminGate = await gateAdminUser(supabase);
  const promoterGate = adminGate.ok ? null : await gatePromoterUser(supabase);
  if (!adminGate.ok && !promoterGate?.ok) {
    root.innerHTML = `<div class="admin-card"><p>Sign in with an admin or promoter account to access the workspace.</p></div>`;
    return;
  }

  const state: { panel: Panel; selectedEventId: string | null; selectedAudienceId: string | null } =
    { panel: "operations", selectedEventId: null, selectedAudienceId: null };

  root.innerHTML = `
    <div class="admin-tabs">
      <button data-panel="operations" class="is-active">Operations</button>
      <button data-panel="guests">Guests</button>
      <button data-panel="performance">Performance</button>
      <button data-panel="campaigns">Campaigns</button>
    </div>
    <div id="workspace-panel"></div>
  `;
  const panelEl = root.querySelector("#workspace-panel") as HTMLElement;
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>(".admin-tabs button"));

  async function renderOperations(): Promise<void> {
    const events = await loadGuestEvents(supabase);
    if (!events.ok) {
      panelEl.innerHTML = `<div class="admin-card">Failed to load events: ${events.message}</div>`;
      return;
    }
    const firstEvent = events.rows[0]?.id ?? null;
    if (!state.selectedEventId) state.selectedEventId = firstEvent;
    const signups = state.selectedEventId
      ? await loadGuestSignupsByEvent(supabase, state.selectedEventId)
      : { ok: true as const, rows: [] };
    panelEl.innerHTML = `
      <div class="admin-grid admin-grid--2">
        <div class="admin-card">
          <h3>Nightly events</h3>
          <div class="admin-list">
            ${events.rows
              .map(
                (e) => `<button class="admin-list-item ${e.id === state.selectedEventId ? "is-active" : ""}" data-event-id="${e.id}">
                    <strong>${e.club_slug}</strong> — ${e.event_date}<br/><small>${e.status}</small>
                  </button>`,
              )
              .join("")}
          </div>
        </div>
        <div class="admin-card">
          <h3>Check-in queue</h3>
          ${
            !signups.ok
              ? `<p>Could not load signups: ${signups.message}</p>`
              : `<table class="admin-table"><thead><tr><th>Guest</th><th>Status</th><th>Contact</th><th>Action</th></tr></thead><tbody>
              ${signups.rows
                .map(
                  (s) => `<tr>
                    <td>${s.guest_name}</td>
                    <td>${s.status}</td>
                    <td>${s.guest_instagram || s.guest_phone || s.guest_email || "-"}</td>
                    <td>${s.status === "attended" ? "Checked in" : `<button data-checkin="${s.id}" data-source="admin">Admin check-in</button> <button data-checkin="${s.id}" data-source="promoter">Promoter check-in</button>`}</td>
                  </tr>`,
                )
                .join("")}
              </tbody></table>`
          }
        </div>
      </div>
    `;
    panelEl.querySelectorAll<HTMLButtonElement>("[data-event-id]").forEach((b) =>
      b.addEventListener("click", () => {
        state.selectedEventId = b.dataset.eventId || null;
        void render();
      }),
    );
    panelEl.querySelectorAll<HTMLButtonElement>("[data-checkin]").forEach((b) =>
      b.addEventListener("click", () => {
        const signupId = b.dataset.checkin || "";
        const source = (b.dataset.source || "admin") as "admin" | "promoter";
        void (async () => {
          await checkInSignup(supabase, signupId, source);
          await render();
        })();
      }),
    );
  }

  async function renderGuests(): Promise<void> {
    const events = await loadGuestEvents(supabase);
    if (!events.ok || !events.rows[0]) {
      panelEl.innerHTML = `<div class="admin-card"><p>No events yet.</p></div>`;
      return;
    }
    const eventId = state.selectedEventId || events.rows[0].id;
    const signups = await loadGuestSignupsByEvent(supabase, eventId);
    panelEl.innerHTML = `
      <div class="admin-card">
        <h3>Guest profiles and repeat indicators</h3>
        ${
          !signups.ok
            ? `<p>${signups.message}</p>`
            : `<table class="admin-table"><thead><tr><th>Name</th><th>Age</th><th>Gender</th><th>Contact</th><th>Status</th></tr></thead><tbody>
              ${signups.rows
                .map(
                  (s) => `<tr><td>${s.guest_name}</td><td>${s.guest_age ?? "-"}</td><td>${s.guest_gender ?? "-"}</td><td>${s.guest_instagram || s.guest_phone || s.guest_email || "-"}</td><td>${s.status}</td></tr>`,
                )
                .join("")}
             </tbody></table>`
        }
      </div>
    `;
  }

  async function renderPerformance(): Promise<void> {
    const metrics = await loadConversionMetrics(supabase, {});
    if (!metrics.ok) {
      panelEl.innerHTML = `<div class="admin-card"><p>${metrics.message}</p></div>`;
      return;
    }
    panelEl.innerHTML = `
      <div class="admin-card">
        <h3>Club / promoter funnel</h3>
        <table class="admin-table">
          <thead><tr><th>Date</th><th>Club</th><th>Signups</th><th>Attended</th><th>Conversion</th></tr></thead>
          <tbody>
            ${metrics.rows
              .map(
                (r) => `<tr><td>${r.event_date}</td><td>${r.club_slug}</td><td>${r.signups}</td><td>${r.attended}</td><td>${Math.round(r.conversion * 100)}%</td></tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function renderCampaigns(): Promise<void> {
    const audiences = await loadAudiences(supabase);
    const selectedId = state.selectedAudienceId ?? (audiences.ok ? audiences.rows[0]?.id : null) ?? null;
    state.selectedAudienceId = selectedId;
    const members = selectedId ? await loadAudienceMembers(supabase, selectedId) : null;
    panelEl.innerHTML = `
      <div class="admin-grid admin-grid--2">
        <div class="admin-card">
          <h3>Segment builder</h3>
          <form id="audience-form" class="admin-form">
            <div class="cc-field"><label>Name</label><input name="name" required /></div>
            <div class="cc-field"><label>Description</label><input name="description" /></div>
            <div class="cc-field"><label>Min attended events</label><input type="number" min="1" value="1" name="minEvents" /></div>
            <button class="cc-btn cc-btn--gold" type="submit">Create audience</button>
          </form>
          <div class="admin-list">
            ${
              !audiences.ok
                ? `<p>${audiences.message}</p>`
                : audiences.rows
                    .map(
                      (a) => `<button data-audience-id="${a.id}" class="admin-list-item ${a.id === state.selectedAudienceId ? "is-active" : ""}"><strong>${a.name}</strong><br/><small>${a.description}</small></button>`,
                    )
                    .join("")
            }
          </div>
        </div>
        <div class="admin-card">
          <h3>Audience members</h3>
          ${
            !members
              ? `<p>Select an audience.</p>`
              : !members.ok
                ? `<p>${members.message}</p>`
                : `<button id="export-audience-csv" class="cc-btn">Export CSV</button>
                   <table class="admin-table"><thead><tr><th>Name</th><th>Phone</th><th>Instagram</th><th>Email</th></tr></thead><tbody>
                    ${members.rows.map((m) => `<tr><td>${m.full_name}</td><td>${m.phone ?? ""}</td><td>${m.instagram ?? ""}</td><td>${m.email ?? ""}</td></tr>`).join("")}
                   </tbody></table>`
          }
        </div>
      </div>
    `;

    panelEl.querySelector("#audience-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target as HTMLFormElement);
      void (async () => {
        await createAudience(
          supabase,
          String(fd.get("name") || ""),
          String(fd.get("description") || ""),
          Number(fd.get("minEvents") || 1),
        );
        await render();
      })();
    });
    panelEl.querySelectorAll<HTMLButtonElement>("[data-audience-id]").forEach((b) =>
      b.addEventListener("click", () => {
        state.selectedAudienceId = b.dataset.audienceId || null;
        void render();
      }),
    );
    panelEl.querySelector("#export-audience-csv")?.addEventListener("click", () => {
      if (!members || !members.ok) return;
      downloadCsv(
        `audience-${state.selectedAudienceId || "members"}.csv`,
        ["full_name", "phone", "instagram", "email"],
        members.rows.map((m) => [m.full_name, m.phone ?? "", m.instagram ?? "", m.email ?? ""]),
      );
    });
  }

  async function render(): Promise<void> {
    tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.panel === state.panel));
    if (state.panel === "operations") return renderOperations();
    if (state.panel === "guests") return renderGuests();
    if (state.panel === "performance") return renderPerformance();
    return renderCampaigns();
  }

  tabs.forEach((btn) =>
    btn.addEventListener("click", () => {
      state.panel = (btn.dataset.panel as Panel) || "operations";
      void render();
    }),
  );
  await render();
}
