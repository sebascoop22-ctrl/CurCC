import { escHtml } from "./html";

export interface PortalKpiCardOptions {
  label: string;
  value: string | number;
  /** Optional descriptive subtext shown under the value. */
  hint?: string;
  /** Optional delta indicator (e.g., "+12 this week"). */
  delta?: string;
  deltaTone?: "up" | "down" | "flat";
  /** Single-character icon glyph shown top-right. */
  icon?: string;
  /** Optional accent emphasis for the entire card. */
  emphasis?: "default" | "accent" | "warning" | "danger";
}

export function renderKpiCard(opts: PortalKpiCardOptions): string {
  const emphasis = opts.emphasis ?? "default";
  const delta = opts.delta
    ? `<span class="pp-kpi__delta pp-kpi__delta--${escHtml(opts.deltaTone ?? "flat")}">${escHtml(opts.delta)}</span>`
    : "";
  const icon = opts.icon
    ? `<span class="pp-kpi__icon" aria-hidden="true">${escHtml(opts.icon)}</span>`
    : "";
  const hint = opts.hint
    ? `<p class="pp-kpi__hint">${escHtml(opts.hint)}</p>`
    : "";
  return `<article class="pp-kpi pp-kpi--${escHtml(emphasis)}">
    <header class="pp-kpi__header">
      <p class="pp-kpi__label">${escHtml(opts.label)}</p>
      ${icon}
    </header>
    <p class="pp-kpi__value">${escHtml(opts.value)}</p>
    ${hint}
    ${delta}
  </article>`;
}

export function renderKpiGrid(cards: PortalKpiCardOptions[]): string {
  if (!cards.length) return "";
  return `<div class="pp-kpi-grid">${cards.map(renderKpiCard).join("")}</div>`;
}
