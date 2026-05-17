import type { SupabaseClient } from "@supabase/supabase-js";
import {
  completePromoterJob,
  createPromoterJob,
  deletePromoterJob,
  refreshPromoterJobHeadcountFromGuestlist,
  updatePromoterJob,
} from "../../admin/promoters";
import {
  createEmptyClient,
  updateClientById,
  type ClientRow,
} from "../../admin/clients";
import { financialDbPatchForJob, resolveDefaultClubPaymentRateId } from "../../lib/financial/job-snapshot-sync";
import { jobTypeToService } from "../../lib/financial/job-type";
import type {
  FinancialClubPaymentRate,
  PromoterJob,
  PromoterJobAdminRow,
  PromoterJobType,
} from "../../types";
import type { CreateJobClientRow } from "./jobs-ledger";
import {
  defaultJobsLedgerFilters,
  type JobsLedgerFilters,
} from "./jobs-shared";

export type JobsBindCtx = {
  adminRoot: HTMLElement;
  supabase: SupabaseClient;
  getSelectedJobId: () => string | null;
  setSelectedJobId: (id: string | null) => void;
  getJobsCalendarRows: () => PromoterJobAdminRow[];
  getRates: () => FinancialClubPaymentRate[];
  getClients: () => ClientRow[];
  getCreateJobClients: () => CreateJobClientRow[];
  setCreateJobClients: (rows: CreateJobClientRow[]) => void;
  getFilters: () => JobsLedgerFilters;
  setFilters: (f: JobsLedgerFilters) => void;
  readFiltersFromDom: () => JobsLedgerFilters;
  reloadJobs: () => Promise<void>;
  reloadPromoters: () => Promise<void>;
  reloadClients: () => Promise<void>;
  reloadFinancialReport: () => Promise<void>;
  flash: (msg: string, kind?: "ok" | "error") => void;
  flashAfterJobDelete: (res: {
    ok: true;
    clearedFinancialTx: number;
    clearedEarnings: number;
  }) => void;
  renderDashboard: () => void;
  getView: () => string;
  onJobCreated: (jobDate: string) => void;
  onCalPrev: () => void;
  onCalNext: () => void;
};

function parseTriState(v: string): "" | "yes" | "no" {
  const x = v.trim().toLowerCase();
  if (x === "yes" || x === "no") return x;
  return "";
}

export function readJobsFiltersFromDom(root: HTMLElement): JobsLedgerFilters {
  const pf = root.querySelector("#jobs-filter-promoter") as HTMLSelectElement | null;
  const cf = root.querySelector("#jobs-filter-club") as HTMLSelectElement | null;
  const tf = root.querySelector("#jobs-filter-job-type") as HTMLSelectElement | null;
  const sf = root.querySelector("#jobs-filter-status") as HTMLSelectElement | null;
  const ac = root.querySelector("#jobs-filter-adminConfirmed") as HTMLSelectElement | null;
  const pd = root.querySelector("#jobs-filter-paid") as HTMLSelectElement | null;
  const bv = root.querySelector("#jobs-filter-bonusValid") as HTMLSelectElement | null;
  return {
    promoterId: pf?.value.trim() ?? "",
    clubSlug: cf?.value.trim() ?? "",
    jobType: tf?.value.trim() ?? "",
    status: sf?.value.trim() ?? "",
    adminConfirmed: parseTriState(ac?.value ?? ""),
    paid: parseTriState(pd?.value ?? ""),
    bonusValid: parseTriState(bv?.value ?? ""),
  };
}

function jobFromForm(fd: FormData, existing?: PromoterJob): PromoterJob {
  const jobType = String(fd.get("jobType") || existing?.jobType || "guestlist").trim() as PromoterJobType;
  const clubRaw = String(fd.get("clubSlug") || "").trim();
  return {
    id: existing?.id ?? "",
    promoterId: existing?.promoterId ?? "",
    clubSlug: clubRaw ? clubRaw : null,
    service: jobTypeToService(jobType),
    jobType,
    jobDate: String(fd.get("jobDate") || existing?.jobDate || "").trim(),
    status: (String(fd.get("status") || existing?.status || "assigned").trim() ||
      "assigned") as PromoterJob["status"],
    guestsCount: Number(fd.get("guestsCount") ?? existing?.guestsCount ?? 0) || 0,
    shiftFee: Number(fd.get("shiftFee") ?? existing?.shiftFee ?? 0) || 0,
    guestlistFee: Number(fd.get("guestlistFee") ?? existing?.guestlistFee ?? 0) || 0,
    clientId: String(fd.get("clientId") || "").trim() || null,
    adminConfirmed: fd.get("adminConfirmed") === "on",
    paid: fd.get("paid") === "on",
    maleCount: Number(fd.get("maleCount") ?? existing?.maleCount ?? 0) || 0,
    femaleCount: Number(fd.get("femaleCount") ?? existing?.femaleCount ?? 0) || 0,
    guestsJoined: Number(fd.get("guestsJoined") ?? existing?.guestsJoined ?? 0) || 0,
    guestsEntered: Number(fd.get("guestsEntered") ?? existing?.guestsEntered ?? 0) || 0,
    ticketsSold: Number(fd.get("ticketsSold") ?? existing?.ticketsSold ?? 0) || 0,
    grossSpendGbp: Number(fd.get("grossSpendGbp") ?? existing?.grossSpendGbp ?? 0) || 0,
    netSpendGbp: existing?.netSpendGbp ?? 0,
    conciergeCutGbp: existing?.conciergeCutGbp ?? 0,
    promoterCutGbp: existing?.promoterCutGbp ?? 0,
    bonusValid: existing?.bonusValid ?? true,
    rateOverride: existing?.rateOverride ?? {},
    notes: String(fd.get("notes") || "").trim(),
    clubPaymentRateId: String(fd.get("clubPaymentRateId") || "").trim() || null,
    financialBookingId: existing?.financialBookingId ?? null,
  };
}

function updatePatchFromJob(
  job: PromoterJob,
  rates: FinancialClubPaymentRate[],
  syncFinancials: boolean,
): Parameters<typeof updatePromoterJob>[2] {
  const patch: Parameters<typeof updatePromoterJob>[2] = {
    club_slug: job.clubSlug,
    job_type: job.jobType,
    job_date: job.jobDate,
    status: job.status,
    guests_count: job.guestsCount,
    shift_fee: job.shiftFee,
    guestlist_fee: job.guestlistFee,
    client_id: job.clientId,
    admin_confirmed: job.adminConfirmed,
    paid: job.paid,
    male_count: job.maleCount,
    female_count: job.femaleCount,
    guests_joined: job.guestsJoined,
    guests_entered: job.guestsEntered,
    tickets_sold: job.ticketsSold,
    gross_spend_gbp: job.grossSpendGbp,
    notes: job.notes,
    club_payment_rate_id: job.clubPaymentRateId,
  };
  if (syncFinancials) {
    const fin = financialDbPatchForJob(job, rates);
    patch.net_spend_gbp = fin.net_spend_gbp;
    patch.concierge_cut_gbp = fin.concierge_cut_gbp;
    patch.promoter_cut_gbp = fin.promoter_cut_gbp;
    patch.bonus_valid = fin.bonus_valid;
    if (fin.club_payment_rate_id) {
      patch.club_payment_rate_id = fin.club_payment_rate_id;
    }
  }
  return patch;
}

export function bindJobsLedgerEvents(ctx: JobsBindCtx): void {
  const { adminRoot } = ctx;

  adminRoot.querySelector("#jobs-cal-prev")?.addEventListener("click", () => {
    ctx.setSelectedJobId(null);
    ctx.onCalPrev();
  });

  adminRoot.querySelector("#jobs-cal-next")?.addEventListener("click", () => {
    ctx.setSelectedJobId(null);
    ctx.onCalNext();
  });

  adminRoot.querySelector("#jobs-filter-apply")?.addEventListener("click", () => {
    ctx.setFilters(ctx.readFiltersFromDom());
    void ctx.reloadJobs().then(() => ctx.renderDashboard());
  });

  adminRoot.querySelector("#jobs-filter-reset")?.addEventListener("click", () => {
    ctx.setFilters(defaultJobsLedgerFilters());
    void ctx.reloadJobs().then(() => ctx.renderDashboard());
  });

  const openJob = (id: string) => {
    ctx.setSelectedJobId(id);
    ctx.renderDashboard();
  };

  adminRoot.querySelectorAll("[data-open-job-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = (btn as HTMLButtonElement).dataset.openJobEdit?.trim();
      if (id) openJob(id);
    });
  });

  const quickPatch = (jobId: string, patch: Parameters<typeof updatePromoterJob>[2]) => {
    void (async () => {
      const res = await updatePromoterJob(ctx.supabase, jobId, patch);
      if (!res.ok) {
        ctx.flash(`Update failed: ${res.message}`, "error");
        return;
      }
      await ctx.reloadJobs();
      ctx.flash("Job updated.");
      ctx.renderDashboard();
    })();
  };

  adminRoot.querySelectorAll("[data-job-quick-confirm]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = (btn as HTMLButtonElement).dataset.jobQuickConfirm?.trim();
      if (id) quickPatch(id, { admin_confirmed: true });
    });
  });

  adminRoot.querySelectorAll("[data-job-mark-paid]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = (btn as HTMLButtonElement).dataset.jobMarkPaid?.trim();
      if (id) quickPatch(id, { paid: true });
    });
  });

  adminRoot.querySelector("#admin-job-quick-confirm")?.addEventListener("click", () => {
    const id = ctx.getSelectedJobId();
    if (id) quickPatch(id, { admin_confirmed: true });
  });

  adminRoot.querySelector("#admin-job-mark-paid")?.addEventListener("click", () => {
    const id = ctx.getSelectedJobId();
    if (id) quickPatch(id, { paid: true });
  });

  adminRoot.querySelectorAll("[data-job-delete]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = (btn as HTMLButtonElement).dataset.jobDelete?.trim();
      if (!id) return;
      if (
        !globalThis.confirm(
          "Delete this job? Guestlist rows on this job will be removed. If the job was completed, linked payout expense and earning rows will be removed too.",
        )
      )
        return;
      void deleteJobById(ctx, id);
    });
  });

  adminRoot.querySelector("#admin-job-edit-delete")?.addEventListener("click", () => {
    const fromForm = adminRoot.querySelector(
      '#admin-job-edit-form input[name="jobId"]',
    ) as HTMLInputElement | null;
    const fromRo = adminRoot.querySelector("#admin-job-edit-id") as HTMLInputElement | null;
    const jobId = (fromForm?.value ?? fromRo?.value ?? "").trim();
    if (!jobId) return;
    if (
      !globalThis.confirm(
        "Delete this job permanently? Guestlist rows will be removed. If it was completed, linked payout expense and earning rows will be removed as well.",
      )
    )
      return;
    void deleteJobById(ctx, jobId);
  });

  adminRoot.querySelector("#admin-job-refresh-headcount")?.addEventListener("click", () => {
    const id = ctx.getSelectedJobId();
    if (!id) return;
    void (async () => {
      const res = await refreshPromoterJobHeadcountFromGuestlist(ctx.supabase, id);
      if (!res.ok) {
        ctx.flash(`Headcount refresh failed: ${res.message}`, "error");
        return;
      }
      const row = ctx.getJobsCalendarRows().find((j) => j.id === id);
      if (row) {
        const job: PromoterJob = {
          ...row,
          guestsJoined: res.guestsJoined,
          guestsEntered: res.guestsEntered,
          maleCount: res.maleCount,
          femaleCount: res.femaleCount,
          guestsCount: Math.max(res.guestsEntered, res.guestsJoined),
        };
        const fin = financialDbPatchForJob(job, ctx.getRates());
        await updatePromoterJob(ctx.supabase, id, {
          guests_joined: res.guestsJoined,
          guests_entered: res.guestsEntered,
          male_count: res.maleCount,
          female_count: res.femaleCount,
          guests_count: job.guestsCount,
          ...fin,
        });
      }
      await ctx.reloadJobs();
      ctx.flash("Headcount refreshed from guestlist.");
      ctx.renderDashboard();
    })();
  });

  adminRoot.querySelector("#admin-job-edit-save")?.addEventListener("click", () => {
    const form = adminRoot.querySelector("#admin-job-edit-form") as HTMLFormElement | null;
    if (!form) return;
    const fd = new FormData(form);
    const jobId = String(fd.get("jobId") || "").trim();
    if (!jobId) return;
    const existing = ctx.getJobsCalendarRows().find((j) => j.id === jobId);
    const job = jobFromForm(fd, existing);
    const rawSt = String(fd.get("status") || "assigned").trim();
    job.status = rawSt === "cancelled" ? "cancelled" : "assigned";
    void (async () => {
      const res = await updatePromoterJob(
        ctx.supabase,
        jobId,
        updatePatchFromJob(job, ctx.getRates(), false),
      );
      if (!res.ok) {
        ctx.flash(`Save failed: ${res.message}`, "error");
        return;
      }
      await ctx.reloadJobs();
      ctx.flash("Job saved.");
      ctx.renderDashboard();
    })();
  });

  adminRoot.querySelector("#admin-job-edit-complete")?.addEventListener("click", () => {
    const form = adminRoot.querySelector("#admin-job-edit-form") as HTMLFormElement | null;
    if (!form) return;
    const jobId = String(new FormData(form).get("jobId") || "").trim();
    if (!jobId) return;
    void (async () => {
      const fd = new FormData(form);
      const existing = ctx.getJobsCalendarRows().find((j) => j.id === jobId);
      const job = jobFromForm(fd, existing);
      job.status = "completed";
      const pre = await updatePromoterJob(
        ctx.supabase,
        jobId,
        updatePatchFromJob(job, ctx.getRates(), true),
      );
      if (!pre.ok) {
        ctx.flash(`Save before complete failed: ${pre.message}`, "error");
        return;
      }
      const res = await completePromoterJob(ctx.supabase, jobId);
      if (!res.ok) {
        ctx.flash(`Complete job failed: ${res.message}`, "error");
        return;
      }
      ctx.setSelectedJobId(null);
      await ctx.reloadPromoters();
      await ctx.reloadJobs();
      await ctx.reloadFinancialReport();
      ctx.flash("Job completed and earnings recorded.");
      ctx.renderDashboard();
    })();
  });

  adminRoot.querySelectorAll("[data-job-complete]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = (btn as HTMLButtonElement).dataset.jobComplete?.trim();
      if (!id) return;
      void (async () => {
        const row = ctx.getJobsCalendarRows().find((j) => j.id === id);
        if (row) {
          const fin = financialDbPatchForJob(row, ctx.getRates());
          await updatePromoterJob(ctx.supabase, id, fin);
        }
        const res = await completePromoterJob(ctx.supabase, id);
        if (!res.ok) {
          ctx.flash(`Complete job failed: ${res.message}`, "error");
          return;
        }
        ctx.setSelectedJobId(null);
        await ctx.reloadPromoters();
        await ctx.reloadJobs();
        await ctx.reloadFinancialReport();
        ctx.flash("Job completed and earnings recorded.");
        ctx.renderDashboard();
      })();
    });
  });

  bindJobsCreateForm(ctx);
}

async function deleteJobById(ctx: JobsBindCtx, id: string): Promise<void> {
  const res = await deletePromoterJob(ctx.supabase, id);
  if (!res.ok) {
    ctx.flash(`Delete failed: ${res.message}`, "error");
    return;
  }
  ctx.setSelectedJobId(null);
  await ctx.reloadPromoters();
  await ctx.reloadJobs();
  await ctx.reloadFinancialReport();
  ctx.flashAfterJobDelete(res);
  ctx.renderDashboard();
}

function bindJobsCreateForm(ctx: JobsBindCtx): void {
  const { adminRoot } = ctx;

  adminRoot.querySelector("#promoter-job-create")?.addEventListener("click", () => {
    const form = adminRoot.querySelector("#promoter-job-form") as HTMLFormElement | null;
    if (!form) return;
    const fd = new FormData(form);
    const promoterId = String(fd.get("promoterId") || "").trim();
    const clubSlug = String(fd.get("clubSlug") || "").trim();
    const jobDate = String(fd.get("jobDate") || "").trim();
    const jobType = String(fd.get("jobType") || "guestlist").trim() as PromoterJobType;
    const status = String(fd.get("status") || "assigned").trim() as PromoterJob["status"];
    if (!promoterId || !jobDate) {
      ctx.flash("Promoter and date are required.", "error");
      return;
    }
    void (async () => {
      let clientId = String(fd.get("clientId") || "").trim() || null;
      const resolvedClients: Array<{ name: string; contact: string }> = [];
      for (const item of ctx.getCreateJobClients()) {
        if (item.mode === "existing") {
          if (item.name.trim()) {
            resolvedClients.push({ name: item.name.trim(), contact: item.contact.trim() });
          }
          continue;
        }
        if (item.mode === "blank") {
          const blank = await createEmptyClient(ctx.supabase);
          if (!blank.ok) {
            ctx.flash(`Create client failed: ${blank.message}`, "error");
            return;
          }
          await ctx.reloadClients();
          const c = ctx.getClients().find((x) => x.id === blank.id);
          resolvedClients.push({ name: String(c?.name || "New client").trim(), contact: "" });
          if (!clientId) clientId = blank.id;
          continue;
        }
        const created = await createEmptyClient(ctx.supabase);
        if (!created.ok) {
          ctx.flash(`Create client failed: ${created.message}`, "error");
          return;
        }
        const newName = String(item.name || "").trim() || "New client";
        const newEmail = String(item.newEmail || "").trim() || null;
        const newPhone = String(item.newPhone || "").trim() || null;
        const upd = await updateClientById(ctx.supabase, created.id, {
          name: newName,
          email: newEmail,
          phone: newPhone,
          instagram: null,
          notes: null,
          typical_spend_gbp: null,
          preferred_nights: null,
          preferred_promoter_id: promoterId || null,
          preferred_club_slug: null,
        });
        if (!upd.ok) {
          ctx.flash(`Update client failed: ${upd.message}`, "error");
          return;
        }
        resolvedClients.push({ name: newName, contact: String(newPhone || newEmail || "").trim() });
        if (!clientId) clientId = created.id;
      }
      const clientName = resolvedClients.map((c) => c.name).filter(Boolean).join("; ");
      const clientContact = resolvedClients.map((c) => c.contact).filter(Boolean).join("; ");
      const rates = ctx.getRates();
      const rateId =
        clubSlug && rates.length
          ? resolveDefaultClubPaymentRateId(clubSlug, jobDate, jobType, rates)
          : null;
      const guestsCount = Number(fd.get("guestCount") || 0) || 0;
      const res = await createPromoterJob(ctx.supabase, {
        promoter_id: promoterId,
        club_slug: clubSlug || null,
        job_type: jobType,
        job_date: jobDate,
        status,
        client_name: clientName,
        client_contact: clientContact,
        client_id: clientId,
        shift_fee: Number(fd.get("shiftFee") || 0) || 0,
        guestlist_fee: Number(fd.get("guestFee") || 0) || 0,
        guests_count: guestsCount,
        gross_spend_gbp: Number(fd.get("grossSpendGbp") || 0) || 0,
        tickets_sold: Number(fd.get("ticketsSold") || 0) || 0,
        club_payment_rate_id: rateId,
        notes: String(fd.get("notes") || "").trim(),
      });
      if (!res.ok) {
        ctx.flash(`Create job failed: ${res.message}`, "error");
        return;
      }
      if (status === "completed" && res.id) {
        const fin = financialDbPatchForJob(
          {
            id: res.id,
            promoterId,
            clubSlug: clubSlug || null,
            service: jobTypeToService(jobType),
            jobType,
            jobDate,
            status,
            guestsCount,
            shiftFee: Number(fd.get("shiftFee") || 0) || 0,
            guestlistFee: Number(fd.get("guestFee") || 0) || 0,
            adminConfirmed: false,
            paid: false,
            maleCount: 0,
            femaleCount: 0,
            guestsJoined: guestsCount,
            guestsEntered: guestsCount,
            ticketsSold: Number(fd.get("ticketsSold") || 0) || 0,
            grossSpendGbp: Number(fd.get("grossSpendGbp") || 0) || 0,
            netSpendGbp: 0,
            conciergeCutGbp: 0,
            promoterCutGbp: 0,
            bonusValid: true,
            rateOverride: {},
            notes: "",
            clubPaymentRateId: rateId,
          },
          rates,
        );
        await updatePromoterJob(ctx.supabase, res.id, fin);
        await completePromoterJob(ctx.supabase, res.id);
      }
      ctx.onJobCreated(jobDate);
      await ctx.reloadPromoters();
      if (ctx.getView() === "jobs") await ctx.reloadJobs();
      ctx.setCreateJobClients([]);
      ctx.flash("Job created.");
      ctx.renderDashboard();
    })();
  });

  adminRoot.querySelector("[name=clientMode]")?.addEventListener("change", () => {
    const form = adminRoot.querySelector("#promoter-job-form") as HTMLFormElement | null;
    if (!form) return;
    const mode = String(new FormData(form).get("clientMode") || "existing").trim();
    const findBlock = adminRoot.querySelector(
      "#admin-job-find-client-block",
    ) as HTMLElement | null;
    const newName = adminRoot.querySelector("#admin-job-new-client-name") as HTMLElement | null;
    const newEmail = adminRoot.querySelector("#admin-job-new-client-email") as HTMLElement | null;
    const newPhone = adminRoot.querySelector("#admin-job-new-client-phone") as HTMLElement | null;
    const showNew = mode === "new";
    if (findBlock) findBlock.hidden = mode !== "existing";
    if (newName) newName.hidden = !showNew;
    if (newEmail) newEmail.hidden = !showNew;
    if (newPhone) newPhone.hidden = !showNew;
  });

  adminRoot.querySelector("[name=clientSearch]")?.addEventListener("input", (ev) => {
    const q = String((ev.target as HTMLInputElement).value || "").trim().toLowerCase();
    const sel = adminRoot.querySelector("[name=existingClientId]") as HTMLSelectElement | null;
    if (!sel) return;
    const filtered = ctx.getClients().filter((c) => {
      const hay = `${c.name || ""} ${c.email || ""} ${c.phone || ""}`.toLowerCase();
      return !q || hay.includes(q);
    });
    sel.innerHTML = `<option value="">(none)</option>${filtered
      .map(
        (c) =>
          `<option value="${c.id}">${(c.name || c.email || c.phone || c.id.slice(0, 8)).replace(/</g, "&lt;")}</option>`,
      )
      .join("")}`;
  });

  adminRoot.querySelector("#admin-job-add-client")?.addEventListener("click", () => {
    const form = adminRoot.querySelector("#promoter-job-form") as HTMLFormElement | null;
    if (!form) return;
    const fd = new FormData(form);
    const mode = String(fd.get("clientMode") || "existing").trim();
    const rows = [...ctx.getCreateJobClients()];
    if (mode === "existing") {
      const existingId = String(fd.get("existingClientId") || "").trim();
      const c = ctx.getClients().find((x) => x.id === existingId);
      rows.push({
        mode: "existing",
        name: String(c?.name || "").trim(),
        contact: String(c?.email || c?.phone || "").trim(),
      });
    } else if (mode === "blank") {
      rows.push({ mode: "blank", name: "New client", contact: "" });
    } else {
      rows.push({
        mode: "new",
        name: String(fd.get("newClientName") || "").trim(),
        contact: "",
        newEmail: String(fd.get("newClientEmail") || "").trim(),
        newPhone: String(fd.get("newClientPhone") || "").trim(),
      });
    }
    ctx.setCreateJobClients(rows);
    ctx.renderDashboard();
  });

  adminRoot.querySelectorAll("[data-admin-job-remove-client]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number((btn as HTMLButtonElement).dataset.adminJobRemoveClient);
      if (!Number.isFinite(idx)) return;
      const rows = [...ctx.getCreateJobClients()];
      rows.splice(idx, 1);
      ctx.setCreateJobClients(rows);
      ctx.renderDashboard();
    });
  });
}
