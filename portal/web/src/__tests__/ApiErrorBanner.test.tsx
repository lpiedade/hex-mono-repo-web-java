import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n, { DEFAULT_LOCALE } from "../i18n";
import { ApiError } from "../api/errors";
import { ApiErrorBanner } from "../components/ApiErrorBanner";
import { renderWithProviders, tRe } from "./test-utils";

function render(error: unknown) {
  return renderWithProviders(<ApiErrorBanner error={error} />);
}

describe("ApiErrorBanner", () => {
  describe("a transport error (plain Error)", () => {
    it("shows the generic unreachable message", () => {
      render(new Error("network timeout"));
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(tRe("error.bffUnavailable"))).toBeInTheDocument();
    });

    it("does not reveal the internal error message", () => {
      render(new Error("ECONNREFUSED 127.0.0.1:8080"));
      expect(screen.queryByText(/ECONNREFUSED/i)).not.toBeInTheDocument();
    });
  });

  describe("a Problem Details refusal", () => {
    const err = new ApiError(409, {
      title: "Conflict",
      status: 409,
      detail: "An item with this name already exists.",
      code: "ITEM_NAME_EXISTS",
      correlationId: "13e6d336-abcd-1234",
    });

    it("shows the API detail, the stable code and the correlation id", () => {
      render(err);
      expect(screen.getByText("An item with this name already exists.")).toBeInTheDocument();
      expect(screen.getByText(/ITEM_NAME_EXISTS/)).toBeInTheDocument();
      expect(screen.getByText(/13e6d336-abcd-1234/)).toBeInTheDocument();
    });

    it("does not show the generic unreachable message", () => {
      render(err);
      expect(screen.queryByText(tRe("error.bffUnavailable"))).not.toBeInTheDocument();
    });

    it("copies the sanitized summary", async () => {
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });
      render(err);

      await user.click(screen.getByRole("button", { name: tRe("error.apiCopySummary") }));

      await waitFor(() => expect(writeText).toHaveBeenCalled());
      const copied = writeText.mock.calls[0][0] as string;
      expect(copied).toContain("ITEM_NAME_EXISTS");
      expect(copied).toContain("13e6d336-abcd-1234");
      expect(copied).not.toContain("already exists");
    });
  });

  describe("the BFF's 503 UPSTREAM_UNAVAILABLE", () => {
    const err = new ApiError(503, {
      detail: "Connection refused to http://api:8080",
      code: "UPSTREAM_UNAVAILABLE",
      correlationId: "corr-503",
    });

    it("says the service is unavailable instead of printing the detail", () => {
      render(err);
      expect(screen.getByText(tRe("error.upstreamUnavailable"))).toBeInTheDocument();
      expect(screen.queryByText(/Connection refused/)).not.toBeInTheDocument();
    });

    it("still carries the correlation id", () => {
      render(err);
      expect(screen.getByText(/corr-503/)).toBeInTheDocument();
    });

    it("is not triggered by a 503 with some other code", () => {
      render(new ApiError(503, { detail: "Maintenance window", code: "MAINTENANCE" }));
      expect(screen.getByText("Maintenance window")).toBeInTheDocument();
      expect(screen.queryByText(tRe("error.upstreamUnavailable"))).not.toBeInTheDocument();
    });
  });

  describe("a refusal without a correlation id or code", () => {
    const err = new ApiError(500, { detail: "Internal server error." });

    it("shows the detail and offers nothing to copy", () => {
      render(err);
      expect(screen.getByText("Internal server error.")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: tRe("error.apiCopySummary") }),
      ).not.toBeInTheDocument();
    });
  });

  describe("another locale", () => {
    afterEach(async () => {
      await i18n.changeLanguage(DEFAULT_LOCALE);
    });

    it("renders its own copy in the active locale", async () => {
      await i18n.changeLanguage("pt-BR");
      render(new ApiError(409, { detail: "Conflito.", code: "CONFLICT", correlationId: "id-001" }));
      expect(
        screen.getByRole("button", { name: tRe("error.apiCopySummary", { lng: "pt-BR" }) }),
      ).toBeInTheDocument();
    });
  });
});
