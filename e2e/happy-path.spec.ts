import { expect, test, type Page } from "@playwright/test";

const DEMO_EMAIL = "alex@northstar.studio";
const DEMO_PASSWORD = "ikizen-demo-123";

/** Primary sidebar navigation (the mobile nav is hidden at desktop width). */
function sidebarLink(page: Page, name: string) {
  return page.getByRole("navigation").getByRole("link", { name, exact: true }).first();
}

// Keep the run hermetic: the icon font stylesheet comes from Google Fonts and can stall the "load" event offline.
/** An order in the "Recent Sales Register" list (each entry is one link). */
function registerEntry(page: Page, reference: string) {
  return page.getByRole("region", { name: "Recent Sales Register" }).getByRole("link", { name: new RegExp(`#${reference}\\b`) });
}

test.beforeEach(async ({ context }) => {
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
});

test("a signed-in user runs the core sales flow end to end", async ({ page }) => {
  const stamp = Date.now().toString(36);
  const company = `E2E Robotics ${stamp}`;
  const contactEmail = `ops+${stamp}@e2e-robotics.test`;
  let reference = "";

  await test.step("sign in lands on the dashboard", async () => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(DEMO_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /^Good (morning|afternoon|evening), Alex\.$/ })).toBeVisible();
  });

  await test.step("add a customer", async () => {
    await sidebarLink(page, "Customers").click();
    await expect(page).toHaveURL(/\/customers/);
    await page.getByRole("link", { name: "Add Customer" }).click();
    const dialog = page.getByRole("dialog", { name: "Add New Customer" });
    await dialog.getByLabel("Company Name").fill(company);
    await dialog.getByLabel("Key Contact").fill("Rae Kim");
    await dialog.getByLabel("Email Address").fill(contactEmail);
    await dialog.getByLabel("Industry").fill("Robotics");
    await dialog.getByRole("button", { name: "Save Customer" }).click();

    await expect(page).toHaveURL(/\/customers\?customer=\d+/);
    const profile = page.getByRole("dialog");
    await expect(profile.getByRole("heading", { name: company })).toBeVisible();
    await profile.getByRole("link", { name: "Close", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("table").getByRole("link", { name: company, exact: true })).toBeVisible();
  });

  await test.step("create and confirm a sale for that customer", async () => {
    await sidebarLink(page, "Sales").click();
    await expect(page).toHaveURL(/\/sales/);
    const form = page.getByRole("region", { name: "Create New Sale" });
    // "Cancel" resets the composer to a single empty work item.
    await form.getByRole("button", { name: "Cancel" }).click();
    await form.getByLabel("Client Account").selectOption({ label: `${company} (${contactEmail})` });
    await form.getByLabel("Work item 1 title").fill("Warehouse automation discovery");
    await form.getByLabel("Quantity").fill("2");
    await form.getByLabel("Unit Rate").fill("750");
    await form.getByRole("checkbox", { name: /Early Settlement Incentive/ }).uncheck();
    await expect(form.getByRole("region", { name: "Totals" })).toContainText("$1,500.00");
    await form.getByRole("button", { name: "Confirm & Create Invoice" }).click();

    await expect(page).toHaveURL(/\/sales\?order=SL-\d+/);
    reference = new URL(page.url()).searchParams.get("order") ?? "";
    expect(reference).toMatch(/^SL-\d+$/);
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { name: `#${reference}` })).toBeVisible();
    await expect(drawer.getByText(company)).toBeVisible();

    await drawer.getByRole("link", { name: "Close", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toBeHidden();
    const entry = registerEntry(page, reference);
    await expect(entry).toBeVisible();
    await expect(entry).toContainText(company);
    await expect(entry).toContainText("Invoiced");
    await expect(entry).toContainText("$1,500.00");
  });

  await test.step("record a payment for the full balance", async () => {
    await registerEntry(page, reference).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { name: `#${reference}` })).toBeVisible();
    await drawer.getByLabel("Amount ($)").fill("1500");
    await drawer.getByRole("button", { name: "Record Payment" }).click();

    await expect(drawer.getByText("Payment recorded. The order is paid in full and now completed.")).toBeVisible();
    await expect(drawer.getByRole("progressbar", { name: "Paid share" })).toHaveAttribute("aria-valuenow", "100");
    await expect(drawer.getByText("Completed", { exact: true }).first()).toBeVisible();

    await drawer.getByRole("link", { name: "Close", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toBeHidden();
    const entry = registerEntry(page, reference);
    await expect(entry).toContainText("Completed");
    await expect(entry).toContainText("Paid in full");
  });

  await test.step("move a task to another column with the Move to select", async () => {
    await sidebarLink(page, "Tasks").click();
    await expect(page).toHaveURL(/\/tasks/);
    const todo = page.getByRole("region", { name: "To Do" });
    const card = todo.getByRole("article").first();
    const title = (await card.getByRole("heading").innerText()).trim();
    await card.getByLabel(`Move ${title} to`).selectOption({ label: "In Progress" });

    const inProgress = page.getByRole("region", { name: "In Progress" });
    await expect(inProgress.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(todo.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
    // The move survives a reload, so it was persisted, not only applied optimistically.
    await page.reload();
    await expect(page.getByRole("region", { name: "In Progress" }).getByRole("heading", { name: title, exact: true })).toBeVisible();
  });

  await test.step("sign out returns to the login page", async () => {
    await page.getByRole("button", { name: /Account menu for/ }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
