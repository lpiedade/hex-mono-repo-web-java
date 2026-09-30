import { describe, expect, it } from "vitest";
import { initialsOf } from "../lib/initialsOf";

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("ada.lovelace")).toBe("AL");
    expect(initialsOf("grace hopper")).toBe("GH");
    expect(initialsOf("alan_turing@example.org")).toBe("AT");
  });

  it("takes the first two characters of a single word", () => {
    expect(initialsOf("dev")).toBe("DE");
  });

  it("shows a neutral placeholder while there is no subject", () => {
    expect(initialsOf(undefined)).toBe("··");
    expect(initialsOf("")).toBe("··");
  });
});
