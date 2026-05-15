import { escAttr, escHtml } from "../../portal/html";

export function renderBrowserTabBar(
  tabs: Array<{ id: string; label: string }>,
  activeId: string,
  dataAttrName: string,
): string {
  const buttons = tabs
    .map((t) => {
      const active = t.id === activeId;
      return `<button
        type="button"
        role="tab"
        class="admin-browser-tabs__tab${active ? " is-active" : ""}"
        aria-selected="${active ? "true" : "false"}"
        ${dataAttrName}="${escAttr(t.id)}"
      >${escHtml(t.label)}</button>`;
    })
    .join("");
  return `<div class="admin-browser-tabs" role="tablist">
    <div class="admin-browser-tabs__strip">${buttons}</div>
  </div>`;
}

export function renderEntityDetailChrome(input: {
  backLabel: string;
  backDataAttr: string;
  title: string;
  subtitle?: string;
  saveDataAttr: string;
  saveLabel?: string;
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  tabDataAttr: string;
  bodyHtml: string;
}): string {
  const tabBar = renderBrowserTabBar(input.tabs, input.activeTab, input.tabDataAttr);
  const subtitle = input.subtitle
    ? `<code class="admin-entity-detail__slug">${escHtml(input.subtitle)}</code>`
    : "";
  return `
    <div class="admin-entity-detail">
      <header class="admin-entity-detail__header">
        <div class="admin-entity-detail__header-left">
          <button type="button" class="cc-btn cc-btn--ghost admin-entity-detail__back" ${input.backDataAttr}>
            ${escHtml(input.backLabel)}
          </button>
          <div class="admin-entity-detail__identity">
            <h3 class="admin-entity-detail__title">${escHtml(input.title)}</h3>
            ${subtitle}
          </div>
        </div>
        <button type="button" class="cc-btn cc-btn--gold" ${input.saveDataAttr}>
          ${escHtml(input.saveLabel ?? "Save changes")}
        </button>
      </header>
      ${tabBar}
      <div class="admin-entity-tab-body" role="tabpanel">${input.bodyHtml}</div>
    </div>`;
}
