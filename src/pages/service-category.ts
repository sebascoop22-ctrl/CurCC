import "../styles/pages/service-category.css";

export type ServiceItem = {
  name: string;
  description: string;
  image: string;
  imageAlt: string;
};

export type CategoryPage = {
  title: string;
  intro: string;
  canonicalPath: string;
  services: ServiceItem[];
  ctaHref: string;
  ctaLabel: string;
};

export type ServiceHubItem = {
  title: string;
  teaser: string;
  href: string;
  image: string;
  imageAlt: string;
};

export type ServiceHubPage = {
  title: string;
  intro: string;
  canonicalPath: string;
  items: ServiceHubItem[];
};

const HUB_SLUGS = ["access", "travel", "protection"] as const;
type HubSlug = (typeof HUB_SLUGS)[number];

const HUBS: Record<HubSlug, ServiceHubPage> = {
  access: {
    title: "Access",
    intro:
      "Guestlists and tables, events, and venue hire—everything that gets you and your guests through the door on your terms.",
    canonicalPath: "/services/access",
    items: [
      {
        title: "Nightlife guestlists and tables",
        teaser:
          "Priority guestlists, booth and table holds, and venue-side coordination so your night moves without friction.",
        href: "/nightlife",
        image: "/media/nightlife/lead-atmosphere.jpg",
        imageAlt: "Nightlife atmosphere",
      },
      {
        title: "Events",
        teaser:
          "Private celebrations and corporate hospitality with production-aware concierge support end to end.",
        href: "/services/events",
        image: "/media/nightlife/hero-atmosphere.svg",
        imageAlt: "Event atmosphere",
      },
      {
        title: "Venue hire",
        teaser:
          "Shortlists, site visits, and contract-ready briefs for spaces that match capacity, sound, and curfew reality.",
        href: "/services/venue-hire",
        image: "/media/home/bento-venue-hire.jpg",
        imageAlt: "Venue interior",
      },
    ],
  },
  travel: {
    title: "Travel",
    intro:
      "Ground, air, and water—chauffeuring, private jets, and yachts coordinated as one movement plan.",
    canonicalPath: "/services/travel",
    items: [
      {
        title: "Personal and corporate chauffeuring",
        teaser:
          "Discreet drivers, vetted vehicles, and itinerary-aware routing for individuals and executive programmes.",
        href: "/chauffeuring",
        image: "/media/chauffeuring/hero-cover.jpg",
        imageAlt: "Chauffeur vehicle",
      },
      {
        title: "Private jets",
        teaser:
          "Brokered charter with aircraft suitability, slot handling, and ground continuity at both ends.",
        href: "/services/private-jets",
        image: "/media/home/hero-backdrop.svg",
        imageAlt: "Aviation and horizons",
      },
      {
        title: "Private yachts",
        teaser:
          "Day charters and multi-day itineraries with crew vetting, provisioning, and port formalities covered.",
        href: "/services/private-yachts",
        image: "/media/nightlife/lead-gen-moon-graphic.svg",
        imageAlt: "Evening charter",
      },
    ],
  },
  protection: {
    title: "Protection",
    intro:
      "Licensed venue teams and close protection calibrated to the environment—visible when useful, invisible when it matters.",
    canonicalPath: "/services/protection",
    items: [
      {
        title: "Venue security",
        teaser:
          "Door, floor, and backstage control briefed on capacity, licensing, and artist riders.",
        href: "/services/venue-security",
        image: "/media/security/hero-cover.jpg",
        imageAlt: "Venue security",
      },
      {
        title: "Bodyguards and personal protection",
        teaser:
          "Close protection with advance work and extraction planning integrated into your diary.",
        href: "/security",
        image: "/media/security/hero-bg.svg",
        imageAlt: "Close protection",
      },
    ],
  },
};

const DETAIL_TO_HUB: Record<string, HubSlug> = {
  "nightlife-guestlists-and-tables": "access",
  events: "access",
  "venue-hire": "access",
  "personal-and-corporate-chauffeuring": "travel",
  "private-jets": "travel",
  "private-yachts": "travel",
  "venue-security": "protection",
  "bodyguards-and-personal-protection": "protection",
};

function isHubSlug(s: string): s is HubSlug {
  return (HUB_SLUGS as readonly string[]).includes(s);
}

const CATEGORIES: Record<string, CategoryPage> = {
  "nightlife-guestlists-and-tables": {
    title: "Nightlife guestlists and tables",
    intro:
      "Priority guestlists, booth and table holds, and venue-side coordination so your night moves without friction.",
    canonicalPath: "/services/nightlife-guestlists-and-tables",
    ctaHref: "/nightlife",
    ctaLabel: "Explore nightlife",
    services: [
      {
        name: "Guestlists",
        description:
          "Same-night and advance guestlist placement at partner venues, with host liaison and arrival timing.",
        image: "/media/nightlife/lead-atmosphere.jpg",
        imageAlt: "Nightlife atmosphere",
      },
      {
        name: "Tables and booths",
        description:
          "Reserved tables with spend guidance, bottle service logistics, and discreet settlement where required.",
        image: "/media/home/bento-nightlife-bg.svg",
        imageAlt: "Nightlife graphic",
      },
      {
        name: "VIP arrival",
        description:
          "Coordinated door protocol and escort from kerb to floor so you are not left queueing in the weather.",
        image: "/media/nightlife/hero-bg.svg",
        imageAlt: "Venue lighting",
      },
    ],
  },
  events: {
    title: "Events",
    intro:
      "From private celebrations to brand moments—we align production, access, and movement around your run of show.",
    canonicalPath: "/services/events",
    ctaHref: "/enquiry",
    ctaLabel: "Plan an event",
    services: [
      {
        name: "Private celebrations",
        description:
          "Birthdays, launches, and milestone dinners with reservations, transport, and on-site coordination.",
        image: "/media/nightlife/lead-atmosphere.jpg",
        imageAlt: "Private celebration",
      },
      {
        name: "Corporate hospitality",
        description:
          "Client entertainment blocks with seating plans, dietary notes, and after-party handoffs.",
        image: "/media/home/bento-venue-hire.jpg",
        imageAlt: "Event venue",
      },
      {
        name: "Run of show support",
        description:
          "Timeline checks, vendor touchpoints, and last-minute pivots handled by a single concierge line.",
        image: "/media/enquiry/process-placeholder.svg",
        imageAlt: "Operations planning",
      },
    ],
  },
  "venue-hire": {
    title: "Venue hire",
    intro:
      "Shortlists, site visits, and contract-ready briefs for spaces that match capacity, sound, and curfew reality.",
    canonicalPath: "/services/venue-hire",
    ctaHref: "/enquiry",
    ctaLabel: "Request venue options",
    services: [
      {
        name: "Shortlist and availability",
        description:
          "We filter venues by headcount, layout, licensing, and technical riders before you commit time.",
        image: "/media/home/bento-venue-hire.jpg",
        imageAlt: "Venue interior",
      },
      {
        name: "Production liaison",
        description:
          "Sound, lighting, and load-in windows coordinated with the house team and your suppliers.",
        image: "/media/enquiry/process-placeholder.svg",
        imageAlt: "Production planning",
      },
      {
        name: "On-site coordination",
        description:
          "Concierge on the ground for guest flow, security handshakes, and settlement.",
        image: "/media/security/hero-cover.jpg",
        imageAlt: "Professional coordination",
      },
    ],
  },
  "personal-and-corporate-chauffeuring": {
    title: "Personal and corporate chauffeuring",
    intro:
      "Discreet drivers, vetted vehicles, and itinerary-aware routing for individuals and executive programmes.",
    canonicalPath: "/services/personal-and-corporate-chauffeuring",
    ctaHref: "/chauffeuring",
    ctaLabel: "Chauffeur booking",
    services: [
      {
        name: "Personal movements",
        description:
          "Airport, hotel, and evening transfers with live traffic adjustments and minimal kerb time.",
        image: "/media/chauffeuring/hero-cover.jpg",
        imageAlt: "Chauffeur vehicle",
      },
      {
        name: "Corporate road programmes",
        description:
          "Multi-day road books, standby vehicles, and consistent driver teams for principals and guests.",
        image: "/media/home/bento-chauffeur.svg",
        imageAlt: "Chauffeur illustration",
      },
      {
        name: "As-directed days",
        description:
          "Open-ended itineraries with secure comms and wait-and-return where schedules slip.",
        image: "/media/chauffeuring/hero-bg.svg",
        imageAlt: "Route graphic",
      },
    ],
  },
  "private-jets": {
    title: "Private jets",
    intro:
      "Brokered charter with aircraft suitability, slot handling, and ground continuity at both ends.",
    canonicalPath: "/services/private-jets",
    ctaHref: "/enquiry",
    ctaLabel: "Enquire about charter",
    services: [
      {
        name: "On-demand charter",
        description:
          "Light to heavy jet options matched to range, cabin, and luggage—quoted with full cost transparency.",
        image: "/media/nightlife/hero-atmosphere.svg",
        imageAlt: "Premium travel",
      },
      {
        name: "Slot and handling",
        description:
          "FBO coordination, customs timing, and chauffeur meet at the steps to keep movement seamless.",
        image: "/media/chauffeuring/hero-cover.jpg",
        imageAlt: "Ground handling and transfers",
      },
      {
        name: "Multi-leg programmes",
        description:
          "Touring and road-show routings with contingency aircraft where schedule risk is high.",
        image: "/media/home/hero-backdrop.svg",
        imageAlt: "Skyline graphic",
      },
    ],
  },
  "private-yachts": {
    title: "Private yachts",
    intro:
      "Day charters and multi-day itineraries with crew vetting, provisioning notes, and port formalities covered.",
    canonicalPath: "/services/private-yachts",
    ctaHref: "/enquiry",
    ctaLabel: "Yacht enquiry",
    services: [
      {
        name: "Day and evening charters",
        description:
          "Guest counts, catering style, and swim-stop preferences captured before you board.",
        image: "/media/nightlife/lead-gen-moon-graphic.svg",
        imageAlt: "Evening charter",
      },
      {
        name: "Multi-day itineraries",
        description:
          "Berth planning, tender logistics, and shore-side drivers matched to each port.",
        image: "/media/home/hero-backdrop.svg",
        imageAlt: "Routing and horizons",
      },
      {
        name: "Guest experience",
        description:
          "Music, deck layout, and privacy posture aligned with the principal’s expectations.",
        image: "/media/nightlife/hero-atmosphere.svg",
        imageAlt: "On-board ambience",
      },
    ],
  },
  "venue-security": {
    title: "Venue security",
    intro:
      "Licensed teams for door, floor, and backstage control—briefed on capacity, licensing, and artist riders.",
    canonicalPath: "/services/venue-security",
    ctaHref: "/security",
    ctaLabel: "Security consultation",
    services: [
      {
        name: "Door and queue management",
        description:
          "Search policy, guestlist verification, and escalation paths agreed with the house in advance.",
        image: "/media/security/hero-cover.jpg",
        imageAlt: "Security professional",
      },
      {
        name: "Floor and backstage",
        description:
          "Discrete presence in public areas and controlled access to green rooms and load-in.",
        image: "/media/home/bento-security.svg",
        imageAlt: "Security icon",
      },
      {
        name: "Event debriefs",
        description:
          "Incident logs and handover notes for repeat bookings and insurer documentation where needed.",
        image: "/media/security/hero-bg.svg",
        imageAlt: "Security backdrop",
      },
    ],
  },
  "bodyguards-and-personal-protection": {
    title: "Bodyguards and personal protection",
    intro:
      "Close protection calibrated to environment—visible when useful, invisible when the moment demands it.",
    canonicalPath: "/services/bodyguards-and-personal-protection",
    ctaHref: "/security",
    ctaLabel: "Request protection",
    services: [
      {
        name: "Executive protection teams",
        description:
          "Overlapping details, advance work, and extraction planning integrated into your diary.",
        image: "/media/security/hero-cover.jpg",
        imageAlt: "Close protection",
      },
      {
        name: "Travel with principals",
        description:
          "Airside meet, motorcade discipline, and hotel floor protocols matched to threat profile.",
        image: "/media/chauffeuring/hero-cover.jpg",
        imageAlt: "Travel security",
      },
      {
        name: "Residential and venue holds",
        description:
          "Static posts and roaming teams for private residences, after-parties, and off-site dinners.",
        image: "/media/home/bento-security.svg",
        imageAlt: "Protection services",
      },
    ],
  },
};

function parseSlug(): string | null {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const m = path.match(/^\/services\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function initServiceCategoryPage(): Promise<void> {
  const root = document.getElementById("service-category-main");
  if (!root) return;

  const slug = parseSlug();
  if (!slug) {
    renderNotFound(root);
    return;
  }

  if (isHubSlug(slug)) {
    renderHubPage(root, HUBS[slug]);
    return;
  }

  const def = CATEGORIES[slug];
  if (!def) {
    renderNotFound(root);
    return;
  }

  renderDetailPage(root, slug, def);
}

function setCanonical(href: string): void {
  const origin = "https://www.cooperconcierge.co.uk";
  const canonical = href.startsWith("http") ? href : `${origin}${href}`;

  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = canonical;
}

function renderNotFound(root: HTMLElement): void {
  document.title = "Services | Cooper Concierge";
  root.innerHTML = `
      <section class="service-category-hero cc-container">
        <p class="cc-eyebrow">Services</p>
        <h1>Page not found</h1>
        <p class="service-category-intro">This category does not exist or the link may be out of date.</p>
        <p><a class="cc-btn cc-btn--gold" href="/#services">Back to services</a></p>
      </section>
    `;
}

function renderHubPage(root: HTMLElement, hub: ServiceHubPage): void {
  document.title = `${hub.title} | Cooper Concierge`;
  setCanonical(hub.canonicalPath);

  const cardsHtml = hub.items
    .map(
      (item) => `
    <a class="service-hub-card" href="${escapeHtml(item.href)}">
      <div class="service-hub-card__media">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.imageAlt)}" width="640" height="400" loading="lazy" />
      </div>
      <div class="service-hub-card__body">
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.teaser)}</p>
        <span class="service-hub-card__cta">View details</span>
      </div>
    </a>
  `,
    )
    .join("");

  root.innerHTML = `
    <section class="service-category-hero cc-container">
      <p class="cc-eyebrow">Services</p>
      <h1>${escapeHtml(hub.title)}</h1>
      <p class="service-category-intro">${escapeHtml(hub.intro)}</p>
      <p class="service-category-cta-row">
        <a class="service-category-back" href="/#services">All services</a>
      </p>
    </section>
    <section class="cc-container service-hub-grid" aria-label="${escapeHtml(hub.title)} subcategories">
      ${cardsHtml}
    </section>
  `;
}

function renderDetailPage(root: HTMLElement, slug: string, def: CategoryPage): void {
  document.title = `${def.title} | Cooper Concierge`;
  setCanonical(def.canonicalPath);

  const parentHub = DETAIL_TO_HUB[slug];
  const hubBack =
    parentHub !== undefined
      ? `<a class="service-category-back" href="${escapeHtml(HUBS[parentHub].canonicalPath)}">Back to ${escapeHtml(HUBS[parentHub].title)}</a>`
      : "";

  const cardsHtml = def.services
    .map(
      (s) => `
    <article class="service-category-card">
      <div class="service-category-card__media">
        <img src="${escapeHtml(s.image)}" alt="${escapeHtml(s.imageAlt)}" width="640" height="400" loading="lazy" />
      </div>
      <div class="service-category-card__body">
        <h2>${escapeHtml(s.name)}</h2>
        <p>${escapeHtml(s.description)}</p>
      </div>
    </article>
  `,
    )
    .join("");

  root.innerHTML = `
    <section class="service-category-hero cc-container">
      <p class="cc-eyebrow">Services</p>
      <h1>${escapeHtml(def.title)}</h1>
      <p class="service-category-intro">${escapeHtml(def.intro)}</p>
      <p class="service-category-cta-row">
        <a class="cc-btn cc-btn--gold" href="${escapeHtml(def.ctaHref)}">${escapeHtml(def.ctaLabel)}</a>
        ${hubBack}
        <a class="service-category-back" href="/#services">All services</a>
      </p>
    </section>
    <section class="cc-container service-category-list" aria-label="${escapeHtml(def.title)} offerings">
      ${cardsHtml}
    </section>
  `;
}
