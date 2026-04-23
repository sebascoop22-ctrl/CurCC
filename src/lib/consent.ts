import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";

type ConsentState = {
  analytics: boolean | null;
  region: "eu" | "us" | "other";
  policyVersion: string;
  updatedAt: string | null;
};

const CONSENT_KEY = "cc_consent_v1";
const POLICY_VERSION = "2026-04-23";
const GA_MEASUREMENT_ID = "G-FR31W2TN2Z";
let analyticsLoaded = false;

function detectConsentRegion(): "eu" | "us" | "other" {
  try {
    const locale = (navigator.language || "").toLowerCase();
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase();
    if (locale.startsWith("en-us") || tz.startsWith("america/")) return "us";
    const euHints = [
      "europe/",
      "-de",
      "-fr",
      "-es",
      "-it",
      "-nl",
      "-ie",
      "-pt",
      "-se",
      "-dk",
      "-fi",
      "-pl",
      "-be",
      "-at",
      "-gr",
      "-cz",
      "-hu",
      "-ro",
      "-bg",
      "-hr",
      "-sk",
      "-si",
      "-lt",
      "-lv",
      "-ee",
      "-lu",
      "-mt",
      "-cy",
      "-is",
      "-no",
      "-ch",
      "-uk",
      "-gb",
    ];
    if (euHints.some((hint) => locale.includes(hint) || tz.includes(hint))) return "eu";
  } catch {
    return "other";
  }
  return "other";
}

function defaultConsentState(): ConsentState {
  return {
    analytics: null,
    region: detectConsentRegion(),
    policyVersion: POLICY_VERSION,
    updatedAt: null,
  };
}

function saveConsent(state: ConsentState): void {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures in strict/private browsing modes.
  }
}

export function initConsentState(): ConsentState {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return defaultConsentState();
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    return {
      analytics:
        typeof parsed.analytics === "boolean" ? parsed.analytics : null,
      region:
        parsed.region === "eu" || parsed.region === "us" || parsed.region === "other"
          ? parsed.region
          : detectConsentRegion(),
      policyVersion:
        typeof parsed.policyVersion === "string" && parsed.policyVersion
          ? parsed.policyVersion
          : POLICY_VERSION,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return defaultConsentState();
  }
}

export function analyticsConsentGranted(state: ConsentState): boolean {
  return state.analytics === true;
}

export function acceptAllConsent(): void {
  saveConsent({
    analytics: true,
    region: detectConsentRegion(),
    policyVersion: POLICY_VERSION,
    updatedAt: new Date().toISOString(),
  });
}

export function rejectAllConsent(): void {
  saveConsent({
    analytics: false,
    region: detectConsentRegion(),
    policyVersion: POLICY_VERSION,
    updatedAt: new Date().toISOString(),
  });
}

export function buildConsentBannerHtml(): string {
  const region = detectConsentRegion();
  const bodyText =
    region === "eu"
      ? "We use optional analytics cookies only with your consent. Choose Accept to enable analytics, or Reject to continue without optional tracking."
      : region === "us"
        ? "We use analytics cookies to improve service. You can accept optional analytics now or opt out. You can change this anytime via Cookie preferences or Do Not Sell or Share."
        : "We use analytics cookies to understand traffic and improve service. You can accept or reject optional analytics.";
  const rejectLabel = region === "us" ? "Opt out" : "Reject";
  return `
    <aside class="cc-consent" id="cc-consent-banner" role="dialog" aria-live="polite" aria-label="Cookie consent">
      <p class="cc-consent__text">
        ${bodyText}
      </p>
      <div class="cc-consent__actions">
        <button type="button" class="cc-btn cc-btn--gold" id="cc-consent-accept">Accept</button>
        <button type="button" class="cc-btn cc-btn--ghost" id="cc-consent-reject">${rejectLabel}</button>
      </div>
    </aside>
  `;
}

function loadGoogleAnalytics(): void {
  const existing = document.querySelector(
    `script[src*="googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`,
  );
  if (!existing) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }

  const globalWindow = window as typeof window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  globalWindow.dataLayer = globalWindow.dataLayer || [];
  globalWindow.gtag =
    globalWindow.gtag ||
    function gtag(...args: unknown[]) {
      globalWindow.dataLayer?.push(args);
    };
  globalWindow.gtag("js", new Date());
  globalWindow.gtag("config", GA_MEASUREMENT_ID);
}

export function loadAnalyticsIntegrations(): void {
  if (analyticsLoaded) return;
  analyticsLoaded = true;
  loadGoogleAnalytics();
  inject();
  injectSpeedInsights();
}
