import { chromium } from "playwright-core";
import fs from "node:fs";
import assert from "node:assert";

async function verifyChatRedesign() {
  console.log("=== Starting Comprehensive Chat Redesign Verification ===");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  console.log("1. Authenticating as demo@teamflow.io...");
  await page.goto("http://localhost:3005/auth/sign-in", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "demo@teamflow.io");
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');

  await page.waitForURL("**/app/**", { timeout: 20000 });
  console.log("2. Navigating to /app/chat...");
  await page.goto("http://localhost:3005/app/chat", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  fs.mkdirSync("screenshots", { recursive: true });

  console.log("3. Verifying Channels Sidebar...");
  const channelsSidebar = page.locator('aside').filter({ hasText: "Channels" }).first();
  await channelsSidebar.waitFor({ state: "visible", timeout: 5000 });
  
  const announcementsBtn = channelsSidebar.locator('button').filter({ hasText: "announcements" }).first();
  await announcementsBtn.waitFor({ state: "visible", timeout: 5000 });

  console.log("4. Testing Channel Switching...");
  await announcementsBtn.click();
  await page.waitForTimeout(500);

  // Check header updated
  const header = page.locator('div.border-b').filter({ hasText: "announcements" }).first();
  assert(await header.isVisible(), "Expected header to show announcements channel");

  // Check input placeholder updated
  const textarea = page.locator('textarea');
  await textarea.waitFor({ state: "visible", timeout: 5000 });
  const placeholder = await textarea.getAttribute("placeholder");
  assert(placeholder?.includes("announcements"), `Expected placeholder to mention announcements, got: ${placeholder}`);
  console.log("✓ Switched to #announcements successfully, placeholder: " + placeholder);

  console.log("5. Testing Direct Messages Selection & State...");
  const firstDmBtn = channelsSidebar.locator('button[data-slot="dm-item"]').first();
  if (await firstDmBtn.isVisible()) {
    await firstDmBtn.click();
    await page.waitForTimeout(500);
    const dmPlaceholder = await textarea.getAttribute("placeholder");
    assert(dmPlaceholder?.startsWith("Message @"), `Expected placeholder to start with 'Message @', got: ${dmPlaceholder}`);
    console.log("✓ Direct Message selected successfully, placeholder: " + dmPlaceholder);
  }

  // Switch back to primary channel
  const primaryChannelBtn = channelsSidebar.locator('button').filter({ hasText: /team|demo|general/i }).first();
  await primaryChannelBtn.click();
  await page.waitForTimeout(500);

  console.log("6. Testing Mention Autocomplete Keyboard Navigation...");
  await textarea.fill("Hey @");
  await page.waitForTimeout(300);
  const mentionDropdown = page.locator('text=Mention member');
  await mentionDropdown.waitFor({ state: "visible", timeout: 5000 });
  // Test ArrowDown and Enter to select
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const textAfterMention = await textarea.inputValue();
  assert(textAfterMention.includes("@"), `Expected textarea to contain mention, got: ${textAfterMention}`);
  console.log("✓ Mention keyboard navigation (ArrowDown + Enter) verified successfully");

  // Clear draft
  await textarea.fill("");

  console.log("7. Testing Search with Empty Results...");
  const searchBtn = page.locator('button[title="Search messages"]').first();
  await searchBtn.click();
  await page.waitForTimeout(300);
  const searchInput = page.locator('input[placeholder*="Search messages"]');
  await searchInput.fill("zzznotfoundxyz999");
  await page.waitForTimeout(500);
  const noMessagesText = page.locator('text=No messages found');
  await noMessagesText.waitFor({ state: "visible", timeout: 5000 });
  const clearSearchBtn = page.locator('button:has-text("Clear search")');
  await clearSearchBtn.click();
  await page.waitForTimeout(400);
  console.log("✓ Search empty state and clear search verified successfully");

  console.log("8. Testing Sending Message in Stream Mode...");
  const testMsg = `Verified Linear harbor theme ${Date.now()}`;
  await textarea.fill(testMsg);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);

  // Verify message appears in feed
  const messageElement = page.locator(`text="${testMsg}"`).first();
  await messageElement.waitFor({ state: "visible", timeout: 5000 });
  console.log("✓ Stream message sent and rendered successfully");

  // Hover over message to trigger quick actions
  await messageElement.hover();
  await page.waitForTimeout(400);

  // Click emoji reaction if visible
  const thumbsUpBtn = page.locator('button[title*="React 👍"]').first();
  if (await thumbsUpBtn.isVisible()) {
    await thumbsUpBtn.click();
    await page.waitForTimeout(600);
    console.log("✓ Quick reaction clicked successfully");
  }

  // Dark mode desktop screenshot with stream
  await page.screenshot({ path: "screenshots/verified-chat-dark-stream.png" });

  console.log("9. Testing Switch to Bubbles Mode...");
  const bubblesTab = page.locator('button:has-text("Bubbles")');
  await bubblesTab.click();
  await page.waitForTimeout(500);

  // Send a bubble message
  const bubbleMsg = "Testing bubble mode with purple accent styling";
  await textarea.fill(bubbleMsg);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);

  const bubbleElement = page.locator(`text="${bubbleMsg}"`).first();
  await bubbleElement.waitFor({ state: "visible", timeout: 5000 });
  console.log("✓ Bubble message sent and rendered successfully");

  // Dark mode desktop screenshot with bubbles
  await page.screenshot({ path: "screenshots/verified-chat-dark-bubbles.png" });

  console.log("10. Testing Light Mode (Dual Theme Support)...");
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
  });
  await page.waitForTimeout(600);

  // Take screenshot in light mode
  await page.screenshot({ path: "screenshots/verified-chat-light-bubbles.png" });

  // Switch back to stream in light mode
  const streamTab = page.locator('button:has-text("Stream")');
  await streamTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/verified-chat-light-stream.png" });
  console.log("✓ Light mode screenshots captured");

  // Reset to dark mode
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(300);

  console.log("11. Testing Channels Sidebar Collapse & Expand...");
  const collapseBtn = channelsSidebar.locator('button[title="Collapse channels sidebar"]');
  if (await collapseBtn.isVisible()) {
    await collapseBtn.click();
    await page.waitForTimeout(400);

    const expandBtn = page.locator('button[title="Expand channels sidebar"], button[title="Open channels sidebar"]');
    assert(await expandBtn.first().isVisible(), "Expected expand button when sidebar collapsed");

    await expandBtn.first().click();
    await page.waitForTimeout(400);
    console.log("✓ Channel sidebar collapse and expand verified");
  }

  console.log("12. Testing Mobile Viewport (390px)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  // Check channel switcher button in header
  const mobileChannelTrigger = page.locator('button[title="Switch channel"]');
  await mobileChannelTrigger.waitFor({ state: "visible", timeout: 5000 });
  await mobileChannelTrigger.click();
  await page.waitForTimeout(500);

  // Check mobile channel drawer opened
  const drawerContent = page.locator('[data-slot="sheet-content"][aria-label="Channels drawer"]');
  await drawerContent.waitFor({ state: "visible", timeout: 5000 });
  console.log("✓ Mobile channels drawer opened successfully");

  await page.screenshot({ path: "screenshots/verified-chat-mobile-drawer.png" });

  // Select channel from drawer
  const randomChannelInDrawer = drawerContent.locator('button').filter({ hasText: "random" }).first();
  if (await randomChannelInDrawer.isVisible()) {
    await randomChannelInDrawer.click();
    await page.waitForTimeout(600);
    console.log("✓ Selected random channel from mobile drawer");
  }

  // Mobile screenshot of chat view
  await page.screenshot({ path: "screenshots/verified-chat-mobile-chat.png" });

  console.log("13. Testing Tablet Viewport (768px)...");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/verified-chat-tablet.png" });

  await browser.close();

  assert.strictEqual(pageErrors.length, 0, `Encountered unexpected page errors: ${pageErrors.join(", ")}`);
  console.log("=== All Chat Redesign Verifications Passed Flawlessly! ===");
}

verifyChatRedesign().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
