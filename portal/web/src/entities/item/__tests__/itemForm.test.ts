import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_MAX_LENGTH,
  lengthOf,
  NAME_MAX_LENGTH,
  serverFieldErrors,
  toRequest,
  validateItem,
  valuesOf,
} from "../model/itemForm";

/** The contract's limits on `ItemRequest`, checked the way JSON Schema checks them. */
describe("the item form", () => {
  it("mirrors the contract's limits", () => {
    expect(NAME_MAX_LENGTH).toBe(120);
    expect(DESCRIPTION_MAX_LENGTH).toBe(1000);
  });

  it("requires a name, judged trimmed", () => {
    expect(validateItem({ name: "", description: "" }).name).toBe("items.form.errors.nameRequired");
    expect(validateItem({ name: "   ", description: "" }).name).toBe(
      "items.form.errors.nameRequired",
    );
    expect(validateItem({ name: "x", description: "" })).toEqual({});
  });

  it("accepts a name of exactly 120 characters and refuses 121", () => {
    expect(validateItem({ name: "a".repeat(120), description: "" })).toEqual({});
    expect(validateItem({ name: "a".repeat(121), description: "" }).name).toBe(
      "items.form.errors.nameTooLong",
    );
  });

  it("accepts a description of exactly 1000 characters and refuses 1001", () => {
    expect(validateItem({ name: "x", description: "d".repeat(1000) })).toEqual({});
    expect(validateItem({ name: "x", description: "d".repeat(1001) }).description).toBe(
      "items.form.errors.descriptionTooLong",
    );
  });

  it("counts code points, as JSON Schema does, not UTF-16 units", () => {
    const emoji = "😀";
    expect(emoji.length).toBe(2);
    expect(lengthOf(emoji)).toBe(1);
    expect(validateItem({ name: emoji.repeat(120), description: "" })).toEqual({});
  });

  it("trims the request and leaves an empty description out", () => {
    expect(toRequest({ name: "  Widget ", description: "   " })).toEqual({ name: "Widget" });
    expect(toRequest({ name: "Widget", description: " A thing " })).toEqual({
      name: "Widget",
      description: "A thing",
    });
  });

  it("seeds from an item, or blank for a new one", () => {
    expect(valuesOf(undefined)).toEqual({ name: "", description: "" });
    expect(
      valuesOf({
        schemaVersion: 1,
        id: "i",
        name: "Widget",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      }),
    ).toEqual({ name: "Widget", description: "" });
  });

  it("keeps only the server's field errors that name a field of this form", () => {
    expect(
      serverFieldErrors([
        { field: "name", code: "Size", message: "size must be between 1 and 120" },
        { field: "description", code: "Size" },
        { field: "owner", code: "NotNull" },
      ]),
    ).toEqual({ name: "size must be between 1 and 120", description: "Size" });
  });
});
