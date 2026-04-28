import { escHtml } from "./html";
import type { PortalModalOptions } from "./types";

export interface ModalHostHandle {
  open(opts: PortalModalOptions): void;
  close(): void;
  destroy(): void;
}

export function mountModalHost(parent: HTMLElement): ModalHostHandle {
  const host = document.createElement("div");
  host.className = "pp-modal-host";
  host.hidden = true;
  parent.appendChild(host);

  let activeOpts: PortalModalOptions | null = null;

  function close(): void {
    if (!activeOpts) return;
    const onCancel = activeOpts.onCancel;
    activeOpts = null;
    host.hidden = true;
    host.innerHTML = "";
    if (onCancel) onCancel();
  }

  function open(opts: PortalModalOptions): void {
    activeOpts = opts;
    const confirmLabel = opts.confirmLabel ?? "Confirm";
    const cancelLabel = opts.cancelLabel ?? "Cancel";
    const variantCls = opts.confirmVariant === "danger" ? "pp-btn--danger" : "pp-btn--primary";
    const cancelBtn = opts.hideCancel
      ? ""
      : `<button type="button" class="pp-btn pp-btn--ghost" data-pp-modal-cancel>${escHtml(cancelLabel)}</button>`;

    host.innerHTML = `
      <div class="pp-modal__overlay" data-pp-modal-overlay>
        <div class="pp-modal" role="dialog" aria-modal="true" aria-label="${escHtml(opts.title)}">
          <header class="pp-modal__header">
            <h2 class="pp-modal__title">${escHtml(opts.title)}</h2>
            <button type="button" class="pp-modal__close" data-pp-modal-cancel aria-label="Close">×</button>
          </header>
          <div class="pp-modal__body" data-pp-modal-body></div>
          <footer class="pp-modal__footer">
            ${cancelBtn}
            <button type="button" class="pp-btn ${variantCls}" data-pp-modal-confirm>${escHtml(confirmLabel)}</button>
          </footer>
        </div>
      </div>
    `;
    const bodyHost = host.querySelector("[data-pp-modal-body]") as HTMLElement | null;
    if (bodyHost) {
      if (typeof opts.body === "string") {
        bodyHost.innerHTML = opts.body;
      } else {
        bodyHost.appendChild(opts.body);
      }
    }
    host.hidden = false;
    if (opts.onMount && bodyHost) opts.onMount(bodyHost);

    const confirmBtn = host.querySelector("[data-pp-modal-confirm]") as HTMLButtonElement | null;
    confirmBtn?.addEventListener("click", () => {
      void (async () => {
        if (opts.onConfirm) {
          const result = await opts.onConfirm();
          if (result === false) return;
        }
        const ref = activeOpts;
        activeOpts = null;
        host.hidden = true;
        host.innerHTML = "";
        if (ref?.onCancel) {
          /* skip cancel callback after confirm */
        }
      })();
    });

    host.querySelectorAll("[data-pp-modal-cancel]").forEach((btn) => {
      btn.addEventListener("click", close);
    });
    host
      .querySelector("[data-pp-modal-overlay]")
      ?.addEventListener("click", (e) => {
        if (e.target === e.currentTarget) close();
      });
  }

  function destroy(): void {
    activeOpts = null;
    if (host.parentElement) host.parentElement.removeChild(host);
  }

  return { open, close, destroy };
}
