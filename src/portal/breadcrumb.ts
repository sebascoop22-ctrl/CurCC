import { escHtml } from "./html";

export interface PortalBreadcrumbCrumb {
  label: string;
  /** If provided, renders an anchor; otherwise plain text. */
  href?: string;
}

export function renderBreadcrumbs(crumbs: PortalBreadcrumbCrumb[]): string {
  if (!crumbs.length) return "";
  return `<nav class="pp-breadcrumb" aria-label="Breadcrumb">
    <ol>${crumbs
      .map((c, i) => {
        const last = i === crumbs.length - 1;
        const inner = c.href && !last
          ? `<a href="${escHtml(c.href)}">${escHtml(c.label)}</a>`
          : `<span${last ? ' aria-current="page"' : ""}>${escHtml(c.label)}</span>`;
        return `<li>${inner}${last ? "" : `<span class="pp-breadcrumb__sep" aria-hidden="true">›</span>`}</li>`;
      })
      .join("")}</ol>
  </nav>`;
}
