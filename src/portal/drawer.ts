import { escHtml } from "./html";
import type { PortalDrawerOptions } from "./types";

export interface DrawerHostHandle {
  open(opts: PortalDrawerOptions): void;
  close(): void;
  destroy(): void;
}

export function mountDrawerHost(parent: HTMLElement): DrawerHostHandle {
  const host = document.createElement("div");
  host.className = "pp-drawer-host";
  host.hidden = true;
  parent.appendChild(host);

  let activeOpts: PortalDrawerOptions | null = null;

  function close(): void {
    if (!activeOpts) return;
    const ref = activeOpts;
    activeOpts = null;
    const drawerEl = host.querySelector(".pp-drawer") as HTMLElement | null;
    drawerEl?.classList.remove("is-open");
    host.classList.remove("is-open");
    setTimeout(() => {
      host.hidden = true;
      host.innerHTML = "";
      if (ref.onClose) ref.onClose();
    }, 220);
  }

  function open(opts: PortalDrawerOptions): void {
    activeOpts = opts;
    const size = opts.size ?? "md";
    host.innerHTML = `
      <div class="pp-drawer__scrim" data-pp-drawer-close></div>
      <aside class="pp-drawer pp-drawer--${escHtml(size)}" role="dialog" aria-modal="true" aria-label="${escHtml(opts.title)}">
        <header class="pp-drawer__header">
          <div>
            <h2 class="pp-drawer__title">${escHtml(opts.title)}</h2>
            ${opts.subtitle ? `<p class="pp-drawer__subtitle">${escHtml(opts.subtitle)}</p>` : ""}
          </div>
          <button type="button" class="pp-drawer__close" data-pp-drawer-close aria-label="Close">×</button>
        </header>
        <div class="pp-drawer__body" data-pp-drawer-body></div>
        ${opts.footer ? `<footer class="pp-drawer__footer" data-pp-drawer-footer></footer>` : ""}
      </aside>
    `;

    const bodyHost = host.querySelector("[data-pp-drawer-body]") as HTMLElement | null;
    if (bodyHost) {
      if (typeof opts.body === "string") bodyHost.innerHTML = opts.body;
      else bodyHost.appendChild(opts.body);
    }
    if (opts.footer) {
      const footerHost = host.querySelector("[data-pp-drawer-footer]") as HTMLElement | null;
      if (footerHost) {
        if (typeof opts.footer === "string") footerHost.innerHTML = opts.footer;
        else footerHost.appendChild(opts.footer);
      }
    }

    host.hidden = false;
    requestAnimationFrame(() => {
      host.classList.add("is-open");
      const drawerEl = host.querySelector(".pp-drawer") as HTMLElement | null;
      drawerEl?.classList.add("is-open");
    });

    if (opts.onMount && bodyHost) opts.onMount(bodyHost);

    host.querySelectorAll("[data-pp-drawer-close]").forEach((el) => {
      el.addEventListener("click", close);
    });
  }

  function destroy(): void {
    activeOpts = null;
    if (host.parentElement) host.parentElement.removeChild(host);
  }

  return { open, close, destroy };
}
