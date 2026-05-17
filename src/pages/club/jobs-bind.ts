import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decideClubJob,
  submitJobDispute,
  type ClubPortalJobRow,
} from "../../admin/clubs";
import {
  buildClubDisputeEvidence,
  disputeDescriptionWithHeadcount,
} from "./jobs-view";

export type ClubJobsBindCtx = {
  root: HTMLElement;
  supabase: SupabaseClient;
  getJobs: () => ClubPortalJobRow[];
  getSelectedJobId: () => string | null;
  setSelectedJobId: (id: string | null) => void;
  reload: () => Promise<void>;
  flash: (msg: string, bad?: boolean) => void;
};

export function bindClubJobsEvents(ctx: ClubJobsBindCtx): void {
  const { root } = ctx;

  root.querySelectorAll("[data-club-job-id]").forEach((row) => {
    row.addEventListener("click", () => {
      const id = (row as HTMLElement).dataset.clubJobId?.trim();
      if (!id) return;
      ctx.setSelectedJobId(id);
      void ctx.reload();
    });
  });

  root.querySelectorAll("[data-job-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const jobId = (btn as HTMLElement).dataset.jobAction?.trim();
      const decision = (btn as HTMLElement).dataset.decision?.trim() as "approve" | "deny";
      if (!jobId || (decision !== "approve" && decision !== "deny")) return;
      const noteEl = root.querySelector("#club-job-note") as HTMLTextAreaElement | null;
      const note = String(noteEl?.value ?? "").trim();
      void (async () => {
        const res = await decideClubJob(ctx.supabase, jobId, decision, note);
        ctx.flash(res.ok ? `Job ${decision}d.` : res.message, !res.ok);
        await ctx.reload();
      })();
    });
  });

  root.querySelector("#club-job-dispute-form")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const jobId = ctx.getSelectedJobId();
    if (!jobId) return;
    const job = ctx.getJobs().find((j) => j.id === jobId);
    if (!job) return;
    const fd = new FormData(ev.target as HTMLFormElement);
    const reasonCode = String(fd.get("reasonCode") || "club_dispute").trim();
    const description = String(fd.get("description") || "").trim();
    void (async () => {
      const res = await submitJobDispute(ctx.supabase, {
        promoterJobId: jobId,
        reasonCode,
        description: disputeDescriptionWithHeadcount(job, description, reasonCode),
        evidence: buildClubDisputeEvidence(job),
      });
      ctx.flash(res.ok ? "Dispute raised." : res.message, !res.ok);
      await ctx.reload();
    })();
  });
}
