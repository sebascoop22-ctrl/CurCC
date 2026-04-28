import { escHtml } from "./html";

export interface PortalEmptyStateOptions {
  title: string;
  description?: string;
  icon?: string;
  /** HTML for an action button or link. */
  actionHtml?: string;
}

export function renderEmptyState(opts: PortalEmptyStateOptions): string {
  return `<div class="pp-empty">
    <div class="pp-empty__icon" aria-hidden="true">${escHtml(opts.icon ?? "◌")}</div>
    <h3 class="pp-empty__title">${escHtml(opts.title)}</h3>
    ${opts.description ? `<p class="pp-empty__desc">${escHtml(opts.description)}</p>` : ""}
    ${opts.actionHtml ? `<div class="pp-empty__action">${opts.actionHtml}</div>` : ""}
  </div>`;
}
