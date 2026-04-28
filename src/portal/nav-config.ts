import type { PortalMode, PortalNavConfig, PortalRole } from "./types";

/**
 * Sentinel `legacyView` value reserved for the new shell's Overview page (no
 * legacy module backing). Anything else is a `data-view` attribute on a hidden
 * tab inside the legacy admin/promoter/club shell.
 */
export const PORTAL_OVERVIEW_VIEW = "__overview__";

const ADMIN_NAV: PortalNavConfig = {
  groups: [
    {
      id: "main",
      label: "",
      items: [
        {
          id: "admin.overview",
          label: "Overview",
          legacyView: PORTAL_OVERVIEW_VIEW,
          mode: "admin",
          icon: "▦",
          subtitle: "Daily snapshot of pending work across the operation.",
        },
      ],
    },
    {
      id: "operations",
      label: "Operations",
      items: [
        {
          id: "admin.enquiries",
          label: "Enquiries",
          legacyView: "enquiries",
          mode: "admin",
          icon: "✉",
        },
        {
          id: "admin.clients",
          label: "Clients",
          legacyView: "clients",
          mode: "admin",
          icon: "◉",
        },
        {
          id: "admin.jobs",
          label: "Jobs",
          legacyView: "jobs",
          mode: "admin",
          icon: "◇",
        },
        {
          id: "admin.guestlist_queue",
          label: "Guestlist queue",
          legacyView: "guestlist_queue",
          mode: "admin",
          icon: "≡",
        },
        {
          id: "admin.night_adjustments",
          label: "Night shifts",
          legacyView: "night_adjustments",
          mode: "admin",
          icon: "☾",
        },
        {
          id: "admin.table_sales",
          label: "Tables sold",
          legacyView: "table_sales",
          mode: "admin",
          icon: "▤",
        },
        {
          id: "admin.job_disputes",
          label: "Disputes",
          legacyView: "job_disputes",
          mode: "admin",
          icon: "△",
        },
      ],
    },
    {
      id: "promoters",
      label: "Promoters",
      items: [
        {
          id: "admin.promoter_requests",
          label: "Requests",
          legacyView: "promoter_requests",
          mode: "admin",
          icon: "⊕",
        },
        {
          id: "admin.promoters",
          label: "Profiles",
          legacyView: "promoters",
          mode: "admin",
          icon: "⌂",
        },
        {
          id: "admin.invoices",
          label: "Invoices",
          legacyView: "invoices",
          mode: "admin",
          icon: "≣",
        },
      ],
    },
    {
      id: "clubs",
      label: "Clubs",
      items: [
        {
          id: "admin.club_accounts",
          label: "Accounts",
          legacyView: "club_accounts",
          mode: "admin",
          icon: "✦",
        },
        {
          id: "admin.club_edits",
          label: "Edit queue",
          legacyView: "club_edits",
          mode: "admin",
          icon: "✎",
        },
      ],
    },
    {
      id: "website",
      label: "Website",
      items: [
        {
          id: "admin.clubs",
          label: "Clubs catalog",
          legacyView: "clubs",
          mode: "admin",
          icon: "▣",
        },
        {
          id: "admin.cars",
          label: "Cars",
          legacyView: "cars",
          mode: "admin",
          icon: "⛟",
        },
        {
          id: "admin.flyers",
          label: "Flyers",
          legacyView: "flyers",
          mode: "admin",
          icon: "▲",
        },
      ],
    },
    {
      id: "finance",
      label: "Finance",
      items: [
        {
          id: "admin.financial_dashboard",
          label: "Dashboard",
          legacyView: "financials",
          mode: "admin",
          icon: "◫",
        },
        {
          id: "admin.financial_rules",
          label: "Rules",
          legacyView: "financials",
          mode: "admin",
          icon: "⌘",
        },
        {
          id: "admin.financial_nightlife",
          label: "Nightlife",
          legacyView: "financials",
          mode: "admin",
          icon: "☾",
        },
        {
          id: "admin.financial_transport",
          label: "Transport",
          legacyView: "financials",
          mode: "admin",
          icon: "⛟",
        },
        {
          id: "admin.financial_protection",
          label: "Protection",
          legacyView: "financials",
          mode: "admin",
          icon: "⊞",
        },
        {
          id: "admin.financial_promoters",
          label: "Promoter Hub",
          legacyView: "financials",
          mode: "admin",
          icon: "£",
        },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      items: [
        {
          id: "admin.profile",
          label: "Profile",
          legacyView: "admin_profile",
          mode: "admin",
          icon: "✸",
        },
      ],
    },
  ],
};

const PROMOTER_NAV: PortalNavConfig = {
  groups: [
    {
      id: "main",
      label: "",
      items: [
        {
          id: "promoter.overview",
          label: "Overview",
          legacyView: PORTAL_OVERVIEW_VIEW,
          mode: "promoter",
          icon: "▦",
          subtitle: "Your work-at-a-glance: status, upcoming jobs, earnings.",
        },
      ],
    },
    {
      id: "work",
      label: "Work",
      items: [
        {
          id: "promoter.jobs",
          label: "Jobs",
          legacyView: "jobs",
          mode: "promoter",
          icon: "◇",
        },
        {
          id: "promoter.tables",
          label: "Tables sold",
          legacyView: "tables",
          mode: "promoter",
          icon: "▤",
        },
        {
          id: "promoter.clients",
          label: "Clients",
          legacyView: "clients",
          mode: "promoter",
          icon: "◉",
        },
        {
          id: "promoter.job_history",
          label: "Jobs history",
          legacyView: "job_history",
          mode: "promoter",
          icon: "↺",
        },
        {
          id: "promoter.table_history",
          label: "Tables history",
          legacyView: "table_history",
          mode: "promoter",
          icon: "↻",
        },
      ],
    },
    {
      id: "account",
      label: "Account",
      items: [
        {
          id: "promoter.profile",
          label: "My profile",
          legacyView: "profile",
          mode: "promoter",
          icon: "⌂",
        },
        {
          id: "promoter.preferences",
          label: "Work preferences",
          legacyView: "preferences",
          mode: "promoter",
          icon: "⚙",
        },
      ],
    },
    {
      id: "finance",
      label: "Finance",
      items: [
        {
          id: "promoter.invoices",
          label: "Invoices",
          legacyView: "invoices",
          mode: "promoter",
          icon: "≣",
        },
      ],
    },
  ],
};

const CLUB_NAV: PortalNavConfig = {
  groups: [
    {
      id: "main",
      label: "",
      items: [
        {
          id: "club.overview",
          label: "Overview",
          legacyView: PORTAL_OVERVIEW_VIEW,
          mode: "club",
          icon: "▦",
          subtitle: "Status of your club's edits, promoters, and disputes.",
        },
      ],
    },
    {
      id: "club",
      label: "Club",
      items: [
        {
          id: "club.profile",
          label: "Profile",
          legacyView: "profile",
          mode: "club",
          icon: "⌂",
        },
        {
          id: "club.flyers",
          label: "Flyers & media",
          legacyView: "flyers",
          mode: "club",
          icon: "▲",
        },
        {
          id: "club.promoters",
          label: "Promoter access",
          legacyView: "promoters",
          mode: "club",
          icon: "✦",
        },
        {
          id: "club.jobs",
          label: "Jobs & disputes",
          legacyView: "jobs",
          mode: "club",
          icon: "△",
        },
      ],
    },
    {
      id: "tools",
      label: "Tools",
      items: [
        {
          id: "club.admin_tools",
          label: "Invites & testing",
          legacyView: "admin_tools",
          mode: "club",
          icon: "✸",
        },
      ],
    },
  ],
};

/** Returns the nav config for the active portal mode. */
export function getNavConfigForMode(mode: PortalMode): PortalNavConfig {
  switch (mode) {
    case "promoter":
      return PROMOTER_NAV;
    case "club":
      return CLUB_NAV;
    default:
      return ADMIN_NAV;
  }
}

/** Modes a given role is allowed to access. Admin can view-as everything. */
export function allowedModesForRole(role: PortalRole | null): PortalMode[] {
  if (role === "admin") return ["admin", "promoter", "club"];
  if (role === "promoter") return ["promoter"];
  if (role === "club") return ["club"];
  return [];
}

/** Default landing mode for a role. */
export function defaultModeForRole(role: PortalRole | null): PortalMode | null {
  if (role === "admin") return "admin";
  if (role === "promoter") return "promoter";
  if (role === "club") return "club";
  return null;
}

/** Find a nav item by id within the given config. */
export function findNavItem(
  config: PortalNavConfig,
  itemId: string,
): PortalNavConfig["groups"][number]["items"][number] | null {
  for (const group of config.groups) {
    for (const item of group.items) {
      if (item.id === itemId) return item;
    }
  }
  return null;
}

/** First nav item in the config (used for default landing). */
export function firstNavItemId(config: PortalNavConfig): string {
  return config.groups[0]?.items[0]?.id ?? "";
}
