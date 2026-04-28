export type PortalMode = "admin" | "promoter" | "club";

export type PortalRole = "admin" | "promoter" | "club" | "host";

export interface PortalNavItem {
  /** Stable item id, e.g. "admin.jobs". */
  id: string;
  label: string;
  /**
   * Either a built-in shell route (e.g., "overview") or a legacy module
   * `data-view` attribute that the shell will dispatch a click for to switch
   * the underlying module's internal view.
   */
  legacyView: string;
  icon?: string;
  /** Optional hint shown under the title in the topbar breadcrumb. */
  subtitle?: string;
  /** Mode this item belongs to (drives which legacy module is shown). */
  mode: PortalMode;
}

export interface PortalNavGroup {
  id: string;
  label: string;
  items: PortalNavItem[];
}

export interface PortalNavConfig {
  groups: PortalNavGroup[];
}

export interface PortalShellApi {
  /** Open a right-side drawer with the given content nodes. */
  openDrawer(opts: PortalDrawerOptions): void;
  closeDrawer(): void;
  /** Open a centered modal dialog. */
  openModal(opts: PortalModalOptions): void;
  closeModal(): void;
  /** Show an ephemeral toast notification. */
  toast(message: string, variant?: PortalToastVariant): void;
  /** Programmatically navigate to a sidebar item id. */
  navigate(itemId: string): void;
  /** Update the breadcrumb title/subtitle in the topbar. */
  setBreadcrumb(title: string, subtitle?: string): void;
}

export interface PortalDrawerOptions {
  title: string;
  subtitle?: string;
  body: string | HTMLElement;
  /** Optional footer (action buttons, etc.). */
  footer?: string | HTMLElement;
  /** Width preset. */
  size?: "sm" | "md" | "lg";
  /** Called after the drawer mounts (use to bind events to body content). */
  onMount?: (root: HTMLElement) => void;
  /** Called after the drawer fully closes. */
  onClose?: () => void;
}

export interface PortalModalOptions {
  title: string;
  body: string | HTMLElement;
  /** Default = "Confirm". */
  confirmLabel?: string;
  /** Default = "Cancel". */
  cancelLabel?: string;
  /** Variant for the confirm button. */
  confirmVariant?: "primary" | "danger";
  /** Hide the cancel button (info-only modals). */
  hideCancel?: boolean;
  /** Returning `false` cancels the close. */
  onConfirm?: () => boolean | void | Promise<boolean | void>;
  onCancel?: () => void;
  onMount?: (root: HTMLElement) => void;
}

export type PortalToastVariant = "info" | "success" | "warning" | "danger";
