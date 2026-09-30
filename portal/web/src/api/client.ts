import createClient from "openapi-fetch";
import type { components, paths } from "./portal-api.d";
import {
  APP_BASE_PATH,
  browser,
  csrfMiddleware,
  sessionMiddleware,
} from "./auth";
import { toApiError } from "./errors";

export type Item = components["schemas"]["Item"];
export type ItemRequest = components["schemas"]["ItemRequest"];
export type UserContext = components["schemas"]["UserContext"];

/**
 * The typed client for `portal-api-v1.yaml` (ADR-012). Every call is checked at
 * compile time against the generated `paths`, and `apiContract.test.ts` checks
 * at test time that every route called here is one the contract declares.
 *
 * The base URL is absolute on purpose: `Request` rejects a relative URL outside
 * a browser, and the origin is the SPA's own, so nothing changes in one.
 * `fetch` is resolved per call rather than captured at creation, so a test can
 * stub `globalThis.fetch` after this module has loaded.
 */
const bffClient = createClient<paths>({
  baseUrl: `${window.location.origin}${APP_BASE_PATH}`,
  fetch: (request) => globalThis.fetch(request),
  credentials: "same-origin",
});
bffClient.use(csrfMiddleware, sessionMiddleware);

// ── System ───────────────────────────────────────────────────────────────────

export async function getUserContext() {
  const { data, error, response } = await bffClient.GET("/bff/v1/user-context");
  if (error) throw toApiError(response.status, error);
  return data;
}

/**
 * The BFF's own build coordinates — this process, not the application API. The
 * BFF and the SPA ship as one deliverable, so the two agree by construction;
 * the API is the artifact that can genuinely lag.
 */
export async function getBffAbout() {
  const { data, error, response } = await bffClient.GET("/about");
  // The contract declares no error response here, so `error` is typed `never`;
  // a proxy or gateway in front of the BFF can still answer one.
  if (!response.ok || !data) throw toApiError(response.status, error as unknown);
  return data;
}

/** The application API's build coordinates, proxied through the BFF. */
export async function getApiAbout() {
  const { data, error, response } = await bffClient.GET("/bff/v1/about");
  if (error) throw toApiError(response.status, error);
  return data;
}

/**
 * Ends the browser session, then reloads so the BFF decides what comes next: a
 * login in `oidc` mode, the same page in `dev` mode. The reload happens even if
 * the call fails — a session the user asked to leave should not stay on screen.
 */
export async function logout() {
  try {
    await bffClient.POST("/bff/logout");
  } finally {
    browser.reload();
  }
}

// ── Items ────────────────────────────────────────────────────────────────────

/** Every item, whole — the list is not paged, so the screen sorts it in memory. */
export async function listItems() {
  const { data, error, response } = await bffClient.GET("/bff/v1/items");
  if (error) throw toApiError(response.status, error);
  return data;
}

export async function getItem(itemId: string) {
  const { data, error, response } = await bffClient.GET("/bff/v1/items/{itemId}", {
    params: { path: { itemId } },
  });
  if (error) throw toApiError(response.status, error);
  return data;
}

export async function createItem(body: ItemRequest) {
  const { data, error, response } = await bffClient.POST("/bff/v1/items", { body });
  if (error) throw toApiError(response.status, error);
  return data;
}

export async function updateItem(itemId: string, body: ItemRequest) {
  const { data, error, response } = await bffClient.PUT("/bff/v1/items/{itemId}", {
    params: { path: { itemId } },
    body,
  });
  if (error) throw toApiError(response.status, error);
  return data;
}

export async function deleteItem(itemId: string) {
  const { error, response } = await bffClient.DELETE("/bff/v1/items/{itemId}", {
    params: { path: { itemId } },
  });
  if (error) throw toApiError(response.status, error);
}
