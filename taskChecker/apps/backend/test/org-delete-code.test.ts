import { describe, expect, it } from "bun:test";
import { DELETE_CODE_RE, normalizeDeleteCode, randomDeleteCode } from "../src/lib/ids.js";

describe("org deletion codes", () => {
  it("mints 6-digit numeric codes", () => {
    for (let i = 0; i < 25; i++) {
      const code = randomDeleteCode();
      expect(code).toMatch(DELETE_CODE_RE);
    }
  });

  it("codes vary (not a constant)", () => {
    const seen = new Set(Array.from({ length: 10 }, () => randomDeleteCode()));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("normalizes typed codes (spaces/dashes stripped, digits kept)", () => {
    expect(normalizeDeleteCode("482 913")).toBe("482913");
    expect(normalizeDeleteCode(" 48-29-13 ")).toBe("482913");
    expect(normalizeDeleteCode("482913")).toBe("482913");
  });

  it("rejects non-6-digit input", () => {
    expect(DELETE_CODE_RE.test("48291")).toBe(false);
    expect(DELETE_CODE_RE.test("4829130")).toBe(false);
    expect(DELETE_CODE_RE.test("abcdef")).toBe(false);
    expect(DELETE_CODE_RE.test("")).toBe(false);
  });

  it("delete-code email is best-effort: always resolves, never throws", async () => {
    // Mirrors the invite contract: a mailer failure (unconfigured, bad sender
    // domain, network) is reported as { sent:false, error } so the endpoint can
    // fall back to handing the code back instead of 500-ing the owner.
    const { sendOrgDeleteCodeEmail } = await import("../src/lib/email.js");
    const res = await sendOrgDeleteCodeEmail({
      to: "nobody@test.local",
      orgName: "Test Org",
      code: "482913",
      expiresAt: new Date(Date.now() + 900_000),
      requesterName: "Test Owner",
    });
    expect(typeof res.sent).toBe("boolean");
    if (!res.sent) expect(typeof res.error).toBe("string");
  });
});
