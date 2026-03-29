/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Web3Forms access key — emails arrive at the inbox configured in your Web3Forms dashboard */
  readonly VITE_WEB3FORMS_ACCESS_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
