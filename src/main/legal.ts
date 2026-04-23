import { initChrome } from "../chrome";
import { initConsentState } from "../lib/consent";

const path = window.location.pathname.replace(/\/$/, "");
const leaf = path.split("/").pop() ?? "";
const page = leaf === "privacy" || leaf === "privacy.html" ? "privacy" : "terms";
initChrome(page);

if (page === "privacy") {
  const statusEl = document.getElementById("privacy-consent-status");
  const openPrefsBtn = document.getElementById(
    "privacy-open-consent",
  ) as HTMLButtonElement | null;
  const footerPrefsBtn = document.getElementById(
    "cc-open-consent",
  ) as HTMLButtonElement | null;
  const consent = initConsentState();
  const baseStatus =
    consent.analytics === true
      ? "Accepted optional analytics"
      : consent.analytics === false
        ? "Opted out of optional analytics"
        : "No analytics preference saved yet";
  const datePart = consent.updatedAt
    ? ` on ${new Date(consent.updatedAt).toLocaleString()}`
    : "";
  if (statusEl) {
    statusEl.textContent = `Current setting: ${baseStatus}${datePart}.`;
  }
  openPrefsBtn?.addEventListener("click", () => {
    footerPrefsBtn?.click();
  });
}
