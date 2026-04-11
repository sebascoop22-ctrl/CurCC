/**
 * Loads Maps JavaScript API + Places library once, then attaches Autocomplete to the address field.
 * Requires a browser key with Places API (and Maps JavaScript API) enabled; restrict by HTTP referrer.
 */
const CALLBACK_NAME = "__ccGoogleMapsPlacesCb";

let loadPromise: Promise<void> | null = null;

function loadScript(apiKey: string): Promise<void> {
  if (typeof google !== "undefined" && google.maps?.places) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>;
    w[CALLBACK_NAME] = () => {
      delete w[CALLBACK_NAME];
      resolve();
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${CALLBACK_NAME}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loadPromise = null;
      delete w[CALLBACK_NAME];
      reject(new Error("Google Maps script failed to load"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export type AttachClubAddressAutocompleteOpts = {
  addressInput: HTMLInputElement;
  latInput: HTMLInputElement;
  lngInput: HTMLInputElement;
  apiKey: string;
};

/** Binds Google Places Autocomplete; fills address, lat, lng when the user picks a suggestion. */
export async function attachClubAddressAutocomplete(
  opts: AttachClubAddressAutocompleteOpts,
): Promise<void> {
  await loadScript(opts.apiKey);
  const autocomplete = new google.maps.places.Autocomplete(opts.addressInput, {
    fields: ["formatted_address", "geometry", "name"],
    componentRestrictions: { country: "gb" },
  });
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    const loc = place.geometry?.location;
    if (!loc) return;
    opts.addressInput.value =
      place.formatted_address ?? place.name ?? opts.addressInput.value;
    opts.latInput.value = String(loc.lat());
    opts.lngInput.value = String(loc.lng());
  });
}
