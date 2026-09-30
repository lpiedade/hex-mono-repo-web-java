/**
 * Self-hosted typefaces (ADR-013). Importing this module for its side effects
 * registers the @fontsource `@font-face` rules and bundles the woff2 files — no
 * external font CDN. Imported once, by the app layer's public API (`app/index.ts`);
 * kept out of the theme and of the test graph so jsdom never parses font CSS.
 *
 * Archivo — display / headings / numerics (500–800)
 * IBM Plex Sans — body / controls (400–600)
 * IBM Plex Mono — identifiers, codes, timestamps (400–500)
 */
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";

import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";

import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
