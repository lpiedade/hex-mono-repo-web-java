import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, reportError, resetErrorReporting } from "@/shared/api";
import { expectConsole, renderWithProviders, tRe } from "@/shared/testing";
import { GlobalErrorSnackbar } from "../GlobalErrorSnackbar";

/**
 * The visible half of the error net: what a reported failure looks like to the
 * user. `app/__tests__/queryClient.test.tsx` covers which failures reach it.
 *
 * `reportError` is called from outside React here, as the mutation cache calls
 * it, so each report's re-render is flushed inside `act`.
 */

const PROBLEM = new ApiError(409, {
  detail: "An item with this name already exists",
  code: "ITEM_NAME_EXISTS",
  correlationId: "corr-4242",
});

function report(error: unknown) {
  act(() => {
    reportError(error, "mutation");
  });
}

describe("GlobalErrorSnackbar", () => {
  beforeEach(() => {
    // Every report is logged as well as shown.
    expectConsole("error");
    renderWithProviders(<GlobalErrorSnackbar />);
  });

  afterEach(() => {
    resetErrorReporting();
  });

  /** The copyable summary is the sanitized pair, nothing more. */
  it("offers the sanitized summary for copying", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    report(PROBLEM);

    await user.click(screen.getByRole("button", { name: tRe("error.apiCopySummary") }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("ITEM_NAME_EXISTS");
    expect(copied).toContain("corr-4242");
    expect(copied).not.toMatch(/\bat\s+\S+:\d+:\d+/);
  });

  it("keeps the report on screen when the clipboard refuses", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    report(PROBLEM);

    await user.click(screen.getByRole("button", { name: tRe("error.apiCopySummary") }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByRole("alert")).toHaveTextContent("corr-4242");
    expect(screen.queryByText(tRe("error.apiCopied"))).not.toBeInTheDocument();
  });

  /**
   * A retried or re-submitted action can report the same failure repeatedly.
   * One snackbar per report would bury the screen it is trying to inform, so an
   * identical message arriving while the current one is open is dropped.
   */
  it("raises one snackbar however many times the same failure is reported", () => {
    act(() => {
      for (let i = 0; i < 5; i++) reportError(PROBLEM, "mutation");
    });

    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("replaces the snackbar when a different failure arrives", () => {
    report(PROBLEM);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    report(new ApiError(500, { detail: "Something broke upstream" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/something broke upstream/i);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("shows an unreachable application API as the service being unavailable", () => {
    report(
      new ApiError(503, {
        detail: "The application API did not answer",
        code: "UPSTREAM_UNAVAILABLE",
        correlationId: "corr-503",
      }),
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(tRe("error.upstreamUnavailable"));
    expect(alert).toHaveTextContent("corr-503");
  });
});
