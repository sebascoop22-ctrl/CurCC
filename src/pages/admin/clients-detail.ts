import { escAttr, escHtml } from "../../portal/html";
import { renderStatusBadge } from "../../portal/badge";
import { renderBrowserTabBar } from "./admin-entity-chrome";
import type {
  ClientAttendanceRow,
  ClientGuestlistActivityRow,
  ClientRow,
  ClientTimelineRow,
} from "../../admin/clients";
import { buildClientTimelineRows } from "../../admin/clients";
import type { PromoterJob, PromoterProfile } from "../../types";
import { jobTypeLabel } from "../../lib/financial/job-display";

export type ClientDetailTab = "profile" | "activity" | "jobs" | "notes";

export const CLIENT_DETAIL_TABS: Array<{ id: ClientDetailTab; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "activity", label: "Activity" },
  { id: "jobs", label: "Jobs" },
  { id: "notes", label: "Notes" },
];

export function parseClientDetailTab(raw: string): ClientDetailTab {
  const t = raw.trim().toLowerCase();
  if (CLIENT_DETAIL_TABS.some((x) => x.id === t)) return t as ClientDetailTab;
  return "profile";
}

function profileTabHtml(
  c: ClientRow,
  clubs: Array<{ slug: string; name: string }>,
  promoters: PromoterProfile[],
): string {
  const spendVal =
    c.typical_spend_gbp != null && Number.isFinite(c.typical_spend_gbp)
      ? String(c.typical_spend_gbp)
      : "";
  const promoOpts = [
    `<option value="">— None —</option>`,
    ...promoters.map(
      (p) =>
        `<option value="${escAttr(p.id)}"${p.id === c.preferred_promoter_id ? " selected" : ""}>${escHtml(p.displayName || p.userId)}</option>`,
    ),
  ].join("");
  const clubOpts = clubs
    .map(
      (club) =>
        `<option value="${escAttr(club.slug)}"${club.slug === c.preferred_club_slug ? " selected" : ""}>${escHtml(club.name)}</option>`,
    )
    .join("");
  return `<form class="admin-form" id="admin-client-form" data-collapsible="true">
    <input type="hidden" name="client_id" value="${escAttr(c.id)}" />
    <h4 class="full">Contact</h4>
    <div class="cc-field"><label for="client-name">Name</label>
      <input id="client-name" name="name" value="${escAttr(c.name ?? "")}" /></div>
    <div class="cc-field"><label for="client-email">Email</label>
      <input id="client-email" name="email" type="email" value="${escAttr(c.email ?? "")}" /></div>
    <div class="cc-field"><label for="client-phone">Phone</label>
      <input id="client-phone" name="phone" value="${escAttr(c.phone ?? "")}" /></div>
    <div class="cc-field"><label for="client-ig">Instagram</label>
      <input id="client-ig" name="instagram" value="${escAttr(c.instagram ?? "")}" placeholder="@handle" /></div>
    <h4 class="full">Preferences</h4>
    <div class="cc-field"><label for="client-spend">Typical spend (GBP / night)</label>
      <input id="client-spend" name="typical_spend_gbp" type="number" min="0" step="0.01" value="${escAttr(spendVal)}" /></div>
    <div class="cc-field full"><label for="client-nights">Preferred nights</label>
      <input id="client-nights" name="preferred_nights" value="${escAttr(c.preferred_nights ?? "")}" placeholder="Fri, Sat" /></div>
    <div class="cc-field full"><label for="client-promoter">Preferred promoter</label>
      <select id="client-promoter" name="preferred_promoter_id">${promoOpts}</select></div>
    <div class="cc-field full"><label for="client-club">Preferred club</label>
      <select id="client-club" name="preferred_club_slug"><option value="">— None —</option>${clubOpts}</select></div>
    <div class="admin-actions full">
      <button type="button" class="cc-btn cc-btn--gold" id="admin-client-save">Save profile</button>
    </div>
  </form>`;
}

function activityTabHtml(
  timeline: ClientTimelineRow[],
  attendances: ClientAttendanceRow[],
  clubs: Array<{ slug: string; name: string }>,
  promoters: PromoterProfile[],
  selectedAttendanceId: string | null,
): string {
  const selectedAttendance =
    (selectedAttendanceId && attendances.find((a) => a.id === selectedAttendanceId)) || null;
  const attendanceClubOpts = clubs
    .map(
      (club) =>
        `<option value="${escAttr(club.slug)}"${club.slug === selectedAttendance?.club_slug ? " selected" : ""}>${escHtml(club.name)}</option>`,
    )
    .join("");
  const attendancePromoOpts = [
    `<option value="">— None —</option>`,
    ...promoters.map(
      (p) =>
        `<option value="${escAttr(p.id)}"${p.id === selectedAttendance?.promoter_id ? " selected" : ""}>${escHtml(p.displayName || p.userId)}</option>`,
    ),
  ].join("");
  const timelineRows =
    timeline.length === 0
      ? `<tr><td colspan="4">No activity yet.</td></tr>`
      : timeline
          .map(
            (t) =>
              `<tr><td>${escHtml(t.date)}</td><td>${escHtml(t.kind)}</td><td>${escHtml(t.title)}</td><td>${escHtml(t.detail)}</td></tr>`,
          )
          .join("");
  const attendanceRows =
    attendances.length === 0
      ? `<tr><td colspan="7">No visits logged yet.</td></tr>`
      : attendances
          .map((a) => {
            const pr = a.promoter_id
              ? promoters.find((p) => p.id === a.promoter_id)
              : undefined;
            const isActive = selectedAttendanceId === a.id ? " is-active" : "";
            const clubLabel =
              clubs.find((c) => c.slug === a.club_slug)?.name ?? a.club_slug;
            return `<tr class="admin-list-row${isActive}" data-client-attendance-id="${escAttr(a.id)}">
            <td>${escHtml(a.event_date)}</td>
            <td>${escHtml(clubLabel)}</td>
            <td>${escHtml(pr?.displayName || pr?.userId || "—")}</td>
            <td>£${Number(a.spend_gbp || 0).toFixed(2)}</td>
            <td>${escHtml(a.source || "manual")}</td>
            <td>${escHtml(a.notes || "—")}</td>
            <td><button type="button" class="cc-btn cc-btn--ghost cc-btn--small" data-client-attendance-delete="${escAttr(a.id)}">Delete</button></td>
          </tr>`;
          })
          .join("");
  return `<p class="admin-note">Unified timeline from guestlist signups, manual visits, and linked jobs.</p>
    <div class="promoter-table-wrap">
      <table class="admin-list-table">
        <thead><tr><th>Date</th><th>Type</th><th>Summary</th><th>Details</th></tr></thead>
        <tbody>${timelineRows}</tbody>
      </table>
    </div>
    <h4 class="admin-subhead">Visit history</h4>
    <p class="admin-hint">Click a row to edit; preferences recalculate from visits.</p>
    <div class="promoter-table-wrap">
      <table class="admin-list-table">
        <thead><tr><th>Date</th><th>Club</th><th>Promoter</th><th>Spend</th><th>Source</th><th>Notes</th><th></th></tr></thead>
        <tbody>${attendanceRows}</tbody>
      </table>
    </div>
    <h4 class="admin-subhead">Log a visit</h4>
    <form class="admin-form" id="admin-client-attendance-form" data-collapsible="true">
      <input type="hidden" name="attendance_id" value="${escAttr(selectedAttendance?.id || "")}" />
      <div class="cc-field"><label>Date</label><input name="event_date" type="date" required value="${escAttr(selectedAttendance?.event_date || new Date().toISOString().slice(0, 10))}" /></div>
      <div class="cc-field"><label>Club</label><select name="club_slug" required>${attendanceClubOpts}</select></div>
      <div class="cc-field"><label>Promoter</label><select name="promoter_id">${attendancePromoOpts}</select></div>
      <div class="cc-field"><label>Spend (GBP)</label><input name="spend_gbp" type="number" min="0" step="0.01" value="${escAttr(String(selectedAttendance?.spend_gbp ?? 0))}" /></div>
      <div class="cc-field"><label>Source</label><input name="source" value="${escAttr(selectedAttendance?.source || "manual")}" /></div>
      <div class="cc-field full"><label>Details</label><textarea name="attendance_notes" rows="2">${escHtml(selectedAttendance?.notes || "")}</textarea></div>
      <div class="admin-actions full">
        <button type="button" class="cc-btn cc-btn--gold" id="admin-client-attendance-save">${selectedAttendance ? "Save visit" : "Add visit"}</button>
        ${
          selectedAttendance
            ? `<button type="button" class="cc-btn cc-btn--ghost" id="admin-client-attendance-new">New visit</button>`
            : ""
        }
      </div>
    </form>`;
}

function jobsTabHtml(jobs: PromoterJob[]): string {
  const rows =
    jobs.length === 0
      ? `<tr><td colspan="6">No jobs linked via <code>client_id</code> yet.</td></tr>`
      : jobs
          .map(
            (j) =>
              `<tr>
            <td>${escHtml(j.jobDate)}</td>
            <td>${escHtml(j.clubSlug ?? "—")}</td>
            <td>${escHtml(jobTypeLabel(j.jobType))}</td>
            <td>${renderStatusBadge(j.status)}</td>
            <td>${j.guestsEntered}</td>
            <td>£${j.conciergeCutGbp.toFixed(2)}</td>
          </tr>`,
          )
          .join("");
  return `<p class="admin-note">Operational ledger rows where this client is linked on the job.</p>
    <div class="promoter-table-wrap">
      <table class="admin-list-table">
        <thead><tr><th>Date</th><th>Club</th><th>Type</th><th>Status</th><th>Entered</th><th>Concierge</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function notesTabHtml(c: ClientRow): string {
  return `<form class="admin-form" id="admin-client-notes-form">
    <div class="cc-field full"><label for="client-notes-only">Internal notes</label>
      <textarea id="client-notes-only" name="notes" rows="12">${escHtml(c.notes ?? "")}</textarea></div>
    <div class="admin-actions full">
      <button type="button" class="cc-btn cc-btn--gold" id="admin-client-save-notes">Save notes</button>
    </div>
  </form>
  <p class="admin-note">Guest profile id: ${escHtml(c.guest_profile_id ?? "—")} · Added ${escHtml(c.created_at?.slice(0, 10) ?? "—")}</p>`;
}

export function renderAdminClientDetailPanel(opts: {
  client: ClientRow;
  tab: ClientDetailTab;
  activity: ClientGuestlistActivityRow[];
  attendances: ClientAttendanceRow[];
  jobs: PromoterJob[];
  clubs: Array<{ slug: string; name: string }>;
  promoters: PromoterProfile[];
  selectedAttendanceId: string | null;
}): string {
  const { client, tab, activity, attendances, jobs, clubs, promoters, selectedAttendanceId } =
    opts;
  const clubNames = new Map(clubs.map((c) => [c.slug, c.name]));
  const promoterNames = new Map(
    promoters.map((p) => [p.id, p.displayName || p.userId || p.id.slice(0, 8)]),
  );
  const timeline = buildClientTimelineRows({
    guestlist: activity,
    attendances,
    jobs,
    clubNames,
    promoterNames,
  });
  const tabs = renderBrowserTabBar(CLIENT_DETAIL_TABS, tab, "data-client-detail-tab");
  const body =
    tab === "profile"
      ? profileTabHtml(client, clubs, promoters)
      : tab === "activity"
        ? activityTabHtml(timeline, attendances, clubs, promoters, selectedAttendanceId)
        : tab === "jobs"
          ? jobsTabHtml(jobs)
          : notesTabHtml(client);
  const label =
    client.name || client.email || client.phone || client.instagram || client.id.slice(0, 8);
  return `<div class="admin-client-detail">
    <header class="admin-client-detail__header">
      <h4 style="margin:0">${escHtml(label)}</h4>
      <p class="admin-note" style="margin:0.25rem 0 0">Client CRM · ${escHtml(client.id.slice(0, 8))}…</p>
    </header>
    ${tabs}
    <div class="admin-client-detail__body">${body}</div>
  </div>`;
}
