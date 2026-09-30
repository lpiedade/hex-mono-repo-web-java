import { queryOptions } from "@tanstack/react-query";
import { listItems } from "@/shared/api";

/**
 * The query keys of the item collection. Every read and every invalidation of
 * an item query takes its key from here, so the two cannot drift apart.
 */
export const itemKeys = {
  /** The root: invalidating it re-reads every item query. */
  all: ["items"] as const,
  list: () => [...itemKeys.all, "list"] as const,
};

/**
 * Key and function together, so a screen, a prefetch and an invalidation name
 * the same query.
 */
export const itemQueries = {
  /** Every item, whole: the contract does not page the list (ADR-024). */
  list: () => queryOptions({ queryKey: itemKeys.list(), queryFn: listItems }),
};
