export type VenueType = "lounge" | "dining";

export interface Club {
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  reviews: string[];
  locationTag: string;
  address: string;
  daysOpen: string;
  featured: boolean;
  featuredDay: string;
  venueType: VenueType;
  lat: number;
  lng: number;
  accessTier: string;
  minSpend: string;
  amenities: string[];
  images: string[];
}

export type FleetGridSize = "large" | "medium" | "feature";

export interface Car {
  slug: string;
  name: string;
  roleLabel: string;
  specsHover: string[];
  gridSize: FleetGridSize;
  order: number;
  images: string[];
}
