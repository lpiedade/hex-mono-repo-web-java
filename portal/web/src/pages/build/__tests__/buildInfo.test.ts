import { describe, expect, it } from "vitest";
import { display } from "../lib/buildInfo";

describe("display", () => {
  it("never prints the word unknown as a commit", () => {
    expect(display("unknown")).toBe("—");
    expect(display(undefined)).toBe("—");
    expect(display("abc")).toBe("abc");
  });
});
