import { parse } from "yaml";
import { describe, expect, it } from "vitest";
// Both files are read as text, on purpose. A mock of `api/client` cannot satisfy
// this suite, and `?raw` keeps it free of `@types/node` — which this project
// keeps out of `tsconfig.json`'s `types` so browser code cannot reach for Node
// globals.
import contractYaml from "../../../../docs/arch/api-layer/portal-api-v1.yaml?raw";
import clientSource from "../api/client.ts?raw";
import { NAV_ITEMS } from "../layout/navItems";

/**
 * Every route `api/client.ts` calls is one `portal-api-v1.yaml` declares
 * (ADR-012).
 *
 * The screen suites mock `api/client` itself, so a route removed from the
 * contract is never requested during a test and every screen stays green while
 * firing 404s in production. `tsc` catches it too, but only once the types are
 * regenerated and the compiler is run. This suite reads the contract as data
 * and the client as text, so it fails on the *contract* changing as readily as
 * on the client changing.
 *
 * Only one direction is a defect. A contract may declare an operation the
 * portal has no screen for yet; a client may not call one the BFF does not
 * serve.
 */

const HTTP_METHODS = ["get", "put", "post", "patch", "delete", "head", "options"] as const;

interface Operation {
  responses?: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
}

const contract = parse(contractYaml) as {
  servers?: { url: string }[];
  paths: Record<string, Record<string, Operation | undefined>>;
};

/** `GET /bff/v1/items` → the operation, as declared. */
const declared = new Map<string, Operation>();
for (const [path, item] of Object.entries(contract.paths ?? {})) {
  for (const method of HTTP_METHODS) {
    const operation = item?.[method];
    if (operation) declared.set(`${method.toUpperCase()} ${path}`, operation);
  }
}

/** Routes the client calls through `openapi-fetch`, e.g. `bffClient.GET("/bff/v1/items")`. */
function typedClientCalls(source: string): string[] {
  return [...source.matchAll(/bffClient\.([A-Z]+)\(\s*"([^"]+)"/g)].map(
    (match) => `${match[1]} ${match[2]}`,
  );
}

/** The schema name a declared response carries, e.g. `ItemList`. */
function responseSchema(operation: string, status: string): string | undefined {
  const ref = declared.get(operation)?.responses?.[status]?.content?.["application/json"]?.schema
    ?.$ref;
  return ref?.split("/").pop();
}

const calls = typedClientCalls(clientSource);

describe("the portal client and the BFF contract", () => {
  /*
    An extractor that silently matched nothing would make every assertion below
    pass while checking nothing at all. These bounds are sanity floors, not
    counts to maintain.
  */
  it("extracts operations from both files", () => {
    expect(declared.size).toBeGreaterThanOrEqual(8);
    expect(calls.length).toBeGreaterThanOrEqual(8);
  });

  it("calls no route the contract does not declare", () => {
    const undeclared = calls.filter((call) => !declared.has(call));
    expect(
      undeclared,
      "routes called by src/api/client.ts but absent from portal-api-v1.yaml",
    ).toEqual([]);
  });

  it("serves the SPA and the BFF from the base the client and router assume", () => {
    // `APP_BASE_PATH` in api/auth.ts, the router's basename, and Vite's `base`
    // all say `/app`; the contract is where that value is decided.
    expect(contract.servers?.[0]?.url).toBe("/app");
  });

  it("leaves the BFF's own paths to the BFF", () => {
    // The SPA and the BFF share one origin under `/app`. A client route whose
    // first segment is also a contract path's — `/about`, `/health`, `/bff` —
    // would be answered by the BFF on a reload, with JSON instead of the page.
    const reserved = new Set([...declared.keys()].map((op) => op.split(" ")[1].split("/")[1]));
    const clientSegments = NAV_ITEMS.map((item) => item.to.split("/")[1]).filter(Boolean);
    expect(clientSegments.filter((segment) => reserved.has(segment))).toEqual([]);
  });

  describe("the response shapes the items screen assumes", () => {
    it("answers the collection with an ItemList, which is fetched whole", () => {
      expect(
        responseSchema("GET /bff/v1/items", "200"),
        "ItemsPage sorts the list in memory because it is not paged",
      ).toBe("ItemList");
    });

    it("answers a create and an update with the item", () => {
      expect(responseSchema("POST /bff/v1/items", "201")).toBe("Item");
      expect(responseSchema("PUT /bff/v1/items/{itemId}", "200")).toBe("Item");
    });

    it("answers a delete with no body", () => {
      const deleted = declared.get("DELETE /bff/v1/items/{itemId}")?.responses?.["204"];
      expect(deleted, "ItemsPage reads nothing back from a delete").toBeDefined();
      expect(deleted?.content).toBeUndefined();
    });
  });
});
