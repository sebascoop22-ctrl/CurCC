import { escAttr, escHtml } from "./html";
import { renderEmptyState } from "./empty-state";

export interface PortalDataTableColumn<TRow> {
  key: string;
  label: string;
  /** If true, header becomes clickable and emits sort changes. */
  sortable?: boolean;
  /** Custom cell renderer (returns trusted HTML). */
  render?: (row: TRow, index: number) => string;
  /** Plain-text accessor for sort & default rendering. */
  accessor?: (row: TRow) => string | number | null | undefined;
  /** CSS width preset (e.g., "120px", "1fr"). */
  width?: string;
  /** Right-align numeric columns. */
  align?: "left" | "right" | "center";
}

export interface PortalDataTableEmptyState {
  title: string;
  description?: string;
  icon?: string;
  actionHtml?: string;
}

export interface PortalDataTableOptions<TRow> {
  /** Stable id used in DOM attributes. */
  id: string;
  rows: TRow[];
  columns: PortalDataTableColumn<TRow>[];
  /** Default page size if pagination is enabled. */
  pageSize?: number;
  /** Available page sizes. Defaults to [10, 25, 50, 100]. */
  pageSizeOptions?: number[];
  /** Disable pagination entirely. */
  paginated?: boolean;
  /** Optional row-id getter used for active-row highlighting. */
  rowId?: (row: TRow) => string;
  /** Currently selected row id (for highlight). */
  activeRowId?: string | null;
  /** Called when a row is clicked. */
  onRowClick?: (row: TRow, index: number) => void;
  /** Loading state replaces rows with skeleton. */
  loading?: boolean;
  /** Empty-state options when rows is empty and not loading. */
  empty?: PortalDataTableEmptyState;
  /** Initial sort column key + direction. */
  initialSort?: { key: string; dir: "asc" | "desc" };
}

interface DataTableState {
  page: number;
  pageSize: number;
  sortKey: string | null;
  sortDir: "asc" | "desc";
}

export interface PortalDataTableHandle {
  /** Replace rows in place. */
  setRows<TRow>(rows: TRow[]): void;
  /** Re-render with the original options. */
  refresh(): void;
  /** Detach from the DOM. */
  destroy(): void;
}

export function mountDataTable<TRow>(
  parent: HTMLElement,
  options: PortalDataTableOptions<TRow>,
): PortalDataTableHandle {
  const root = document.createElement("div");
  root.className = "pp-table";
  root.setAttribute("data-pp-table", options.id);
  parent.appendChild(root);

  const state: DataTableState = {
    page: 1,
    pageSize: options.pageSize ?? 25,
    sortKey: options.initialSort?.key ?? null,
    sortDir: options.initialSort?.dir ?? "asc",
  };
  const pageSizeOptions = options.pageSizeOptions ?? [10, 25, 50, 100];
  let workingRows: TRow[] = options.rows.slice();

  function compareValues(a: unknown, b: unknown): number {
    if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
    if (b === null || b === undefined) return 1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  }

  function sortedRows(): TRow[] {
    if (!state.sortKey) return workingRows;
    const col = options.columns.find((c) => c.key === state.sortKey);
    if (!col) return workingRows;
    const accessor = col.accessor ?? ((row: TRow) => (row as Record<string, unknown>)[col.key] as string | number | null | undefined);
    const arr = workingRows.slice();
    arr.sort((a, b) => {
      const cmp = compareValues(accessor(a), accessor(b));
      return state.sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }

  function paged(rows: TRow[]): TRow[] {
    if (options.paginated === false) return rows;
    const start = (state.page - 1) * state.pageSize;
    return rows.slice(start, start + state.pageSize);
  }

  function totalPages(rows: TRow[]): number {
    if (options.paginated === false) return 1;
    return Math.max(1, Math.ceil(rows.length / state.pageSize));
  }

  function defaultCell(row: TRow, col: PortalDataTableColumn<TRow>): string {
    const accessor = col.accessor ?? ((r: TRow) => (r as Record<string, unknown>)[col.key] as string | number | null | undefined);
    const value = accessor(row);
    return escHtml(value ?? "—");
  }

  function render(): void {
    const sorted = sortedRows();
    const pageRows = paged(sorted);
    const tp = totalPages(sorted);
    if (state.page > tp) state.page = tp;

    if (options.loading) {
      root.innerHTML = `
        <div class="pp-table__scroll">
          <table class="pp-table__el">
            <thead>${headerRow(false)}</thead>
            <tbody>
              ${Array.from({ length: 5 })
                .map(() => `<tr class="pp-table__row pp-table__row--skeleton">${options.columns.map(() => `<td><span class="pp-skel"></span></td>`).join("")}</tr>`)
                .join("")}
            </tbody>
          </table>
        </div>
      `;
      return;
    }

    if (!sorted.length) {
      root.innerHTML = renderEmptyState(
        options.empty ?? { title: "No records yet", description: "Items will appear here once available." },
      );
      return;
    }

    root.innerHTML = `
      <div class="pp-table__scroll">
        <table class="pp-table__el">
          <thead>${headerRow(true)}</thead>
          <tbody>
            ${pageRows
              .map((row, i) => {
                const id = options.rowId ? options.rowId(row) : "";
                const isActive =
                  options.activeRowId !== undefined &&
                  options.activeRowId !== null &&
                  id === options.activeRowId;
                const cells = options.columns
                  .map((col) => {
                    const align = col.align ? ` style="text-align:${col.align}"` : "";
                    const inner = col.render ? col.render(row, i) : defaultCell(row, col);
                    return `<td${align}>${inner}</td>`;
                  })
                  .join("");
                return `<tr class="pp-table__row${isActive ? " is-active" : ""}"${id ? ` data-pp-row-id="${escAttr(id)}"` : ""} data-pp-row-index="${i}">${cells}</tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      ${options.paginated === false ? "" : renderPagination(sorted.length, tp)}
    `;

    if (options.onRowClick) {
      root.querySelectorAll<HTMLTableRowElement>(".pp-table__row").forEach((tr) => {
        tr.addEventListener("click", () => {
          const idx = Number(tr.dataset.ppRowIndex || "0");
          const target = pageRows[idx];
          if (target && options.onRowClick) options.onRowClick(target, idx);
        });
      });
    }

    root.querySelectorAll<HTMLButtonElement>("[data-pp-sort-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.ppSortKey;
        if (!key) return;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = "asc";
        }
        render();
      });
    });

    root.querySelectorAll<HTMLButtonElement>("[data-pp-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.ppPage;
        if (action === "prev") state.page = Math.max(1, state.page - 1);
        else if (action === "next") state.page = Math.min(tp, state.page + 1);
        else if (action) state.page = Math.max(1, Math.min(tp, Number(action)));
        render();
      });
    });

    root.querySelector<HTMLSelectElement>("[data-pp-page-size]")?.addEventListener("change", (e) => {
      const v = Number((e.target as HTMLSelectElement).value);
      if (Number.isFinite(v) && v > 0) {
        state.pageSize = v;
        state.page = 1;
        render();
      }
    });
  }

  function headerRow(allowSort: boolean): string {
    return `<tr>${options.columns
      .map((col) => {
        const widthAttr = col.width ? ` style="width:${escAttr(col.width)}"` : "";
        const align = col.align ? ` style="text-align:${col.align}${col.width ? `;width:${escAttr(col.width)}` : ""}"` : widthAttr;
        if (col.sortable && allowSort) {
          const dir = state.sortKey === col.key ? state.sortDir : "";
          const arrow = dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕";
          return `<th${align}><button type="button" class="pp-table__sort${dir ? ` is-${dir}` : ""}" data-pp-sort-key="${escAttr(col.key)}">${escHtml(col.label)}<span class="pp-table__sort-arrow" aria-hidden="true">${arrow}</span></button></th>`;
        }
        return `<th${align}>${escHtml(col.label)}</th>`;
      })
      .join("")}</tr>`;
  }

  function renderPagination(total: number, tp: number): string {
    const start = (state.page - 1) * state.pageSize + 1;
    const end = Math.min(total, state.page * state.pageSize);
    const pageBtn = (n: number) =>
      `<button type="button" class="pp-table__page-btn${n === state.page ? " is-active" : ""}" data-pp-page="${n}">${n}</button>`;
    const pageNumbers: string[] = [];
    if (tp <= 7) {
      for (let i = 1; i <= tp; i++) pageNumbers.push(pageBtn(i));
    } else {
      pageNumbers.push(pageBtn(1));
      const left = Math.max(2, state.page - 1);
      const right = Math.min(tp - 1, state.page + 1);
      if (left > 2) pageNumbers.push(`<span class="pp-table__page-gap">…</span>`);
      for (let i = left; i <= right; i++) pageNumbers.push(pageBtn(i));
      if (right < tp - 1) pageNumbers.push(`<span class="pp-table__page-gap">…</span>`);
      pageNumbers.push(pageBtn(tp));
    }
    const sizes = pageSizeOptions
      .map((n) => `<option value="${n}"${n === state.pageSize ? " selected" : ""}>${n}</option>`)
      .join("");
    return `<footer class="pp-table__footer">
      <div class="pp-table__rowsize">
        <label>Rows per page <select data-pp-page-size class="pp-select pp-select--inline">${sizes}</select></label>
        <span class="pp-table__count">${start}-${end} of ${total}</span>
      </div>
      <div class="pp-table__pages">
        <button type="button" class="pp-table__page-btn" data-pp-page="prev" ${state.page === 1 ? "disabled" : ""}>‹</button>
        ${pageNumbers.join("")}
        <button type="button" class="pp-table__page-btn" data-pp-page="next" ${state.page === tp ? "disabled" : ""}>›</button>
      </div>
    </footer>`;
  }

  render();

  return {
    setRows<TNew>(rows: TNew[]): void {
      workingRows = rows as unknown as TRow[];
      state.page = 1;
      render();
    },
    refresh(): void {
      render();
    },
    destroy(): void {
      if (root.parentElement) root.parentElement.removeChild(root);
    },
  };
}
