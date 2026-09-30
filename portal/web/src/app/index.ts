/**
 * Public API of the `app` layer — the bootstrapped application, as `main.tsx`
 * mounts it: the self-hosted font faces, registered once for the whole
 * document, and the composition root.
 *
 * The suites import `App` from `./App` directly, so the fonts' CSS stays out of
 * the test graph and jsdom never parses it.
 */
import "./styles/fonts";

export { App } from "./App";
