import { escAttr, escHtml } from "./html";

export interface PortalFilterChip {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  /** Currently selected value (empty string = no selection). */
  value?: string;
}

export interface PortalFilterBarOptions {
  search?: {
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
  };
  chips?: PortalFilterChip[];
  onChipChange?: (chipId: string, value: string) => void;
  /** Right-side action buttons (rendered as HTML). */
  actionsHtml?: string;
}

export interface PortalFilterBarHandle {
  destroy(): void;
}

export function mountFilterBar(
  parent: HTMLElement,
  options: PortalFilterBarOptions,
): PortalFilterBarHandle {
  const root = document.createElement("div");
  root.className = "pp-filterbar";
  parent.appendChild(root);

  const searchHtml = options.search
    ? `<div class="pp-filterbar__search">
        <span class="pp-filterbar__search-icon" aria-hidden="true">⌕</span>
        <input
          type="search"
          class="pp-input pp-filterbar__search-input"
          placeholder="${escAttr(options.search.placeholder ?? "Search")}"
          value="${escAttr(options.search.value ?? "")}"
        />
      </div>`
    : "";

  const chipsHtml = (options.chips ?? [])
    .map((chip) => {
      const opts = chip.options
        .map(
          (o) => `<option value="${escAttr(o.value)}"${(chip.value ?? "") === o.value ? " selected" : ""}>${escHtml(o.label)}</option>`,
        )
        .join("");
      return `<label class="pp-filterbar__chip">
        <span class="pp-filterbar__chip-label">${escHtml(chip.label)}</span>
        <select class="pp-select pp-select--inline" data-pp-chip="${escAttr(chip.id)}"><option value="">All</option>${opts}</select>
      </label>`;
    })
    .join("");

  root.innerHTML = `
    <div class="pp-filterbar__left">
      ${searchHtml}
      ${chipsHtml}
    </div>
    <div class="pp-filterbar__right">${options.actionsHtml ?? ""}</div>
  `;

  if (options.search?.onChange) {
    const input = root.querySelector(".pp-filterbar__search-input") as HTMLInputElement | null;
    let timer: number | null = null;
    input?.addEventListener("input", () => {
      const value = input.value;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        options.search?.onChange?.(value);
      }, 160);
    });
  }

  if (options.onChipChange) {
    root.querySelectorAll<HTMLSelectElement>("[data-pp-chip]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const id = sel.dataset.ppChip ?? "";
        options.onChipChange?.(id, sel.value);
      });
    });
  }

  return {
    destroy(): void {
      if (root.parentElement) root.parentElement.removeChild(root);
    },
  };
}
