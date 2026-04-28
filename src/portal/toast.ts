import { escHtml } from "./html";
import type { PortalToastVariant } from "./types";

export interface ToastHostHandle {
  push(message: string, variant?: PortalToastVariant): void;
  destroy(): void;
}

export function mountToastHost(parent: HTMLElement): ToastHostHandle {
  const host = document.createElement("div");
  host.className = "pp-toasts";
  host.setAttribute("role", "status");
  host.setAttribute("aria-live", "polite");
  parent.appendChild(host);

  function push(message: string, variant: PortalToastVariant = "info"): void {
    const toast = document.createElement("div");
    toast.className = `pp-toast pp-toast--${variant}`;
    toast.innerHTML = `
      <span class="pp-toast__dot" aria-hidden="true"></span>
      <span class="pp-toast__msg">${escHtml(message)}</span>
      <button type="button" class="pp-toast__close" aria-label="Dismiss">×</button>
    `;
    const closeBtn = toast.querySelector(".pp-toast__close") as HTMLButtonElement | null;
    const dismiss = (): void => {
      toast.classList.add("is-leaving");
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 220);
    };
    closeBtn?.addEventListener("click", dismiss);
    host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    setTimeout(dismiss, variant === "danger" ? 6000 : 4200);
  }

  function destroy(): void {
    if (host.parentElement) host.parentElement.removeChild(host);
  }

  return { push, destroy };
}
