import { builtinEnvironments, type Environment } from "vitest/environments";

const jsdom = builtinEnvironments.jsdom;

/**
 * Vitest's jsdom environment, with Node's `Request` taught to accept jsdom's
 * `AbortSignal`.
 *
 * jsdom implements no `fetch`, so the environment leaves `fetch` and `Request`
 * to Node while replacing `AbortController` and `AbortSignal` with jsdom's.
 * From Node 24, `new Request(url, { signal })` refuses a signal that is not
 * Node's own — and the data router builds such a request for every
 * navigation, so each one would throw "Expected signal to be an instance of
 * AbortSignal".
 *
 * Putting Node's classes back would break the other direction, since jsdom's
 * `addEventListener(…, { signal })` accepts only jsdom's. So jsdom keeps its
 * classes, and `Request` alone translates: a foreign signal is replaced by one
 * of Node's that aborts when it does, with the same reason.
 */
export default {
  ...jsdom,
  name: "jsdom",
  async setup(global: typeof globalThis, options) {
    const NodeAbortController = global.AbortController;
    const NodeRequest = global.Request;
    const environment = await jsdom.setup(global, options);

    // Every signal is bridged, not only a foreign one: a request never keeps
    // the signal it was given — it follows it with one of its own — so a
    // bridge over a signal that was already Node's changes nothing.
    function nodeSignal(signal: AbortSignal): AbortSignal {
      const controller = new NodeAbortController();
      if (signal.aborted) controller.abort(signal.reason);
      else signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
      return controller.signal;
    }

    global.Request = class Request extends NodeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(input, init?.signal ? { ...init, signal: nodeSignal(init.signal) } : init);
      }
    };

    return {
      async teardown(target) {
        global.Request = NodeRequest;
        await environment.teardown(target);
      },
    };
  },
} satisfies Environment;
