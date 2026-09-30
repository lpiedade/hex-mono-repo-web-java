import type { FieldError } from "../../api/errors";
import type { Item, ItemRequest } from "../../api/client";

/**
 * The limits `ItemRequest` declares in `openapi-v1.yaml`. The API enforces
 * them either way; checking them here only saves a round trip and puts the
 * message beside the field.
 */
export const NAME_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 1000;

export interface ItemFormValues {
  name: string;
  description: string;
}

export type ItemField = keyof ItemFormValues;

/** An i18n key per field, under `items.form.errors`. */
export type ItemFormErrors = Partial<Record<ItemField, string>>;

/**
 * JSON Schema counts `maxLength` in code points, and `String.length` counts
 * UTF-16 units — an emoji is one of the first and two of the second. Counting
 * the way the contract does keeps a 120-character name from being refused here
 * and accepted there.
 */
export function lengthOf(value: string): number {
  return [...value].length;
}

export function valuesOf(item: Item | undefined): ItemFormValues {
  return { name: item?.name ?? "", description: item?.description ?? "" };
}

/**
 * Returns the error key for each invalid field; an empty object means valid.
 * The name is judged trimmed, because a name of spaces is not a name.
 */
export function validateItem(values: ItemFormValues): ItemFormErrors {
  const errors: ItemFormErrors = {};
  const name = values.name.trim();
  if (name.length === 0) {
    errors.name = "items.form.errors.nameRequired";
  } else if (lengthOf(name) > NAME_MAX_LENGTH) {
    errors.name = "items.form.errors.nameTooLong";
  }
  if (lengthOf(values.description.trim()) > DESCRIPTION_MAX_LENGTH) {
    errors.description = "items.form.errors.descriptionTooLong";
  }
  return errors;
}

/** The request body: trimmed, with an empty description left out entirely. */
export function toRequest(values: ItemFormValues): ItemRequest {
  const description = values.description.trim();
  return {
    name: values.name.trim(),
    ...(description ? { description } : {}),
  };
}

/**
 * The server's field errors that name a field of this form, keyed by field.
 * Anything else stays in the banner, which shows the whole problem anyway.
 */
export function serverFieldErrors(
  errors: readonly FieldError[],
): Partial<Record<ItemField, string>> {
  const byField: Partial<Record<ItemField, string>> = {};
  for (const error of errors) {
    if (error.field === "name" || error.field === "description") {
      byField[error.field] = error.message ?? error.code;
    }
  }
  return byField;
}
