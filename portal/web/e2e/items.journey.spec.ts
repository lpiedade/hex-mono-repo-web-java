import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { tAny, tAnyExact } from "./i18n";

/**
 * Browser acceptance against the **real** portal, BFF, API and database
 * (ADR-014). Mocked HTTP explicitly does not satisfy this: the point is to
 * prove the stack answers, not that a stub does.
 *
 * `E2E_BASE_URL` is the portal's base as the browser reaches it — for example
 * `http://localhost:8081/app/`. Without it the project has no `baseURL` and
 * this suite fails, deliberately: a browser suite that quietly does not run
 * reports a check that never happened.
 *
 * The BFF must be in `dev` mode, or already hold a session, for the browser to
 * reach the screens without an interactive login.
 */

/*
 * The variable itself is checked, not the `baseURL` fixture: when a project
 * leaves `baseURL` undefined, Playwright fills it from `webServer`, so the
 * fixture would point at `vite preview` and the suite would run against a
 * portal with no BFF behind it instead of failing.
 */
test.beforeEach(async () => {
  expect(
    process.env.E2E_BASE_URL,
    "E2E_BASE_URL is not set — the journey suite needs a running stack, and skipping " +
      "it would report a browser check that never happened",
  ).toBeTruthy();
});

/** A name no other run shares, so parallel and repeated runs never collide. */
function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function answered(page: Page, method: string, path: RegExp) {
  return page.waitForResponse(
    (r) => r.request().method() === method && path.test(new URL(r.url()).pathname),
  );
}

test("an item is created, edited and deleted through the real stack", async ({ page }) => {
  const name = uniqueName("Journey item");
  const renamed = `${name} (edited)`;

  // ── The list is served by the API, not by fixtures ──────────────────────────
  const listed = answered(page, "GET", /\/bff\/v1\/items$/);
  await page.goto("items");
  expect((await listed).status()).toBe(200);
  const table = page.getByRole("table", { name: tAny("items.caption") });
  await expect(table).toBeVisible();
  await expect(table.locator("caption")).toHaveCount(1);

  // ── Create ──────────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: tAnyExact("items.create") }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: tAny("items.fields.name") }).fill(name);
  await dialog
    .getByRole("textbox", { name: tAny("items.fields.description") })
    .fill("Created by the browser journey.");
  const created = answered(page, "POST", /\/bff\/v1\/items$/);
  await dialog.getByRole("button", { name: tAnyExact("common.create") }).click();
  expect((await created).status()).toBe(201);
  await expect(dialog).toBeHidden();
  await expect(table.getByRole("row", { name: new RegExp(escape(name)) })).toBeVisible();

  // The populated table is the state the a11y suite cannot reach without data.
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);

  // ── Edit ────────────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: tAnyExact("items.edit", { name }) }).click();
  dialog = page.getByRole("dialog");
  const nameField = dialog.getByRole("textbox", { name: tAny("items.fields.name") });
  await expect(nameField).toHaveValue(name);
  await nameField.fill(renamed);
  const updated = answered(page, "PUT", /\/bff\/v1\/items\/[0-9a-f-]+$/);
  await dialog.getByRole("button", { name: tAnyExact("common.save") }).click();
  expect((await updated).status()).toBe(200);
  await expect(dialog).toBeHidden();
  await expect(table.getByRole("row", { name: new RegExp(escape(renamed)) })).toBeVisible();

  // ── Delete ──────────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: tAnyExact("items.delete", { name: renamed }) }).click();
  dialog = page.getByRole("dialog");
  const deleted = answered(page, "DELETE", /\/bff\/v1\/items\/[0-9a-f-]+$/);
  await dialog.getByRole("button", { name: tAnyExact("common.delete") }).click();
  expect((await deleted).status()).toBe(204);
  await expect(dialog).toBeHidden();
  await expect(table.getByRole("row", { name: new RegExp(escape(renamed)) })).toHaveCount(0);
});

test("the identity card shows who the BFF says is signed in", async ({ page }) => {
  const context = answered(page, "GET", /\/bff\/v1\/user-context$/);
  await page.goto("");
  const response = await context;
  expect(response.status()).toBe(200);
  const { subject } = (await response.json()) as { subject: string };

  await expect(page.getByRole("region", { name: tAny("identity.label") })).toContainText(subject);
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
