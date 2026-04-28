import { escAttr, escHtml } from "./html";

interface BaseFieldOptions {
  id?: string;
  name?: string;
  label?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  full?: boolean;
}

export interface PortalTextFieldOptions extends BaseFieldOptions {
  type?: "text" | "email" | "tel" | "url" | "password" | "number" | "date" | "search";
  value?: string | number;
  placeholder?: string;
  autocomplete?: string;
}

export interface PortalSelectOption {
  value: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
}

export interface PortalSelectFieldOptions extends BaseFieldOptions {
  options: PortalSelectOption[];
  value?: string;
  placeholder?: string;
}

export interface PortalTextareaOptions extends BaseFieldOptions {
  value?: string;
  placeholder?: string;
  rows?: number;
}

function fieldShell(
  inner: string,
  base: BaseFieldOptions,
): string {
  const cls = `pp-field${base.full ? " pp-field--full" : ""}`;
  const labelEl = base.label
    ? `<label class="pp-field__label"${base.id ? ` for="${escAttr(base.id)}"` : ""}>${escHtml(base.label)}${base.required ? ' <span class="pp-field__req" aria-hidden="true">*</span>' : ""}</label>`
    : "";
  const hint = base.hint ? `<p class="pp-field__hint">${escHtml(base.hint)}</p>` : "";
  return `<div class="${cls}">${labelEl}${inner}${hint}</div>`;
}

export function renderTextField(opts: PortalTextFieldOptions): string {
  const attrs = [
    `class="pp-input"`,
    `type="${escAttr(opts.type ?? "text")}"`,
    opts.id ? `id="${escAttr(opts.id)}"` : "",
    opts.name ? `name="${escAttr(opts.name)}"` : "",
    opts.value !== undefined ? `value="${escAttr(opts.value)}"` : "",
    opts.placeholder ? `placeholder="${escAttr(opts.placeholder)}"` : "",
    opts.autocomplete ? `autocomplete="${escAttr(opts.autocomplete)}"` : "",
    opts.required ? "required" : "",
    opts.disabled ? "disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return fieldShell(`<input ${attrs} />`, opts);
}

export function renderSelectField(opts: PortalSelectFieldOptions): string {
  const options = [
    opts.placeholder
      ? `<option value="" ${opts.value ? "" : "selected"}>${escHtml(opts.placeholder)}</option>`
      : "",
    ...opts.options.map(
      (o) =>
        `<option value="${escAttr(o.value)}"${(opts.value ?? "") === o.value || o.selected ? " selected" : ""}${o.disabled ? " disabled" : ""}>${escHtml(o.label)}</option>`,
    ),
  ]
    .filter(Boolean)
    .join("");
  const attrs = [
    `class="pp-select"`,
    opts.id ? `id="${escAttr(opts.id)}"` : "",
    opts.name ? `name="${escAttr(opts.name)}"` : "",
    opts.required ? "required" : "",
    opts.disabled ? "disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return fieldShell(`<select ${attrs}>${options}</select>`, opts);
}

export function renderTextarea(opts: PortalTextareaOptions): string {
  const attrs = [
    `class="pp-textarea"`,
    opts.id ? `id="${escAttr(opts.id)}"` : "",
    opts.name ? `name="${escAttr(opts.name)}"` : "",
    opts.placeholder ? `placeholder="${escAttr(opts.placeholder)}"` : "",
    opts.rows ? `rows="${escAttr(opts.rows)}"` : `rows="3"`,
    opts.required ? "required" : "",
    opts.disabled ? "disabled" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return fieldShell(
    `<textarea ${attrs}>${escHtml(opts.value ?? "")}</textarea>`,
    opts,
  );
}
