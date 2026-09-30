import { queryOptions } from "@tanstack/react-query";
import { getApiAbout, getBffAbout } from "@/shared/api";

/**
 * The build coordinates of each deliverable. Only this page reads them, so the
 * queries live in the page's slice rather than in an entity — they move down a
 * layer the day a second screen needs them (ADR-027, "pages first").
 */
export const buildKeys = {
  all: ["build"] as const,
  bff: () => [...buildKeys.all, "bff"] as const,
  api: () => [...buildKeys.all, "api"] as const,
};

export const buildQueries = {
  /** The BFF's own build — this process, which ships with the bundle. */
  bff: () => queryOptions({ queryKey: buildKeys.bff(), queryFn: getBffAbout }),
  /** The application API's build, proxied through the BFF. */
  api: () => queryOptions({ queryKey: buildKeys.api(), queryFn: getApiAbout }),
};
