import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getApiAbout, getBffAbout, getUserContext } from "@/shared/api";
import { t } from "@/shared/testing";
import { App } from "../App";

vi.mock("@/shared/api/client", () => ({
  getUserContext: vi.fn(),
  logout: vi.fn(),
  getBffAbout: vi.fn(),
  getApiAbout: vi.fn(),
}));

const BUILD = { version: "1.4.0", commit: "abc1234", builtAt: "2026-09-26T09:14:00Z" };

beforeEach(() => {
  vi.mocked(getUserContext).mockResolvedValue({ schemaVersion: 1, subject: "dev", roles: [] });
  vi.mocked(getBffAbout).mockResolvedValue({ portalApiVersion: 1, build: BUILD });
  vi.mocked(getApiAbout).mockResolvedValue({ schemaVersion: 1, build: BUILD });
});

describe("App", () => {
  it("mounts under the /app base path and toggles the theme", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/app/build");
    render(<App />);

    expect(
      await screen.findByRole("heading", { level: 1, name: t("about.title") }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: t("theme.toggleDark") }));
    expect(screen.getByRole("button", { name: t("theme.toggleLight") })).toBeInTheDocument();
    window.history.pushState({}, "", "/");
  });
});
