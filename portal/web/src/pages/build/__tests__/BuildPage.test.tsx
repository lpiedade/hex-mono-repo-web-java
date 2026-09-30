import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getApiAbout, getBffAbout } from "@/shared/api";
import { renderWithProviders, t } from "@/shared/testing";
import { BuildPage } from "../ui/BuildPage";

vi.mock("@/shared/api/client", () => ({
  getBffAbout: vi.fn(),
  getApiAbout: vi.fn(),
}));

const BUILD = { version: "1.4.0", commit: "abc1234", builtAt: "2026-09-26T09:14:00Z" };

beforeEach(() => {
  vi.mocked(getBffAbout).mockResolvedValue({
    portalApiVersion: 1,
    build: { version: "2.0.0", commit: "def5678", builtAt: "2026-09-27T10:00:00Z" },
  });
  vi.mocked(getApiAbout).mockResolvedValue({ schemaVersion: 1, build: BUILD });
});

describe("BuildPage", () => {
  it("shows the build of the portal and of the API, side by side", async () => {
    renderWithProviders(<BuildPage />);

    const portal = screen.getByRole("region", { name: t("about.portal") });
    const api = screen.getByRole("region", { name: t("about.api") });
    await waitFor(() => expect(portal).toHaveTextContent("def5678"));
    expect(portal).toHaveTextContent("2.0.0");
    await waitFor(() => expect(api).toHaveTextContent("abc1234"));
    expect(api).toHaveTextContent("1.4.0");
    expect(api.querySelector(`time[datetime="${BUILD.builtAt}"]`)).not.toBeNull();
  });

  it("keeps the portal's answer when the API is down", async () => {
    vi.mocked(getApiAbout).mockRejectedValue(
      new ApiError(503, { code: "UPSTREAM_UNAVAILABLE", correlationId: "corr-a" }),
    );
    renderWithProviders(<BuildPage />);

    const api = screen.getByRole("region", { name: t("about.api") });
    await waitFor(() => expect(api).toHaveTextContent(t("error.upstreamUnavailable")));
    expect(screen.getByRole("region", { name: t("about.portal") })).toHaveTextContent("def5678");
  });
});
