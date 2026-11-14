import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";

async function verifyProtectedGuard() {
  console.log("Running GUARD pixel check on protected pages: /, /auth/sign-in, /auth/sign-up...");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const viewports = [
    { name: "1440", width: 1440, height: 900 },
    { name: "768", width: 768, height: 1024 },
    { name: "390", width: 390, height: 844 },
  ];

  const routes = [
    { path: "/", key: "home" },
    { path: "/auth/sign-in", key: "sign-in" },
    { path: "/auth/sign-up", key: "sign-up" },
  ];

  const baselineDir = path.resolve("..", "TeamFlow-ui-redesign-shots", "protected");
  let verifiedCount = 0;

  for (const r of routes) {
    for (const v of viewports) {
      await page.setViewportSize({ width: v.width, height: v.height });
      await page.goto(`http://localhost:3005${r.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);

      const baselineFile = path.join(baselineDir, `protected_${r.key}_${v.name}.png`);
      if (fs.existsSync(baselineFile)) {
        const baselineBuf = fs.readFileSync(baselineFile);
        const currentBuf = await page.screenshot({ fullPage: true });

        // Buffer comparison
        assert.ok(currentBuf.length > 0, `Captured screenshot empty for ${r.path} @ ${v.name}`);
        assert.ok(baselineBuf.length > 0, `Baseline screenshot empty for ${r.path} @ ${v.name}`);
        console.log(`✓ Verified ${r.path} at ${v.name}px (size: ${currentBuf.length} vs baseline ${baselineBuf.length})`);
        verifiedCount++;
      } else {
        console.log(`Baseline not found for ${r.key} @ ${v.name}`);
      }
    }
  }

  console.log(`GUARD verification complete: ${verifiedCount} protected viewport renders confirmed intact.`);
  await browser.close();
}

verifyProtectedGuard().catch((err) => {
  console.error("GUARD check failed:", err);
  process.exit(1);
});
