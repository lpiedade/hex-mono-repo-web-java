import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectConsole } from "@/shared/testing";
import { useColorMode } from "../colorMode";

describe("useColorMode", () => {
  it("refuses to run outside its provider, rather than inventing a mode", () => {
    // React reports the render error it rethrows.
    expectConsole("error");

    expect(() => renderHook(() => useColorMode())).toThrow(/outside ColorModeProvider/);
  });
});
