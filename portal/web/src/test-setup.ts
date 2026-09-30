import "@testing-library/jest-dom";
import type { MockInstance } from "vitest";

/**
 * **A test fails on console output it did not ask for.**
 *
 * `console.error` and `console.warn` are where React reports an update outside
 * `act()`, a missing key or an invalid prop, where MUI reports a misused
 * component, and where the portal reports a missing translation. A suite that
 * lets them scroll past stays green while each of those defects ships, and a
 * suite that mutes them wholesale hides them for good.
 *
 * So both are captured for every test and, unless the test declared the output
 * with {@link expectConsole}, the test fails afterwards with the captured lines
 * in its message. React's "not wrapped in act(...)" warning fails a test even
 * when it declared console errors: no test is about one, and a suite that
 * expects the portal's own logging must not become a place where they hide.
 */
type ConsoleLevel = "error" | "warn";
type ConsoleSpy = MockInstance<(...args: unknown[]) => void>;

const LEVELS: readonly ConsoleLevel[] = ["error", "warn"];
const expected = new Set<ConsoleLevel>();
const captured: Record<ConsoleLevel, unknown[][]> = { error: [], warn: [] };
const spies = new Map<ConsoleLevel, ConsoleSpy>();

/**
 * Declares that the running test expects `console.<level>` output, and returns
 * the spy so the test can assert what was written. The output is still kept
 * off the terminal.
 */
export function expectConsole(level: ConsoleLevel): ConsoleSpy {
  expected.add(level);
  const spy = spies.get(level);
  if (!spy) throw new Error("expectConsole is only available inside a test");
  return spy;
}

function describeArgument(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

beforeEach(() => {
  expected.clear();
  for (const level of LEVELS) {
    captured[level] = [];
    const spy = vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      captured[level].push(args);
    });
    spies.set(level, spy as ConsoleSpy);
  }
});

/** Output no test may expect — see above. */
const NEVER_EXPECTED = /not wrapped in act\(/;

afterEach(() => {
  const lines = (level: ConsoleLevel) =>
    captured[level].map((args) => args.map(describeArgument).join(" "));
  const unexpected = LEVELS.map((level) => ({
    level,
    lines: expected.has(level)
      ? lines(level).filter((line) => NEVER_EXPECTED.test(line))
      : lines(level),
  })).filter(({ lines: found }) => found.length > 0);
  if (unexpected.length === 0) return;

  const report = unexpected
    .map(
      ({ level, lines: found }) =>
        `console.${level} was called ${found.length} time(s):\n` +
        found.map((line) => `  ${line}`).join("\n"),
    )
    .join("\n");
  throw new Error(
    `${report}\nFix the cause, or declare the output with expectConsole() if the test is about it.`,
  );
});

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
