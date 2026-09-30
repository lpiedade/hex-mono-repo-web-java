import "@testing-library/jest-dom";

/**
 * jsdom implements no layout and no `matchMedia`, so MUI's `useMediaQuery`
 * would answer `false` to every query and the components that branch on the
 * viewport — the navigation rail — would always render their narrow-viewport
 * form. The component suite assumes a desktop viewport throughout, so this
 * answers as if the window were {@link TEST_VIEWPORT_WIDTH} wide.
 *
 * A test that needs the narrow branch calls {@link setTestViewportWidth}.
 */
export const TEST_VIEWPORT_WIDTH = 1280;

let viewportWidth = TEST_VIEWPORT_WIDTH;

/**
 * Answers `min-width` / `max-width` queries against the emulated width, and
 * `prefers-color-scheme` as a light-mode system would.
 *
 * Anything else — `prefers-reduced-motion`, `hover` — is outside what this
 * stub models and answers `false`, but it warns rather than answering
 * silently: a component branching on such a query would take its negative path
 * in every test with nothing to indicate the query was never really evaluated.
 * Teach this function that query instead of muting it.
 */
function matches(query: string): boolean {
  const scheme = /\(prefers-color-scheme:\s*(light|dark)\)/.exec(query);
  if (scheme) return scheme[1] === "light";

  const min = /\(min-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query);
  const max = /\(max-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query);
  if (!min && !max) {
    console.warn(
      `[test-setup] matchMedia stub does not model "${query}"; answering false. ` +
        "Extend `matches()` in src/test-setup.ts if a component depends on it.",
    );
    return false;
  }
  if (min && viewportWidth < Number(min[1])) return false;
  if (max && viewportWidth > Number(max[1])) return false;
  return true;
}

/** Emulates a viewport width for the current test. Reset before each test. */
export function setTestViewportWidth(width: number) {
  viewportWidth = width;
}

beforeEach(() => {
  viewportWidth = TEST_VIEWPORT_WIDTH;
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    // A getter, not a value: MUI's useMediaQuery memoises the MediaQueryList
    // per query string, so a snapshot taken at creation would never reflect a
    // later setTestViewportWidth and no test could cross a breakpoint.
    get matches() {
      return matches(query);
    },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
