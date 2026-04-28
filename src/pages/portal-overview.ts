import type { SupabaseClient } from "@supabase/supabase-js";
import { escHtml } from "../portal/html";
import { renderKpiCard, type PortalKpiCardOptions } from "../portal/kpi-card";
import type { PortalShellApi, PortalMode } from "../portal/types";

export interface RenderOverviewOptions {
  /** Mount target. */
  host: HTMLElement;
  supabase: SupabaseClient;
  mode: PortalMode;
  /** Email/display label of the signed-in user (for the greeting line). */
  email: string | null;
  /** Shell API for navigating to a sidebar item when a card is clicked. */
  shell: PortalShellApi;
}

interface OverviewKpi extends PortalKpiCardOptions {
  /** When set, clicking the card navigates to this nav item id. */
  navItemId?: string;
}

interface OverviewSection {
  title: string;
  subtitle: string;
  kpis: OverviewKpi[];
  recent: Array<{ title: string; meta: string; when: string }>;
}

async function adminOverview(supabase: SupabaseClient): Promise<OverviewSection> {
  const counts = await Promise.all([
    supabase.from("enquiries").select("id", { count: "exact", head: true }).in("status", ["new", "in_progress"]),
    supabase.from("promoter_guestlist_entries").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("promoter_night_adjustments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("promoter_table_sales").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("job_disputes").select("id", { count: "exact", head: true }).in("status", ["open", "under_review"]),
    supabase.from("club_edit_revisions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("promoter_signup_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const [
    enquiries,
    guestlist,
    nightShifts,
    tables,
    disputes,
    clubEdits,
    promoterReqs,
  ] = counts.map((r) => r.count ?? 0);

  const kpis: OverviewKpi[] = [
    {
      label: "Pending enquiries",
      value: enquiries,
      icon: "✉",
      hint: "Active in CRM intake.",
      navItemId: "admin.enquiries",
      emphasis: enquiries > 0 ? "accent" : "default",
    },
    {
      label: "Promoter requests",
      value: promoterReqs,
      icon: "⊕",
      hint: "Sign-up requests waiting on a decision.",
      navItemId: "admin.promoter_requests",
      emphasis: promoterReqs > 0 ? "warning" : "default",
    },
    {
      label: "Guestlist queue",
      value: guestlist,
      icon: "≡",
      hint: "Names submitted by promoters awaiting approval.",
      navItemId: "admin.guestlist_queue",
      emphasis: guestlist > 0 ? "warning" : "default",
    },
    {
      label: "Night shift requests",
      value: nightShifts,
      icon: "☾",
      hint: "Promoter shift overrides to review.",
      navItemId: "admin.night_adjustments",
      emphasis: nightShifts > 0 ? "warning" : "default",
    },
    {
      label: "Tables pending review",
      value: tables,
      icon: "▤",
      hint: "Promoter-logged table sales awaiting confirmation.",
      navItemId: "admin.table_sales",
    },
    {
      label: "Open disputes",
      value: disputes,
      icon: "△",
      hint: "Club-raised disputes still open or under review.",
      navItemId: "admin.job_disputes",
      emphasis: disputes > 0 ? "danger" : "default",
    },
    {
      label: "Club edit queue",
      value: clubEdits,
      icon: "✎",
      hint: "Pending club/flyer/media edits to moderate.",
      navItemId: "admin.club_edits",
    },
  ];

  const { data: recentEnquiries } = await supabase
    .from("enquiries")
    .select("id,name,status,created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const recent = (recentEnquiries ?? []).map((row: Record<string, unknown>) => ({
    title: `Enquiry — ${String(row["name"] ?? "Unnamed")}`,
    meta: String(row["status"] ?? ""),
    when: formatRelative(String(row["created_at"] ?? "")),
  }));

  return {
    title: "Operations overview",
    subtitle:
      "Daily snapshot of pending work across the operation. Click a card to jump to its workspace.",
    kpis,
    recent,
  };
}

async function promoterOverview(
  supabase: SupabaseClient,
): Promise<OverviewSection> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id ?? "";

  const today = new Date();
  const inSevenDays = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const todayIso = today.toISOString().slice(0, 10);
  const inSevenIso = inSevenDays.toISOString().slice(0, 10);

  const [{ count: upcomingJobsCount }, { count: pendingGuestlistCount }, { count: pendingTablesCount }, { data: invoiceRow }] = await Promise.all([
    supabase
      .from("promoter_jobs")
      .select("id", { count: "exact", head: true })
      .gte("job_date", todayIso)
      .lte("job_date", inSevenIso)
      .eq("user_id", userId),
    supabase
      .from("promoter_guestlist_entries")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("user_id", userId),
    supabase
      .from("promoter_table_sales")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("user_id", userId),
    supabase
      .from("promoter_invoices")
      .select("id,total_gbp,status,period_end")
      .eq("user_id", userId)
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const invoiceTotal = (invoiceRow as { total_gbp?: number } | null)?.total_gbp ?? 0;
  const invoiceStatus = (invoiceRow as { status?: string } | null)?.status ?? "—";

  const kpis: OverviewKpi[] = [
    {
      label: "Upcoming jobs (7 days)",
      value: upcomingJobsCount ?? 0,
      icon: "◇",
      hint: "Confirmed work on the calendar.",
      navItemId: "promoter.jobs",
      emphasis: (upcomingJobsCount ?? 0) > 0 ? "accent" : "default",
    },
    {
      label: "Guestlist pending",
      value: pendingGuestlistCount ?? 0,
      icon: "≡",
      hint: "Names you submitted awaiting approval.",
      navItemId: "promoter.jobs",
    },
    {
      label: "Tables pending",
      value: pendingTablesCount ?? 0,
      icon: "▤",
      hint: "Bookings logged but not yet confirmed.",
      navItemId: "promoter.tables",
    },
    {
      label: "Latest invoice",
      value: invoiceRow ? `£${(invoiceTotal as number).toFixed(2)}` : "—",
      icon: "≣",
      hint: invoiceRow ? `Status: ${invoiceStatus}` : "Generated by the office once jobs complete.",
      navItemId: "promoter.invoices",
    },
  ];

  const { data: recentJobs } = await supabase
    .from("promoter_jobs")
    .select("id,job_date,club_slug,service,status")
    .eq("user_id", userId)
    .order("job_date", { ascending: false })
    .limit(5);

  const recent = (recentJobs ?? []).map((row: Record<string, unknown>) => ({
    title: `${String(row["service"] ?? "Job")} — ${String(row["club_slug"] ?? "—")}`,
    meta: String(row["status"] ?? ""),
    when: String(row["job_date"] ?? ""),
  }));

  return {
    title: "Your work overview",
    subtitle: "Status of your upcoming jobs, pending submissions, and earnings.",
    kpis,
    recent,
  };
}

async function clubOverview(supabase: SupabaseClient): Promise<OverviewSection> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id ?? "";
  const { data: account } = await supabase
    .from("club_accounts")
    .select("club_slug")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  const clubSlug = String((account as { club_slug?: string } | null)?.club_slug ?? "");

  const [{ count: pendingEdits }, { count: openDisputes }, { count: weekFlyers }] = await Promise.all([
    supabase
      .from("club_edit_revisions")
      .select("id", { count: "exact", head: true })
      .eq("club_slug", clubSlug)
      .eq("status", "pending"),
    supabase
      .from("job_disputes")
      .select("id", { count: "exact", head: true })
      .eq("club_slug", clubSlug)
      .in("status", ["open", "under_review"]),
    supabase
      .from("club_weekly_flyers")
      .select("id", { count: "exact", head: true })
      .eq("club_slug", clubSlug),
  ]);

  const kpis: OverviewKpi[] = [
    {
      label: "Pending edit revisions",
      value: pendingEdits ?? 0,
      icon: "✎",
      hint: "Edits you submitted awaiting review.",
      navItemId: "club.profile",
      emphasis: (pendingEdits ?? 0) > 0 ? "warning" : "default",
    },
    {
      label: "Open disputes",
      value: openDisputes ?? 0,
      icon: "△",
      hint: "Disputes raised by your club.",
      navItemId: "club.jobs",
      emphasis: (openDisputes ?? 0) > 0 ? "danger" : "default",
    },
    {
      label: "Flyers on file",
      value: weekFlyers ?? 0,
      icon: "▲",
      hint: "Weekly flyers linked to your club.",
      navItemId: "club.flyers",
    },
  ];

  const { data: recentEdits } = await supabase
    .from("club_edit_revisions")
    .select("id,target_type,status,created_at")
    .eq("club_slug", clubSlug)
    .order("created_at", { ascending: false })
    .limit(5);

  const recent = (recentEdits ?? []).map((row: Record<string, unknown>) => ({
    title: `${String(row["target_type"] ?? "edit")} edit`,
    meta: String(row["status"] ?? ""),
    when: formatRelative(String(row["created_at"] ?? "")),
  }));

  return {
    title: clubSlug ? `Welcome, ${clubSlug}` : "Club overview",
    subtitle: "Status of your club's edits, promoters, and disputes.",
    kpis,
    recent,
  };
}

function formatRelative(iso: string): string {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const diffMs = Date.now() - dt.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return dt.toISOString().slice(0, 10);
}

function renderActivity(rows: OverviewSection["recent"]): string {
  if (!rows.length) {
    return `<div class="pp-activity"><div class="pp-activity__row"><span>No recent activity yet.</span></div></div>`;
  }
  return `<div class="pp-activity">${rows
    .map(
      (r) => `<div class="pp-activity__row">
        <span><strong>${escHtml(r.title)}</strong></span>
        <span>${escHtml(r.meta)}</span>
        <span class="pp-activity__when">${escHtml(r.when)}</span>
      </div>`,
    )
    .join("")}</div>`;
}

export async function renderPortalOverview(opts: RenderOverviewOptions): Promise<void> {
  const { host, supabase, mode, email, shell } = opts;
  host.innerHTML = `<div class="pp-overview">
    <header class="pp-overview__greeting">
      <div>
        <h2 class="pp-overview__title">Loading overview…</h2>
        <p class="pp-overview__subtitle">${email ? escHtml(`Signed in as ${email}`) : ""}</p>
      </div>
    </header>
    <div class="pp-kpi-grid">
      ${Array.from({ length: 4 })
        .map(
          () => `<article class="pp-kpi"><div class="pp-kpi__header"><p class="pp-kpi__label">Loading</p></div><p class="pp-kpi__value">—</p></article>`,
        )
        .join("")}
    </div>
  </div>`;

  let section: OverviewSection;
  try {
    if (mode === "promoter") section = await promoterOverview(supabase);
    else if (mode === "club") section = await clubOverview(supabase);
    else section = await adminOverview(supabase);
  } catch (err) {
    host.innerHTML = `<div class="pp-overview"><p class="pp-empty">Could not load overview: ${escHtml(err instanceof Error ? err.message : String(err))}</p></div>`;
    return;
  }

  host.innerHTML = `
    <div class="pp-overview">
      <header class="pp-overview__greeting">
        <div>
          <h2 class="pp-overview__title">${escHtml(section.title)}</h2>
          <p class="pp-overview__subtitle">${escHtml(section.subtitle)}</p>
        </div>
      </header>
      <div class="pp-kpi-grid">${section.kpis
        .map((k) => {
          const card = renderKpiCard(k);
          if (k.navItemId) {
            return `<button type="button" class="pp-kpi-link" data-pp-nav-id="${k.navItemId}" style="all:unset; cursor:pointer; display:block">${card}</button>`;
          }
          return card;
        })
        .join("")}</div>
      <section class="pp-section">
        <header>
          <h3 class="pp-section__title">Recent activity</h3>
          <p class="pp-section__subtitle">Most recent items in this workspace.</p>
        </header>
        ${renderActivity(section.recent)}
      </section>
    </div>
  `;

  host.querySelectorAll<HTMLElement>("[data-pp-nav-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.ppNavId;
      if (id) shell.navigate(id);
    });
  });
}
