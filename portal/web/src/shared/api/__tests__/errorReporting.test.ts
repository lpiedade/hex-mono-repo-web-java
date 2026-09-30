import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expectConsole } from "@/shared/testing";
import { ApiError } from "../apiError";
import { reportError, resetErrorReporting, subscribeToErrors } from "../errorReporting";

const PROBLEM = new ApiError(409, {
  detail: "An item with this name already exists",
  code: "ITEM_NAME_EXISTS",
  correlationId: "corr-4242",
});

describe("the error net's subscription seam", () => {
  beforeEach(() => {
    // Every report is logged.
    expectConsole("error");
  });

  afterEach(() => {
    resetErrorReporting();
  });

  it("stops notifying an unsubscribed listener", () => {
    const seen: string[] = [];
    const unsubscribe = subscribeToErrors((e) => seen.push(e.detail));

    reportError(PROBLEM, "mutation");
    unsubscribe();
    reportError(PROBLEM, "mutation");

    expect(seen).toHaveLength(1);
  });

  it("gives every report a distinct id, so a repeat is still a new event", () => {
    const ids: number[] = [];
    subscribeToErrors((e) => ids.push(e.id));

    reportError(PROBLEM, "mutation");
    reportError(PROBLEM, "mutation");

    expect(new Set(ids).size).toBe(2);
  });

  it("logs a report the screen renders inline, but tells no listener", () => {
    const seen: string[] = [];
    subscribeToErrors((e) => seen.push(e.detail));

    reportError(PROBLEM, "mutation", { reportedInline: true });

    expect(seen).toEqual([]);
  });
});
