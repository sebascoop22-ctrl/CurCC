/** Escape user/text content for safe HTML interpolation. */
export function escHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape attribute values (subset of `escHtml` with `"` always escaped). */
export function escAttr(value: unknown): string {
  return escHtml(value);
}
