import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * README screenshots, not a test. Excluded from `pnpm test:e2e` (only `*.spec.ts` runs there);
 * `pnpm screenshots` runs this file against the same isolated E2E server and database.
 */
const DEMO_EMAIL = "alex@northstar.studio";
const DEMO_PASSWORD = "ikizen-demo-123";
const OUT_DIR = "docs/screenshots";
/** Google Fonts responses are cached here (gitignored) so later runs do not re-download the 4 MB icon font. */
const FONT_CACHE_DIR = "data/font-cache";
const FONT_TIMEOUT_MS = 600_000;

test.beforeEach(async ({ context }) => {
  mkdirSync(FONT_CACHE_DIR, { recursive: true });
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
    const url = route.request().url();
    const key = createHash("sha1").update(url).digest("hex");
    const body = join(FONT_CACHE_DIR, key);
    const meta = `${body}.type`;
    if (existsSync(body)) {
      const contentType = existsSync(meta) ? readFileSync(meta, "utf8") : url.includes("gstatic") ? "font/woff2" : "text/css";
      return route.fulfill({ status: 200, body: readFileSync(body), contentType, headers: { "access-control-allow-origin": "*" } });
    }
    const response = await route.fetch({ timeout: FONT_TIMEOUT_MS });
    if (response.ok()) {
      writeFileSync(body, await response.body());
      writeFileSync(meta, response.headers()["content-type"] ?? "");
    }
    return route.fulfill({ response });
  });
});

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  // The icon font comes from Google Fonts; wait for it so icons render instead of ligature text.
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 600_000))]));
  await page.waitForTimeout(500);
}

async function capture(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: `${OUT_DIR}/${name}.jpg`, type: "jpeg", quality: 85, timeout: FONT_TIMEOUT_MS });
}

test("capture README screenshots", async ({ page }) => {
  test.setTimeout(1_200_000);

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Work email").fill(DEMO_EMAIL);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /^Good (morning|afternoon|evening), Alex\.$/ })).toBeVisible();
  await capture(page, "dashboard");

  await page.goto("/customers", { waitUntil: "domcontentloaded" });
  await page.getByRole("table").getByRole("link").first().click();
  await expect(page).toHaveURL(/\/customers\?customer=\d+/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await capture(page, "customers");

  await page.goto("/sales", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("region", { name: "Recent Sales Register" })).toBeVisible();
  await capture(page, "sales");

  await page.goto("/tasks", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("region", { name: "To Do" })).toBeVisible();
  await capture(page, "tasks");

  await page.goto("/invoices/INV-2047", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("INV-2047").first()).toBeVisible();
  await capture(page, "invoice");

  await page.goto("/reports", { waitUntil: "domcontentloaded" });
  await capture(page, "reports");

  await page.goto("/settings?tab=members", { waitUntil: "domcontentloaded" });
  await capture(page, "settings-members");

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Search and commands" });
  await expect(palette).toBeVisible();
  await palette.getByPlaceholder(/Search customers/).fill("hyp");
  await page.waitForTimeout(800);
  await capture(page, "command-palette");
});
