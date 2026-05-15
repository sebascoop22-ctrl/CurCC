/** Deep-link query params shared by club / promoter catalog views. */

export function readEntityUrlParams(): { slug: string; tab: string; entityId: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    slug: String(params.get("slug") ?? "").trim(),
    tab: String(params.get("tab") ?? "").trim(),
    entityId: String(params.get("entityId") ?? "").trim(),
  };
}

export function writeEntityUrlParams(patch: {
  viewItemId: string;
  slug?: string | null;
  tab?: string | null;
  entityId?: string | null;
}): void {
  const params = new URLSearchParams(window.location.search);
  params.set("view", patch.viewItemId);
  if (patch.slug) params.set("slug", patch.slug);
  else params.delete("slug");
  if (patch.tab) params.set("tab", patch.tab);
  else params.delete("tab");
  if (patch.entityId) params.set("entityId", patch.entityId);
  else params.delete("entityId");
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", next);
}
