import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@mui/material";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import { ApiError } from "../api/errors";
import { createQueryClient } from "../queryClient";
import { expectConsole } from "../test-setup";
import { tRe } from "./test-utils";
import {
  REPORTED_INLINE,
  reportError,
  resetErrorReporting,
  subscribeToErrors,
  TRANSPORT_FAILURE,
} from "../api/errorReporting";
import { GlobalErrorSnackbar } from "../components/GlobalErrorSnackbar";

/**
 * No request failure may reach a user as nothing at all.
 *
 * The defect this suite exists for: a mutation rejects, the screen renders no
 * `isError`, and *nothing happens anywhere* — React Query v5 has no `logger`
 * option, so there is not even a console line to find.
 */

const PROBLEM = new ApiError(409, {
  detail: "An item with this name already exists",
  code: "ITEM_NAME_EXISTS",
  correlationId: "corr-4242",
});

/**
 * The application's own `QueryClient`, with retries off so a rejection arrives
 * once and immediately. Everything else — both caches and their `onError` — is
 * the production wiring, imported rather than reproduced.
 */
function renderWith(ui: ReactElement) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      {ui}
      <GlobalErrorSnackbar />
    </QueryClientProvider>,
  );
}

/** A screen that fails and reports nothing itself — the defective shape. */
function SilentScreen({ meta }: { meta?: typeof REPORTED_INLINE }) {
  const mutation = useMutation({
    ...(meta ? { meta } : {}),
    mutationFn: () => Promise.reject(PROBLEM),
  });
  return <Button onClick={() => mutation.mutate()}>act</Button>;
}

describe("the global error safety net", () => {
  beforeEach(() => {
    // Every report is logged — that is half of what this suite asserts.
    expectConsole("error");
  });

  afterEach(() => {
    resetErrorReporting();
  });

  describe("a mutation no screen reports", () => {
    it("is shown to the user with its message, code and correlation id", async () => {
      const user = userEvent.setup();
      renderWith(<SilentScreen />);

      await user.click(screen.getByRole("button", { name: "act" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/already exists/i);
      expect(alert).toHaveTextContent("ITEM_NAME_EXISTS");
      expect(alert).toHaveTextContent("corr-4242");
    });

    /** The id is what a user hands to whoever reads the server logs. */
    it("is logged with the correlation id, and without a stack", async () => {
      const user = userEvent.setup();
      renderWith(<SilentScreen />);

      await user.click(screen.getByRole("button", { name: "act" }));

      await waitFor(() => expect(console.error).toHaveBeenCalled());
      const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
      expect(logged).toContain("corr-4242");
      expect(logged).toContain("ITEM_NAME_EXISTS");
      // The Error object is never handed to the console — that is what prints a
      // stack.
      expect(logged).not.toMatch(/\bat\s+\S+:\d+:\d+/);
      expect(logged).not.toContain("ApiError:");
    });

    /** The copyable summary is the sanitized pair, nothing more. */
    it("offers the sanitized summary for copying", async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });
      renderWith(<SilentScreen />);

      await user.click(screen.getByRole("button", { name: "act" }));
      await user.click(await screen.findByRole("button", { name: tRe("error.apiCopySummary") }));

      await waitFor(() => expect(writeText).toHaveBeenCalled());
      const copied = writeText.mock.calls[0][0] as string;
      expect(copied).toContain("ITEM_NAME_EXISTS");
      expect(copied).toContain("corr-4242");
      expect(copied).not.toMatch(/\bat\s+\S+:\d+:\d+/);
    });

    it("keeps the report on screen when the clipboard refuses", async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });
      renderWith(<SilentScreen />);

      await user.click(screen.getByRole("button", { name: "act" }));
      await user.click(await screen.findByRole("button", { name: tRe("error.apiCopySummary") }));

      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(screen.getByRole("alert")).toHaveTextContent("corr-4242");
      expect(screen.queryByText(tRe("error.apiCopied"))).not.toBeInTheDocument();
    });
  });

  /**
   * Exactly one visible report: a screen already rendering the failure must not
   * also get a snackbar. The log still happens, so a dismissed banner leaves a
   * trace.
   */
  describe("a mutation the screen reports inline", () => {
    it("is logged but not shown twice", async () => {
      const user = userEvent.setup();
      renderWith(<SilentScreen meta={REPORTED_INLINE} />);

      await user.click(screen.getByRole("button", { name: "act" }));

      await waitFor(() => expect(console.error).toHaveBeenCalled());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("a transport failure", () => {
    /**
     * A plain `Error`'s message is a browser string that can name an internal
     * URL, so it is replaced by a sentinel and translated rather than shown.
     */
    it("is reported as the generic unavailability message, not its own text", async () => {
      const user = userEvent.setup();
      function NetworkDown() {
        const mutation = useMutation({
          mutationFn: () =>
            Promise.reject(new Error("Failed to fetch http://api.internal:8080/api/v1/items")),
        });
        return <Button onClick={() => mutation.mutate()}>act</Button>;
      }
      renderWith(<NetworkDown />);

      await user.click(screen.getByRole("button", { name: "act" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(tRe("error.bffUnavailable"));
      expect(alert).not.toHaveTextContent("api.internal");
      expect(alert).not.toHaveTextContent(TRANSPORT_FAILURE);

      const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
      expect(logged).not.toContain("api.internal");
    });
  });

  describe("repeated failures", () => {
    /**
     * A retried or re-submitted action can report the same failure repeatedly.
     * One snackbar per report would bury the screen it is trying to inform, so
     * an identical message arriving while the current one is open is dropped.
     */
    // `reportError` is called from outside React here, as the mutation cache
    // calls it, so each report's re-render is flushed inside act.
    it("raise one snackbar however many times the same one is reported", () => {
      renderWith(<div />);

      act(() => {
        for (let i = 0; i < 5; i++) reportError(PROBLEM, "mutation");
      });

      expect(screen.getAllByRole("alert")).toHaveLength(1);
    });

    it("replace the snackbar when a different failure arrives", () => {
      renderWith(<div />);

      act(() => {
        reportError(PROBLEM, "mutation");
      });
      expect(screen.getByRole("alert")).toBeInTheDocument();

      act(() => {
        reportError(new ApiError(500, { detail: "Something broke upstream" }), "mutation");
      });

      expect(screen.getByRole("alert")).toHaveTextContent(/something broke upstream/i);
      expect(screen.getAllByRole("alert")).toHaveLength(1);
    });
  });

  describe("an unreachable application API", () => {
    it("is shown as the service being unavailable, with its correlation id", () => {
      renderWith(<div />);

      act(() => {
        reportError(
          new ApiError(503, {
            detail: "The application API did not answer",
            code: "UPSTREAM_UNAVAILABLE",
            correlationId: "corr-503",
          }),
          "mutation",
        );
      });

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(tRe("error.upstreamUnavailable"));
      expect(alert).toHaveTextContent("corr-503");
    });
  });

  /**
   * A failed *read* is logged and not shown. Every screen renders its own
   * unavailable state, so a snackbar beside it would be a double report.
   */
  describe("a failing query", () => {
    it("is logged but never shown, leaving the page state to the screen", async () => {
      function ScreenWithOwnState() {
        const query = useQuery({
          queryKey: ["fails"],
          queryFn: () => Promise.reject(PROBLEM),
        });
        return <div>{query.isError ? "unavailable" : "loading"}</div>;
      }
      renderWith(<ScreenWithOwnState />);

      expect(await screen.findByText("unavailable")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
      expect(logged).toContain("query failed");
      expect(logged).toContain("corr-4242");
    });
  });

  describe("the subscription seam", () => {
    it("stops notifying an unsubscribed listener", () => {
      const seen: string[] = [];
      const unsubscribe = subscribeToErrors((e) => seen.push(e.detail));

      reportError(PROBLEM, "mutation");
      unsubscribe();
      reportError(PROBLEM, "mutation");

      expect(seen).toHaveLength(1);
    });

    it("gives every report a distinct id, so a repeat is still a new event", () => {
      const ids: number[] = [];
      subscribeToErrors((e) => ids.push(e.id));

      reportError(PROBLEM, "mutation");
      reportError(PROBLEM, "mutation");

      expect(new Set(ids).size).toBe(2);
    });
  });
});
