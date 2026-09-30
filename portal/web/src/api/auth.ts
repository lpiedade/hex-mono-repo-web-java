import type { Middleware } from "openapi-fetch";
import { SESSION_REQUIRED } from "./errors";

/**
 * The browser half of the BFF's session model (ADR-010).
 *
 * The browser never holds a token. In `oidc` mode the BFF keeps the tokens in a
 * server-side session and the browser holds only the session cookie; in `dev`
 * mode the BFF is always authenticated. The same code serves both, because
 * everything here reacts to what the BFF answers rather than asking which mode
 * it runs in:
 *
 * - a proxied call without a session answers `401` with code `SESSION_REQUIRED`,
 *   and the SPA navigates the window to the BFF's login entry point;
 * - a mutating request carries `X-XSRF-TOKEN`, copied from the `XSRF-TOKEN`
 *   cookie the BFF sets. In `dev` mode there is no cookie and no header.
 */

/** Mount point of the SPA and the BFF, shared with the router's basename. */
export const APP_BASE_PATH = "/app";

/** The BFF's OIDC authorization entry point (Spring Security's default path). */
export const LOGIN_PATH = `${APP_BASE_PATH}/bff/oauth2/authorization/oidc`;

export const XSRF_COOKIE = "XSRF-TOKEN";
export const XSRF_HEADER = "X-XSRF-TOKEN";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

/**
 * Window navigation, behind a seam. jsdom cannot navigate, and its `location`
 * methods are not configurable, so tests replace these two functions instead of
 * spying on `window.location`.
 */
export const browser = {
  assign(url: string): void {
    window.location.assign(url);
  },
  reload(): void {
    window.location.reload();
  },
};

/** Reads one cookie by name, or `undefined` when it is absent. */
export function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return undefined;
}

/** Copies the CSRF cookie into the header Spring Security checks. */
export const csrfMiddleware: Middleware = {
  onRequest({ request }) {
    if (SAFE_METHODS.has(request.method.toUpperCase())) return undefined;
    const token = readCookie(XSRF_COOKIE);
    if (token) request.headers.set(XSRF_HEADER, token);
    return request;
  },
};

let redirecting = false;

/**
 * Sends the window to the BFF's login entry point, once.
 *
 * Several queries usually fail together when a session expires; without the
 * latch each would start its own navigation.
 */
export function redirectToLogin(): void {
  if (redirecting) return;
  redirecting = true;
  browser.assign(LOGIN_PATH);
}

/** Test seam: re-arms {@link redirectToLogin}. */
export function resetLoginRedirect(): void {
  redirecting = false;
}

/**
 * Turns the BFF's "no session" answer into a login.
 *
 * Keyed on the body's code and not on the status alone: a `401` the application
 * API itself returns (code `UNAUTHENTICATED`) means the relayed token was
 * refused, which a browser login would not fix and would turn into a redirect
 * loop. Only the BFF's own `SESSION_REQUIRED` means "log in".
 */
export const sessionMiddleware: Middleware = {
  async onResponse({ response }) {
    if (response.status !== 401) return undefined;
    try {
      const body: unknown = await response.clone().json();
      if (
        body &&
        typeof body === "object" &&
        (body as { code?: unknown }).code === SESSION_REQUIRED
      ) {
        redirectToLogin();
      }
    } catch {
      // Not a Problem Details body: leave it to the caller's error handling.
    }
    return undefined;
  },
};
