/**
 * Public API of the `item` entity — the template's example aggregate. Replace
 * it with the project's first real aggregate in one move: this slice, the
 * features that act on it, and the page that shows it (ADR-027).
 *
 * It holds what every screen about items shares: the contract's types, the
 * query keys and options, and the form model that mirrors the contract's
 * limits. What a user does to an item is a feature (`edit-item`,
 * `delete-item`), not the entity's.
 */
export type { Item, ItemRequest } from "@/shared/api";
export { itemKeys, itemQueries } from "./api/itemQueries";
export {
  DESCRIPTION_MAX_LENGTH,
  lengthOf,
  NAME_MAX_LENGTH,
  serverFieldErrors,
  toRequest,
  validateItem,
  valuesOf,
  type ItemField,
  type ItemFormErrors,
  type ItemFormValues,
} from "./model/itemForm";
