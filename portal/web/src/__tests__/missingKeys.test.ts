import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n, { reportMissingKey, resetMissingKeyReports, SUPPORTED_LOCALES } from "../i18n";
import { expectConsole } from "../test-setup";

/**
 * An unresolved translation key is a defect, not UI text.
 *
 * i18next's default for a key it cannot resolve is to render the key itself,
 * and with no `saveMissing` there is not even a console line — a status
 * interpolated from an `undefined` value would reach the screen as a dotted
 * identifier and nothing would report it.
 */
describe("a missing i18n key", () => {
  // The report *is* console output, so every test here declares it.
  let consoleError: ReturnType<typeof expectConsole>;

  beforeEach(() => {
    resetMissingKeyReports();
    consoleError = expectConsole("error");
  });

  afterEach(() => {
    resetMissingKeyReports();
  });

  it("is reported when i18next cannot resolve it", () => {
    i18n.t("items.status.undefined");

    expect(consoleError).toHaveBeenCalled();
    const logged = consoleError.mock.calls.flat().join(" ");
    expect(logged).toContain("items.status.undefined");
    expect(logged).toContain("Add it to every bundle");
  });

  it("still renders as the key, so a translation gap is not a blank screen", () => {
    expect(i18n.t("items.status.undefined")).toBe("items.status.undefined");
  });

  /**
   * A missing key inside a list would otherwise log once per row and bury
   * whatever else the console was saying.
   */
  it("is reported once however many times it is rendered", () => {
    for (let i = 0; i < 10; i++) i18n.t("nav.doesNotExist");

    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("reports two different keys separately", () => {
    reportMissingKey(["en-US"], "one.missing");
    reportMissingKey(["en-US"], "another.missing");

    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it("does not fire for keys every bundle carries", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of ["nav.home", "nav.items", "nav.about", "items.title"]) {
        expect(i18n.t(key, { lng: locale }), `${key} in ${locale}`).not.toBe(key);
      }
    }
    expect(consoleError).not.toHaveBeenCalled();
  });
});
