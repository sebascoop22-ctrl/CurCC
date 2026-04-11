/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Web3Forms access key — emails arrive at the inbox configured in your Web3Forms dashboard */
  readonly VITE_WEB3FORMS_ACCESS_KEY?: string;
  readonly VITE_ADMIN_PASSCODE?: string;
  /** Google Maps JS API key (admin club form: Places autocomplete). Restrict key to your domain + localhost. */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
