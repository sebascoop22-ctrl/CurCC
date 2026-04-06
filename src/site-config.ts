/**
 * UTM redirect pages for social bios: `/go/<platform>.html` (see `public/go/UTM-LINKS.txt`).
 * Optional: `?ref=name` → utm_content; `?c=stories` → utm_campaign.
 */
/** Replace with production contact details */
export const siteConfig = {
  brandName: "Cooper Concierge",
  email: "enquiries@cooperconcierge.co.uk",
  phoneDisplay: "+44 7485 540 379",
  /** Lightweight front-end gate for admin.html (not secure against determined users). */
  adminPasscode: import.meta.env.VITE_ADMIN_PASSCODE?.trim(),
  /** E.164 without + for wa.me */
  whatsappE164: "447485540379",
  social: {
    instagram: "https://www.instagram.com/cooperconcierge/",
    /** Optional — leave empty to hide “Open TikTok” in request modal */
    tiktok: "",
    /** Optional — leave empty string to hide */
    linkedin: "",
  },
};

/** URLs for footer / enquiry; add entries here as needed */
export function getSocialLinkItems(): { label: string; href: string }[] {
  const items: { label: string; href: string }[] = [];
  if (siteConfig.social.instagram)
    items.push({ label: "Instagram", href: siteConfig.social.instagram });
  if (siteConfig.social.tiktok?.trim())
    items.push({ label: "TikTok", href: siteConfig.social.tiktok.trim() });
  if (siteConfig.social.linkedin?.trim())
    items.push({ label: "LinkedIn", href: siteConfig.social.linkedin.trim() });
  return items;
}

export function whatsappHref(text?: string): string {
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${siteConfig.whatsappE164}${q}`;
}
