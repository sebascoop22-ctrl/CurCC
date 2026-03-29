import { inject } from "@vercel/analytics";

/**
 * Initialize Vercel Web Analytics
 * This should be called once per page load
 */
export function initAnalytics(): void {
  inject();
}
