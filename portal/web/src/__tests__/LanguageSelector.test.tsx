import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import i18n, { DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from "../i18n";
import { LanguageSelector } from "../components/LanguageSelector";
import { renderWithProviders, tRe } from "./test-utils";

describe("LanguageSelector", () => {
  afterEach(async () => {
    await i18n.changeLanguage(DEFAULT_LOCALE);
    localStorage.clear();
  });

  it("opens the menu with every supported locale as its autonym", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageSelector />);

    await user.click(screen.getByRole("button", { name: tRe("language.select") }));

    expect(screen.getByRole("menuitem", { name: "English" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Português (Brasil)" })).toBeInTheDocument();
  });

  it("switches the language, persists the choice and updates the document language", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageSelector />);

    await user.click(screen.getByRole("button", { name: tRe("language.select") }));
    await user.click(screen.getByRole("menuitem", { name: "Português (Brasil)" }));

    await waitFor(() => expect(i18n.language).toBe("pt-BR"));
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
    // The control's own label is localized, so it now reads in Portuguese.
    expect(
      screen.getByRole("button", { name: tRe("language.select", { lng: "pt-BR" }) }),
    ).toBeInTheDocument();
  });
});
