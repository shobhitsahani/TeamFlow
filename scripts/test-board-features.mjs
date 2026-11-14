import { chromium } from "playwright-core";
import assert from "node:assert";

async function runFeaturesTest() {
  console.log("Starting board deep-link, group-by, and activity timeline verification test...");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  console.log("1. Authenticating alice@acme.io...");
  await page.goto("http://localhost:3005/auth/sign-in", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "alice@acme.io");
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');

  await page.waitForURL("**/app/**", { timeout: 20000 });
  await page.goto("http://localhost:3005/app/board", { waitUntil: "networkidle" });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("GSI_LOGGER") && !text.includes("accounts.google.com")) {
        errors.push(text);
      }
    }
  });

  console.log("2. Verifying card click opens side sheet and updates URL query param ?task=...");
  const firstCard = page.locator('[data-slot="lagoon-card"]').first();
  await firstCard.waitFor({ state: "visible", timeout: 10000 });
  await firstCard.click();

  const sheet = page.locator('[role="dialog"][data-slot="sheet-content"]');
  await sheet.waitFor({ state: "visible", timeout: 5000 });
  assert(page.url().includes("task="), `Expected URL to include ?task=..., got ${page.url()}`);

  console.log("3. Verifying Activity timeline tab in task details sheet...");
  const activityTab = page.locator('button:has-text("Activity timeline")');
  await activityTab.waitFor({ state: "visible", timeout: 3000 });
  await activityTab.click();
  await page.waitForTimeout(500);

  console.log("4. Verifying closing side sheet removes ?task= from URL...");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  assert(!page.url().includes("task="), `Expected URL to have removed ?task=..., got ${page.url()}`);

  console.log("5. Testing Group By dropdown (switch to Priority)...");
  const groupBtn = page.locator('button:has-text("Group:")');
  await groupBtn.waitFor({ state: "visible", timeout: 5000 });
  await groupBtn.click();

  const prioItem = page.locator('[data-slot="dropdown-menu-item"]:has-text("Priority")');
  await prioItem.waitFor({ state: "visible", timeout: 3000 });
  await prioItem.click();
  await page.waitForTimeout(500);

  const text = await page.textContent('.lagoon-cols');
  assert(text.includes("Critical") || text.includes("High"), "Columns did not group by priority");

  console.log("6. Switching Group By back to Status...");
  await groupBtn.click();
  const statusItem = page.locator('[data-slot="dropdown-menu-item"]:has-text("Status")');
  await statusItem.waitFor({ state: "visible", timeout: 3000 });
  await statusItem.click();
  await page.waitForTimeout(500);

  const statusColsText = await page.textContent('.lagoon-cols');
  assert(statusColsText.includes("Backlog") && statusColsText.includes("Done"), "Columns did not restore to Status");

  console.log("7. Final assertion on console and page errors...");
  assert.strictEqual(errors.length, 0, `Errors during feature test: ${errors.join(", ")}`);
  console.log("All board features PASSED successfully!");

  await browser.close();
}

runFeaturesTest().catch((err) => {
  console.error("Features test failed:", err);
  process.exit(1);
});
