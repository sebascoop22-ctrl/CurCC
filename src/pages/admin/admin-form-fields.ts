import { escAttr, escHtml } from "../../portal/html";

export type AdminFieldCol =
  | "full"
  | "pp-col-2"
  | "pp-col-3"
  | "pp-col-4"
  | "pp-col-5"
  | "pp-col-6"
  | "pp-col-8"
  | "pp-col-12";

type BaseFieldOpts = {
  name: string;
  label: string;
  value?: string | number | boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  col?: AdminFieldCol;
  id?: string;
  readonly?: boolean;
  disabled?: boolean;
};

function colClass(col?: AdminFieldCol): string {
  return col === "full" ? "full" : col || "pp-col-6";
}

function fieldShell(opts: BaseFieldOpts, control: string): string {
  const id = opts.id || opts.name;
  const hint = opts.hint
    ? `<span class="cc-field__hint" id="${escAttr(id)}-hint">${escHtml(opts.hint)}</span>`
    : "";
  return `<div class="cc-field ${colClass(opts.col)}">
      <label for="${escAttr(id)}">${escHtml(opts.label)}</label>
      ${hint}
      ${control}
    </div>`;
}


function attrs(parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function adminFieldText(
  opts: BaseFieldOpts & {
    type?: "text" | "search" | "password";
    autocomplete?: string;
    inputmode?: string;
    pattern?: string;
    minlength?: number;
    maxlength?: number;
  },
): string {
  const id = opts.id || opts.name;
  const control = `<input
    id="${escAttr(id)}"
    name="${escAttr(opts.name)}"
    type="${opts.type || "text"}"
    class="cc-input"
    value="${escAttr(String(opts.value ?? ""))}"
    ${attrs([
      opts.required ? "required" : "",
      opts.readonly ? "readonly" : "",
      opts.disabled ? "disabled" : "",
      opts.placeholder ? `placeholder="${escAttr(opts.placeholder)}"` : "",
      opts.autocomplete ? `autocomplete="${escAttr(opts.autocomplete)}"` : "",
      opts.inputmode ? `inputmode="${escAttr(opts.inputmode)}"` : "",
      opts.pattern ? `pattern="${escAttr(opts.pattern)}"` : "",
      opts.minlength != null ? `minlength="${opts.minlength}"` : "",
      opts.maxlength != null ? `maxlength="${opts.maxlength}"` : "",
      opts.hint ? `aria-describedby="${escAttr(id)}-hint"` : "",
    ])}
  />`;
  return fieldShell(opts, control);
}

export function adminFieldEmail(opts: BaseFieldOpts): string {
  return adminFieldText({ ...opts, autocomplete: "email", inputmode: "email" });
}

export function adminFieldUrl(opts: BaseFieldOpts): string {
  return adminFieldText({
    ...opts,
    autocomplete: "url",
    placeholder: opts.placeholder ?? "https://",
  });
}

export function adminFieldTel(opts: BaseFieldOpts): string {
  return adminFieldText({ ...opts, autocomplete: "tel", inputmode: "tel" });
}

export function adminFieldNumber(
  opts: BaseFieldOpts & { min?: number; max?: number; step?: number | string },
): string {
  const id = opts.id || opts.name;
  const control = `<input
    id="${escAttr(id)}"
    name="${escAttr(opts.name)}"
    type="number"
    class="cc-input"
    value="${escAttr(String(opts.value ?? ""))}"
    ${attrs([
      opts.required ? "required" : "",
      opts.readonly ? "readonly" : "",
      opts.disabled ? "disabled" : "",
      opts.placeholder ? `placeholder="${escAttr(opts.placeholder)}"` : "",
      opts.min != null ? `min="${opts.min}"` : "",
      opts.max != null ? `max="${opts.max}"` : "",
      opts.step != null ? `step="${opts.step}"` : "",
      opts.hint ? `aria-describedby="${escAttr(id)}-hint"` : "",
    ])}
  />`;
  return fieldShell(opts, control);
}

export function adminFieldDate(opts: BaseFieldOpts): string {
  const id = opts.id || opts.name;
  const control = `<input
    id="${escAttr(id)}"
    name="${escAttr(opts.name)}"
    type="date"
    class="cc-input"
    value="${escAttr(String(opts.value ?? ""))}"
    ${attrs([
      opts.required ? "required" : "",
      opts.readonly ? "readonly" : "",
      opts.disabled ? "disabled" : "",
      opts.hint ? `aria-describedby="${escAttr(id)}-hint"` : "",
    ])}
  />`;
  return fieldShell(opts, control);
}

export function adminFieldTextarea(
  opts: BaseFieldOpts & { rows?: number; maxlength?: number },
): string {
  const id = opts.id || opts.name;
  const control = `<textarea
    id="${escAttr(id)}"
    name="${escAttr(opts.name)}"
    class="cc-input"
    rows="${opts.rows ?? 3}"
    ${attrs([
      opts.required ? "required" : "",
      opts.readonly ? "readonly" : "",
      opts.disabled ? "disabled" : "",
      opts.placeholder ? `placeholder="${escAttr(opts.placeholder)}"` : "",
      opts.maxlength != null ? `maxlength="${opts.maxlength}"` : "",
      opts.hint ? `aria-describedby="${escAttr(id)}-hint"` : "",
    ])}
  >${escHtml(String(opts.value ?? ""))}</textarea>`;
  return fieldShell(opts, control);
}

export function adminFieldSelect(
  opts: BaseFieldOpts & { options: Array<{ value: string; label: string; selected?: boolean }> },
): string {
  const id = opts.id || opts.name;
  const options = opts.options
    .map(
      (o) =>
        `<option value="${escAttr(o.value)}"${o.selected ? " selected" : ""}>${escHtml(o.label)}</option>`,
    )
    .join("");
  const control = `<select
    id="${escAttr(id)}"
    name="${escAttr(opts.name)}"
    class="cc-input"
    ${attrs([
      opts.required ? "required" : "",
      opts.disabled ? "disabled" : "",
      opts.hint ? `aria-describedby="${escAttr(id)}-hint"` : "",
    ])}
  >${options}</select>`;
  return fieldShell(opts, control);
}

export function adminFieldCheckbox(opts: BaseFieldOpts & { checked?: boolean }): string {
  const id = opts.id || opts.name;
  const hint = opts.hint ? `<span class="cc-field__hint">${escHtml(opts.hint)}</span>` : "";
  return `<div class="cc-field ${colClass(opts.col)}">${hint}<label class="admin-check-row" for="${escAttr(id)}">
    <input id="${escAttr(id)}" name="${escAttr(opts.name)}" type="checkbox" value="true"${opts.checked ? " checked" : ""} />
    <span>${escHtml(opts.label)}</span>
  </label></div>`;
}

export function adminSettingsSection(
  title: string,
  description: string,
  body: string,
): string {
  return `<section class="admin-settings-section">
      <header class="admin-settings-section__head">
        <h4 class="admin-settings-section__title">${escHtml(title)}</h4>
        <p class="admin-settings-section__desc">${escHtml(description)}</p>
      </header>
      <div class="admin-settings-grid">${body}</div>
    </section>`;
}
