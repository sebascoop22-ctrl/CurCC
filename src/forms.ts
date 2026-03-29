export function submitInquiry(
  payload: Record<string, unknown>,
  formName: string,
): void {
  console.log(`[Cooper Concierge] Form mock submit: ${formName}`, payload);
  try {
    sessionStorage.setItem(
      `cc_last_${formName}`,
      JSON.stringify({ at: new Date().toISOString(), payload }),
    );
  } catch {
    /* ignore quota */
  }
}

export function showFormSuccess(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.add("is-visible");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function validateEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
