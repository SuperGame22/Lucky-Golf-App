/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Optional. Enables the Monocle debug overlay in production builds: ?monocle_debug=<token> */
  readonly VITE_MONOCLE_DEBUG_TOKEN?: string;
}
