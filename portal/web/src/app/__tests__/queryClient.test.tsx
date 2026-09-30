import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@mui/material";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError, REPORTED_INLINE, resetErrorReporting, TRANSPORT_FAILURE } from "@/shared/api";
import { expectConsole, tRe } from "@/shared/testing";
import { GlobalErrorSnackbar } from "@/shared/ui";
import { createQueryClient } from "../providers/queryClient";

/**
 * No request failure may reach a user as nothing at all — the application's
 * wiring of it: both caches of `createQueryClient` report into the error net.
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

describe("the query client's error net", () => {
  let consoleError: ReturnType<typeof expectConsole>;

  beforeEach(() => {
    // Every report is logged — that is half of what this suite asserts.
    consoleError = expectConsole("error");
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

      await waitFor(() => expect(consoleError).toHaveBeenCalled());
      const logged = consoleError.mock.calls.flat().join(" ");
      expect(logged).toContain("corr-4242");
      expect(logged).toContain("ITEM_NAME_EXISTS");
      // The Error object is never handed to the console — that is what prints a
      // stack.
      expect(logged).not.toMatch(/\bat\s+\S+:\d+:\d+/);
      expect(logged).not.toContain("ApiError:");
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

      await waitFor(() => expect(consoleError).toHaveBeenCalled());
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

      const logged = consoleError.mock.calls.flat().join(" ");
      expect(logged).not.toContain("api.internal");
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

      const logged = consoleError.mock.calls.flat().join(" ");
      expect(logged).toContain("query failed");
      expect(logged).toContain("corr-4242");
    });
  });
});
