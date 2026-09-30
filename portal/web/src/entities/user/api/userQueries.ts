import { queryOptions } from "@tanstack/react-query";
import { getUserContext } from "@/shared/api";

/** The query keys of the signed-in user. */
export const userKeys = {
  all: ["user"] as const,
  context: () => [...userKeys.all, "context"] as const,
};

export const userQueries = {
  /** Who is signed in, and the roles the API grants them (`GET /bff/v1/user-context`). */
  context: () => queryOptions({ queryKey: userKeys.context(), queryFn: getUserContext }),
};
