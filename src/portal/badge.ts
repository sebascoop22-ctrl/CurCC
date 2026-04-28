import { escHtml } from "./html";

export type PortalBadgeVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "accent";

export interface PortalBadgeOptions {
  label: string;
  variant?: PortalBadgeVariant;
  /** Show a small leading dot. */
  dot?: boolean;
}

export function renderBadge(opts: PortalBadgeOptions): string {
  const variant = opts.variant ?? "neutral";
  const dot = opts.dot ? `<span class="pp-badge__dot" aria-hidden="true"></span>` : "";
  return `<span class="pp-badge pp-badge--${escHtml(variant)}">${dot}<span class="pp-badge__text">${escHtml(opts.label)}</span></span>`;
}

const STATUS_VARIANTS: Record<string, PortalBadgeVariant> = {
  pending: "warning",
  open: "warning",
  in_review: "info",
  under_review: "info",
  active: "success",
  approved: "success",
  resolved: "success",
  done: "success",
  completed: "success",
  paid: "success",
  rejected: "danger",
  denied: "danger",
  cancelled: "danger",
  failed: "danger",
  banned: "danger",
  inactive: "neutral",
  draft: "neutral",
  suspended: "warning",
  paused: "warning",
};

/** Convert a backend status string into a status pill. */
export function renderStatusBadge(status: string): string {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const variant = STATUS_VARIANTS[normalized] ?? "neutral";
  const label = String(status || "—").replace(/_/g, " ");
  return renderBadge({ label, variant, dot: true });
}
