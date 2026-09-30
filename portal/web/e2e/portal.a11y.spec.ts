import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { tAny, tAnyExact } from "./i18n";

/**
 * Automated accessibility evidence for the portal (ADR-013, WCAG 2.2 AA).
 *
 * These run against the production bundle in a real browser, because contrast,
 * focus order and semantics are properties of the rendered document and a jsdom
 * approximation cannot see them. There is no BFF behind `vite preview`, so
 * every data call fails: each screen is audited in the state it renders
 * without data, which is a state users meet too. What these do not replace is
 * a manual screen-reader pass.
 */
const ROUTES = [
  { path: "", name: "home" },
  { path: "items", name: "items" },
  { path: "build", name: "build information" },
  { path: "no-such-page", name: "not found" },
];

/**
 * The ruleset is pinned to the WCAG 2.2 AA tags rather than left at axe's
 * default, which would silently widen or narrow with the library version.
 */
function audit(page: Page) {
  return new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22aa",
  ]);
}

/** Naming the rule and the target makes a failure actionable from the log alone. */
function summarize(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
  );
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

for (const route of ROUTES) {
  test(`${route.name} has no WCAG 2.2 AA violations`, async ({ page }) => {
    await open(page, route.path);

    const results = await audit(page).analyze();
    expect(summarize(results.violations), `axe violations on /${route.path}`).toEqual([]);
  });
}

/**
 * Contrast is a property of the palette *and* of what a screen paints with it,
 * so every route is checked in both themes. The SPA takes its first theme from
 * `prefers-color-scheme`, so the scheme is emulated before the page loads.
 */
for (const route of ROUTES) {
  test(`both themes meet AA contrast — ${route.name}`, async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, route.path);
      const results = await audit(page).withRules(["color-contrast"]).analyze();
      expect(
        summarize(results.violations),
        `contrast violations on /${route.path} in the ${scheme} theme`,
      ).toEqual([]);
    }
  });
}

/**
 * WCAG 2.2 SC 1.4.10 names 320 CSS pixels as the width at which
 * two-dimensional scrolling must not be required.
 */
for (const route of ROUTES) {
  test(`reflows at 320px without a horizontal scrollbar — ${route.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await open(page, route.path);

    const { scrollWidth, clientWidth, widest } = await page.evaluate(() => {
      const doc = document.documentElement;
      // Naming the widest offender turns a bare boolean failure into something
      // actionable.
      let widest = "";
      let widestRight = 0;
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
        const right = el.getBoundingClientRect().right;
        if (right > widestRight) {
          widestRight = right;
          const cls = String(el.className || "").split(" ")[0];
          widest = `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} (right=${Math.round(right)})`;
        }
      }
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, widest };
    });

    expect(
      scrollWidth,
      `${route.name} overflows at 320px (scrollWidth=${scrollWidth}, clientWidth=${clientWidth}); widest: ${widest}`,
    ).toBeLessThanOrEqual(clientWidth + 1);
  });
}

/** The rail's destinations, by key: the labels are the bundles' to reword. */
const NAV_DESTINATIONS = ["nav.home", "nav.items", "nav.about"];

test("every destination stays reachable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page, "");

  await page.getByRole("button", { name: tAny("nav.open") }).click();
  const rail = page.getByRole("navigation", { name: tAny("nav.label") });

  // Each destination by name, not a count: a floor would still pass if one were
  // dropped and another duplicated.
  for (const destination of NAV_DESTINATIONS) {
    await expect(
      rail.getByRole("link", { name: tAnyExact(destination) }),
      `destination "${destination}" is unreachable at 320px`,
    ).toBeVisible();
  }
});

/**
 * The rail switches at MUI's `sm`, which is 600px. The boundary is asserted
 * rather than inferred from a comfortably wide viewport.
 */
test("the permanent rail is present at the sm boundary and absent below it", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await open(page, "");

  const rail = page.getByRole("navigation", { name: tAny("nav.label") });
  await expect(rail.getByRole("link", { name: tAnyExact("nav.home") })).toBeVisible();
  expect(await page.getByRole("button", { name: tAny("nav.open") }).count()).toBe(0);

  await page.setViewportSize({ width: 599, height: 800 });
  await expect(page.getByRole("button", { name: tAny("nav.open") })).toBeVisible();
});

/**
 * An open dialog and an inline field error are states the route sweep never
 * reaches. The create form renders without the API, so both are audited.
 */
test("the item form, and its inline error, meet AA in both themes", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    // Reduced motion stills the dialog's fade, so axe reads the settled colors
    // rather than a frame of the transition.
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await open(page, "items");

    await page.getByRole("button", { name: tAnyExact("items.create") }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(summarize((await audit(page).analyze()).violations), `open form, ${scheme}`).toEqual([]);

    await dialog.getByRole("button", { name: tAnyExact("common.create") }).click();
    const name = dialog.getByRole("textbox", { name: tAny("items.fields.name") });
    // Programmatic, not just visual: a field that only turns red says nothing
    // to a screen reader about why the form did not submit.
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toBeFocused();
    const describedBy = await name.getAttribute("aria-describedby");
    expect(describedBy, "the error text is not associated with the field").toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(
      tAny("items.form.errors.nameRequired"),
    );
    expect(summarize((await audit(page).analyze()).violations), `errored form, ${scheme}`).toEqual(
      [],
    );
  }
});

test("reduced motion removes non-essential animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "");

  // MUI's `mui-auto-fill-*` keyframes are excluded deliberately: they paint
  // nothing and exist only so a field can detect Chrome's autofill.
  const animated = await page.evaluate(() =>
    Array.from(document.querySelectorAll("*"))
      .filter((el) => {
        const style = getComputedStyle(el);
        return (
          style.animationName !== "none" &&
          style.animationDuration !== "0s" &&
          !style.animationName.startsWith("mui-auto-fill")
        );
      })
      .map((el) => `${el.tagName}: ${getComputedStyle(el).animationName}`),
  );
  expect(animated, "elements still animating under reduced motion").toEqual([]);
});

test("the skip link is the first tab stop and actually skips", async ({ page }) => {
  await open(page, "");

  await page.keyboard.press("Tab");
  const skip = page.locator(":focus");
  await expect(skip).toBeVisible();
  await expect(skip).toHaveAttribute("href", "#main-content");

  await page.keyboard.press("Enter");

  // Following the link must move focus to the target, not merely scroll to it.
  const landing = await page.evaluate(() => {
    const active = document.activeElement;
    const main = document.querySelector("main#main-content");
    const nav = document.querySelector("nav");
    return {
      inMain: !!active && !!main && main.contains(active),
      inNav: !!active && !!nav && nav.contains(active),
      active: active ? active.tagName + (active.id ? `#${active.id}` : "") : "none",
    };
  });
  expect(landing.inMain, `focus landed on ${landing.active}, not inside <main>`).toBe(true);
  expect(landing.inNav, "focus stayed in the navigation the skip link exists to bypass").toBe(false);
});

test("every focus stop is visible while tabbing through the shell", async ({ page }) => {
  await open(page, "");

  const seen: string[] = [];
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    if ((await focused.count()) === 0) continue;
    await expect(focused).toBeVisible();
    seen.push(await focused.evaluate((el) => el.tagName + ":" + (el.textContent ?? "").trim()));
  }

  expect(new Set(seen).size, "tab order revisits the same control immediately").toBeGreaterThan(1);
});
