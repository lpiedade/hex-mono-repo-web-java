/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Commit of this bundle, shown on the About page. Set by CI at build time. */
  readonly VITE_GIT_COMMIT: string | undefined;
  /** Build timestamp of this bundle (ISO-8601), shown beside it. */
  readonly VITE_BUILD_TIME: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
