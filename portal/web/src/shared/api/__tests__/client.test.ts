import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createItem,
  deleteItem,
  getApiAbout,
  getBffAbout,
  getItem,
  getUserContext,
  listItems,
  logout,
  updateItem,
} from "../client";
import { browser, LOGIN_PATH, readCookie, resetLoginRedirect, XSRF_HEADER } from "../auth";
import { ApiError } from "../apiError";

/**
 * The client against a stubbed `fetch`: which request leaves the browser, and
 * what a response turns into. The BFF's two browser obligations — the CSRF
 * header on writes and the login redirect on a missing session — live in
 * middleware, so they are asserted here, through the real client, rather than
 * against the middleware in isolation.
 */

const ITEM_ID = "3f2a91c4-77b8-4e0a-9d31-6c5e2b8a4419";
const ITEM = {
  schemaVersion: 1,
  id: ITEM_ID,
  name: "Widget",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

function json(status: number, body: unknown, contentType = "application/json"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
}

const fetchMock = vi.fn<(request: Request) => Promise<Response>>();

function lastRequest(): Request {
  const calls = fetchMock.mock.calls;
  return calls[calls.length - 1][0];
}

function clearCookies() {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

// The Vitest config restores spies and stubbed globals before every test.
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(browser, "assign").mockImplementation(() => {});
  vi.spyOn(browser, "reload").mockImplementation(() => {});
  resetLoginRedirect();
  clearCookies();
});

describe("the portal client", () => {
  it("reads the item list under the BFF's base path", async () => {
    fetchMock.mockResolvedValue(json(200, { schemaVersion: 1, items: [ITEM] }));

    const list = await listItems();

    expect(list?.items).toHaveLength(1);
    const request = lastRequest();
    expect(request.method).toBe("GET");
    expect(new URL(request.url).pathname).toBe("/app/bff/v1/items");
  });

  it("puts the item id in the path", async () => {
    fetchMock.mockResolvedValue(json(200, ITEM));

    await getItem(ITEM_ID);

    expect(new URL(lastRequest().url).pathname).toBe(`/app/bff/v1/items/${ITEM_ID}`);
  });

  it("sends the request body as JSON on create and update", async () => {
    fetchMock.mockResolvedValue(json(201, ITEM));
    await createItem({ name: "Widget", description: "A thing" });
    expect(lastRequest().method).toBe("POST");
    expect(await lastRequest().json()).toEqual({ name: "Widget", description: "A thing" });

    fetchMock.mockResolvedValue(json(200, ITEM));
    await updateItem(ITEM_ID, { name: "Gadget" });
    expect(lastRequest().method).toBe("PUT");
    expect(await lastRequest().json()).toEqual({ name: "Gadget" });
  });

  it("resolves a delete answered with 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteItem(ITEM_ID)).resolves.toBeUndefined();
    expect(lastRequest().method).toBe("DELETE");
  });

  it("reads the caller, the BFF build and the API build", async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { schemaVersion: 1, subject: "dev", roles: ["ADMIN"] }),
    );
    expect((await getUserContext())?.subject).toBe("dev");
    expect(new URL(lastRequest().url).pathname).toBe("/app/bff/v1/user-context");

    const build = { version: "1.0.0", commit: "abc1234", builtAt: "2026-01-01T00:00:00Z" };
    fetchMock.mockResolvedValueOnce(json(200, { portalApiVersion: 1, build }));
    expect((await getBffAbout()).portalApiVersion).toBe(1);
    expect(new URL(lastRequest().url).pathname).toBe("/app/about");

    fetchMock.mockResolvedValueOnce(json(200, { schemaVersion: 1, build }));
    expect((await getApiAbout())?.build.commit).toBe("abc1234");
    expect(new URL(lastRequest().url).pathname).toBe("/app/bff/v1/about");
  });

  it("turns a Problem Details body into an ApiError with its code, correlation id and field errors", async () => {
    fetchMock.mockResolvedValue(
      json(
        400,
        {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          detail: "name must not be blank",
          code: "VALIDATION_FAILED",
          schemaVersion: 1,
          correlationId: "corr-1",
          errors: [{ field: "name", code: "NotBlank", message: "must not be blank" }],
        },
        "application/problem+json",
      ),
    );

    const error = await createItem({ name: "" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe("VALIDATION_FAILED");
    expect(apiError.correlationId).toBe("corr-1");
    expect(apiError.fieldErrors).toEqual([
      { field: "name", code: "NotBlank", message: "must not be blank" },
    ]);
    expect(apiError.upstreamUnavailable).toBe(false);
  });

  it("recognizes the BFF's 503 UPSTREAM_UNAVAILABLE", async () => {
    fetchMock.mockResolvedValue(
      json(503, { status: 503, code: "UPSTREAM_UNAVAILABLE", correlationId: "c", title: "t" }),
    );

    const error = (await listItems().catch((e: unknown) => e)) as ApiError;

    expect(error.upstreamUnavailable).toBe(true);
  });

  it("fails a BFF build read that a gateway refused", async () => {
    fetchMock.mockResolvedValue(new Response("Bad Gateway", { status: 502 }));

    await expect(getBffAbout()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("CSRF (ADR-010)", () => {
  it("copies the XSRF-TOKEN cookie into the header on a write", async () => {
    document.cookie = "XSRF-TOKEN=tok%3D123; path=/";
    fetchMock.mockResolvedValue(json(201, ITEM));

    await createItem({ name: "Widget" });

    expect(lastRequest().headers.get(XSRF_HEADER)).toBe("tok=123");
  });

  it("sends no header on a read", async () => {
    document.cookie = "XSRF-TOKEN=tok; path=/";
    fetchMock.mockResolvedValue(json(200, { schemaVersion: 1, items: [] }));

    await listItems();

    expect(lastRequest().headers.has(XSRF_HEADER)).toBe(false);
  });

  it("sends no header when there is no cookie, as in dev mode", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await deleteItem(ITEM_ID);

    expect(lastRequest().headers.has(XSRF_HEADER)).toBe(false);
  });

  it("reads one cookie among several", () => {
    document.cookie = "other=1; path=/";
    document.cookie = "XSRF-TOKEN=abc; path=/";

    expect(readCookie("XSRF-TOKEN")).toBe("abc");
    expect(readCookie("missing")).toBeUndefined();
  });
});

describe("a missing session (ADR-010)", () => {
  const unauthenticated = () =>
    json(401, { status: 401, code: "SESSION_REQUIRED", title: "Unauthorized", correlationId: "c" });

  it("sends the window to the BFF's login entry point", async () => {
    fetchMock.mockResolvedValue(unauthenticated());

    await expect(listItems()).rejects.toBeInstanceOf(ApiError);

    expect(browser.assign).toHaveBeenCalledWith(LOGIN_PATH);
    expect(LOGIN_PATH).toBe("/app/bff/oauth2/authorization/oidc");
  });

  it("navigates once when several requests fail together", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(unauthenticated()));

    await Promise.allSettled([listItems(), getUserContext(), getApiAbout()]);

    expect(browser.assign).toHaveBeenCalledTimes(1);
  });

  it("does not log in again for a 401 the application API itself returned", async () => {
    // A refused *upstream* token is not fixed by a browser login, and treating
    // it as one would loop.
    fetchMock.mockResolvedValue(
      json(401, { status: 401, code: "UNAUTHENTICATED", schemaVersion: 1 }),
    );

    await expect(listItems()).rejects.toBeInstanceOf(ApiError);

    expect(browser.assign).not.toHaveBeenCalled();
  });

  it("ignores a 401 whose body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 401 }));

    await expect(listItems()).rejects.toBeInstanceOf(ApiError);

    expect(browser.assign).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  it("posts to the BFF, with the CSRF header, then reloads", async () => {
    document.cookie = "XSRF-TOKEN=tok; path=/";
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await logout();

    const request = lastRequest();
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/app/bff/logout");
    expect(request.headers.get(XSRF_HEADER)).toBe("tok");
    expect(browser.reload).toHaveBeenCalled();
  });

  it("reloads even when the call fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(logout()).rejects.toThrow();

    expect(browser.reload).toHaveBeenCalled();
  });
});
