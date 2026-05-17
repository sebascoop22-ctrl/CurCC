import type { SupabaseClient } from "@supabase/supabase-js";
import {
  completePromoterJob,
  insertPromoterGuestlistEntry,
  insertPromoterJobSelf,
  updatePromoterJobSelfCounts,
} from "../../admin/promoters";
import { jobTypeToService } from "../../lib/financial/job-type";
import type { PromoterJob } from "../../types";
import {
  defaultPromoterJobsFilters,
  type PromoterJobsFilters,
} from "./jobs-view";

export type PromoterJobsBindCtx = {
  root: HTMLElement;
  supabase: SupabaseClient;
  getProfileId: () => string;
  getJobs: () => PromoterJob[];
  getSelectedJobId: () => string | null;
  setSelectedJobId: (id: string | null) => void;
  getFilters: () => PromoterJobsFilters;
  setFilters: (f: PromoterJobsFilters) => void;
  reload: () => Promise<void>;
  flash: (msg: string, bad?: boolean) => void;
  renderDashboard: () => void;
};

function readFilters(form: HTMLFormElement): PromoterJobsFilters {
  const fd = new FormData(form);
  return {
    jobType: String(fd.get("jobType") ?? "").trim(),
    status: String(fd.get("status") ?? "").trim(),
    dateFrom: String(fd.get("dateFrom") ?? "").trim().slice(0, 10),
    dateTo: String(fd.get("dateTo") ?? "").trim().slice(0, 10),
  };
}

export function bindPromoterJobsEvents(ctx: PromoterJobsBindCtx): void {
  const { root } = ctx;

  root.querySelector("#promoter-jobs-filter-form")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const form = ev.target as HTMLFormElement;
    ctx.setFilters(readFilters(form));
    ctx.renderDashboard();
  });

  root.querySelectorAll("[data-promoter-job-id]").forEach((row) => {
    row.addEventListener("click", () => {
      const id = (row as HTMLElement).dataset.promoterJobId?.trim();
      if (!id) return;
      ctx.setSelectedJobId(id);
      ctx.renderDashboard();
    });
  });

  root.querySelector("#promoter-create-job-form")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target as HTMLFormElement);
    const jobType = String(fd.get("jobType") || "guestlist").trim() as PromoterJob["jobType"];
    const clientId = String(fd.get("clientId") || "").trim() || null;
    void (async () => {
      const res = await insertPromoterJobSelf(ctx.supabase, {
        clubSlug: String(fd.get("clubSlug") || "").trim(),
        jobDate: String(fd.get("jobDate") || "").trim(),
        jobType,
        service: jobTypeToService(jobType),
        status: String(fd.get("status") || "assigned").trim() as PromoterJob["status"],
        clientId,
        shiftFee: Number(fd.get("shiftFee") || 0) || 0,
        guestlistFee: Number(fd.get("guestlistFee") || 0) || 0,
        guestsCount: Number(fd.get("guestsCount") || 0) || 0,
        notes: String(fd.get("notes") || "").trim(),
      });
      if (!res.ok) {
        ctx.flash(res.message, true);
        return;
      }
      ctx.setSelectedJobId(res.id);
      await ctx.reload();
      ctx.flash("Job created.");
      ctx.renderDashboard();
    })();
  });

  root.querySelectorAll(".promoter-job-headcount-form").forEach((form) => {
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const jobId = (form as HTMLFormElement).dataset.jobId?.trim();
      if (!jobId) return;
      const fd = new FormData(form as HTMLFormElement);
      void (async () => {
        const res = await updatePromoterJobSelfCounts(ctx.supabase, jobId, {
          guestsJoined: Number(fd.get("guestsJoined") || 0) || 0,
          guestsEntered: Number(fd.get("guestsEntered") || 0) || 0,
          maleCount: Number(fd.get("maleCount") || 0) || 0,
          femaleCount: Number(fd.get("femaleCount") || 0) || 0,
          guestsCount: Number(fd.get("guestsCount") || 0) || 0,
          ticketsSold: Number(fd.get("ticketsSold") || 0) || 0,
          grossSpendGbp: Number(fd.get("grossSpendGbp") || 0) || 0,
        });
        if (!res.ok) {
          ctx.flash(res.message, true);
          return;
        }
        await ctx.reload();
        ctx.flash("Headcount saved.");
        ctx.renderDashboard();
      })();
    });
  });

  root.querySelectorAll("[data-promoter-job-complete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const jobId = (btn as HTMLElement).dataset.promoterJobComplete?.trim();
      if (!jobId) return;
      void (async () => {
        const res = await completePromoterJob(ctx.supabase, jobId);
        if (!res.ok) {
          ctx.flash(res.message, true);
          return;
        }
        await ctx.reload();
        ctx.flash("Job marked completed.");
        ctx.renderDashboard();
      })();
    });
  });

  root.querySelectorAll("form.promoter-gl-add-form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const jobId = (form as HTMLFormElement).dataset.addGlJob?.trim();
      if (!jobId) return;
      const fd = new FormData(form as HTMLFormElement);
      void (async () => {
        const res = await insertPromoterGuestlistEntry(ctx.supabase, {
          jobId,
          guestName: String(fd.get("guestName") || "").trim(),
          guestContact: String(fd.get("guestContact") || "").trim(),
        });
        if (!res.ok) {
          ctx.flash(res.message, true);
          return;
        }
        (form as HTMLFormElement).reset();
        await ctx.reload();
        ctx.flash("Guest submitted for review.");
        ctx.renderDashboard();
      })();
    });
  });
}

export { defaultPromoterJobsFilters };
