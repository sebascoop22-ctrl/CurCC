export type CcThemeId = "dark" | "light" | "ocean";

export const CC_THEME_ORDER: CcThemeId[] = ["dark", "light", "ocean"];

const STORAGE_KEY = "cc-theme";

export function normalizeThemeId(raw: string | null | undefined): CcThemeId {
  if (raw === "light" || raw === "ocean" || raw === "dark") return raw;
  return "ocean";
}

export function getStoredThemeId(): CcThemeId {
  try {
    return normalizeThemeId(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "ocean";
  }
}

export function getCurrentThemeId(): CcThemeId {
  if (typeof document === "undefined") return "ocean";
  const fromDom = document.documentElement.dataset.ccTheme;
  if (fromDom) return normalizeThemeId(fromDom);
  return getStoredThemeId();
}

export function applyTheme(id: CcThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.ccTheme = id;
  document.documentElement.style.colorScheme = id === "light" ? "light" : "dark";
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

export function cycleTheme(): CcThemeId {
  const cur = getCurrentThemeId();
  const i = CC_THEME_ORDER.indexOf(cur);
  const next = CC_THEME_ORDER[(i + 1) % CC_THEME_ORDER.length];
  applyTheme(next);
  return next;
}

export function initThemeFromStorage(): void {
  applyTheme(getStoredThemeId());
}

export function themeLabel(id: CcThemeId): string {
  switch (id) {
    case "light":
      return "Light";
    case "ocean":
      return "Ocean";
    default:
      return "Dark";
  }
}

export function themeIcon(id: CcThemeId): string {
  switch (id) {
    case "light":
      return "☀";
    case "ocean":
      return "◆";
    default:
      return "☾";
  }
}
