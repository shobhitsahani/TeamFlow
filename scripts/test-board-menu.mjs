import { chromium } from "playwright-core";
import assert from "node:assert";

async function runRegressionTest() {
  console.log("Starting board header menu regression test...");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const boardConsoleErrors = [];
  const pageErrors = [];

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  console.log("1. Authenticating via /auth/sign-in...");
  await page.goto("http://localhost:3005/auth/sign-in", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "alice@acme.io");
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');

  console.log("2. Navigating to /app/board...");
  await page.waitForURL("**/app/**", { timeout: 20000 });
  if (!page.url().includes("/app/board")) {
    await page.goto("http://localhost:3005/app/board", { waitUntil: "networkidle" });
  }
  await page.waitForLoadState("networkidle");

  // Track console errors only from /app/board
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore external third-party GSI iframe / telemetry noise if any
      if (!text.includes("GSI_LOGGER") && !text.includes("accounts.google.com")) {
        boardConsoleErrors.push(text);
      }
    }
  });

  console.log("3. Locating and clicking 'More options' button...");
  const moreBtn = page.locator('button[aria-label="More options"]');
  await moreBtn.waitFor({ state: "visible", timeout: 10000 });
  await moreBtn.click();
  await page.waitForTimeout(500);

  // Assert no unhandled page errors or Base UI context crashes
  assert.strictEqual(pageErrors.length, 0, `Page errors thrown on open: ${pageErrors.join(", ")}`);
  assert.strictEqual(boardConsoleErrors.length, 0, `Console errors logged on open: ${boardConsoleErrors.join(", ")}`);

  console.log("4. Verifying menu contents and groups...");
  const menuContent = page.locator('[data-slot="dropdown-menu-content"]');
  await menuContent.waitFor({ state: "visible", timeout: 3000 });

  const text = await menuContent.textContent();
  assert(text.includes("Account"), "Missing 'Account' group");
  assert(text.includes("Open profile"), "Missing 'Open profile' item");
  assert(text.includes("Settings"), "Missing 'Settings' item");
  assert(text.includes("Go to (this project)"), "Missing 'Go to (this project)' group");
  assert(text.includes("Board"), "Missing 'Board' item");
  assert(text.includes("Timeline"), "Missing 'Timeline' item");
  assert(text.includes("Calendar"), "Missing 'Calendar' item");

  console.log("5. Verifying active state checkmark on Board view...");
  const boardItem = page.locator('[data-slot="dropdown-menu-item"]:has-text("Board")');
  const checkIcon = boardItem.locator("svg");
  assert.strictEqual(await checkIcon.count(), 2, "Expected icons (columns + check) on active Board view item");

  console.log("6. Clicking Timeline in menu...");
  const timelineItem = page.locator('[data-slot="dropdown-menu-item"]:has-text("Timeline")');
  await timelineItem.click();
  await page.waitForTimeout(800);

  // Menu should close on item select
  assert.strictEqual(await menuContent.isVisible(), false, "Menu did not close upon item select");
  assert(page.url().includes("view=timeline"), `Expected URL to include view=timeline, got ${page.url()}`);
  assert.strictEqual(pageErrors.length, 0, `Page errors thrown after timeline switch: ${pageErrors.join(", ")}`);

  console.log("7. Testing Escape key behavior and focus restoration...");
  await moreBtn.click();
  await menuContent.waitFor({ state: "visible", timeout: 3000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  assert.strictEqual(await menuContent.isVisible(), false, "Menu did not close upon Escape key press");
  const isFocused = await moreBtn.evaluate((el) => document.activeElement === el);
  assert(isFocused, "Focus did not return to the 'More options' trigger button");

  console.log("8. Testing responsive width at 390px...");
  await page.setViewportSize({ width: 390, height: 844 });
  await moreBtn.click();
  await menuContent.waitFor({ state: "visible", timeout: 3000 });

  const box = await menuContent.boundingBox();
  assert(box !== null, "Could not get bounding box for menu content");
  assert(box.x >= 0, `Menu overflows off-screen to the left (x = ${box.x})`);
  assert(box.x + box.width <= 390, `Menu overflows off-screen to the right (x+w = ${box.x + box.width})`);

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 800 });

  console.log("9. Verifying restored Theme UI Switcher button in board header...");
  const themeBtn = page.locator('#board-theme-mode');
  await themeBtn.waitFor({ state: "visible", timeout: 5000 });
  const initialDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  console.log(`Current dark mode state: ${initialDark}`);

  // Click theme switcher to toggle mode
  await themeBtn.click();
  await page.waitForTimeout(500);
  const toggledDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  assert.strictEqual(toggledDark, !initialDark, "Clicking theme switcher button did not toggle .dark class");
  console.log(`Toggled dark mode state: ${toggledDark}`);

  // Toggle back to original mode
  await themeBtn.click();
  await page.waitForTimeout(500);
  const restoredDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  assert.strictEqual(restoredDark, initialDark, "Theme switcher button did not restore initial mode");

  console.log("10. Final assertions: checking for console/page errors across entire run...");
  assert.strictEqual(pageErrors.length, 0, `Page errors: ${pageErrors.join(", ")}`);
  assert.strictEqual(boardConsoleErrors.length, 0, `Console errors: ${boardConsoleErrors.join(", ")}`);

  console.log("All regression assertions PASSED successfully!");
  await browser.close();
}

runRegressionTest().catch((err) => {
  console.error("Regression test failed:", err);
  process.exit(1);
});
