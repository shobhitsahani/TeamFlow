import { chromium } from "playwright-core";
import assert from "node:assert";

async function runPasswordResetTest() {
  console.log("Starting password reset feature verification test...");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  console.log("1. Navigating to /auth/sign-in...");
  await page.goto("http://localhost:3005/auth/sign-in", { waitUntil: "networkidle" });

  console.log("2. Pre-filling email input...");
  await page.fill('#login-email', "shobhitsahani28@gmail.com");

  console.log("3. Clicking 'Forgot password?'...");
  const forgotBtn = await page.waitForSelector('text=Forgot password?');
  await forgotBtn.click();

  console.log("4. Waiting for Reset password modal dialog...");
  const modalHeader = await page.waitForSelector('text=Reset password', { timeout: 5000 });
  assert(modalHeader, "Reset password modal did not open");

  console.log("5. Checking pre-filled email in modal...");
  const resetEmailVal = await page.inputValue('#reset-email');
  assert.strictEqual(resetEmailVal, "shobhitsahani28@gmail.com", "Email was not pre-filled in reset modal");

  console.log("6. Filling new password and confirm password...");
  await page.fill('#reset-password-input', "newpassword123");
  await page.fill('#reset-confirm-input', "newpassword123");

  console.log("7. Submitting reset password form...");
  await page.click('button[type="submit"][form="reset-password-form"]');

  console.log("8. Waiting for success confirmation...");
  await page.waitForSelector('text=Password updated successfully', { timeout: 10000 });
  console.log("✓ Success toast received!");

  console.log("9. Signing in with the newly reset password...");
  await page.fill('#login-password', "newpassword123");
  await page.click('button[type="submit"]:has-text("Sign In")');

  console.log("10. Waiting for navigation to /app/board...");
  await page.waitForURL("**/app/**", { timeout: 20000 });
  console.log("✓ Successfully redirected to authenticated app:", page.url());

  console.log("11. Reverting password back to password123 for test reproducibility...");
  const res = await page.request.post("http://localhost:4002/v1/auth/reset-password", {
    data: { email: "shobhitsahani28@gmail.com", password: "password123" },
  });
  assert(res.ok(), "Failed to reset password back to standard password123");

  await browser.close();
  console.log("ALL TESTS PASSED! Password reset feature works end-to-end.");
}

runPasswordResetTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
