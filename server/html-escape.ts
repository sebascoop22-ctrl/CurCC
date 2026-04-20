/** Escape text for safe inclusion in HTML attribute values. */
export function escapeAttr(s: string | undefined | null): string {
  const v = s == null ? "" : String(s);
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
