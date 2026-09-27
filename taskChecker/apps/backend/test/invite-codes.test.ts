/**
 * Invite codes + Resend delivery contract:
 * - codes are 8 chars from the unambiguous alphabet, normalize tolerant.
 * - email send is best-effort: unconfigured → { sent:false }, never throws.
 */
import { describe, expect, it } from "bun:test";
import { INVITE_CODE_RE, normalizeInviteCode, randomInviteCode } from "../src/lib/ids.js";

describe("invite codes", () => {
  it("mints 8-char unambiguous codes", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = randomInviteCode();
      expect(code).toMatch(INVITE_CODE_RE);
      expect(code).toHaveLength(8);
      seen.add(code);
    }
    // 32^8 space — 50 mints must all be distinct.
    expect(seen.size).toBe(50);
  });

  it("normalizes typed codes (case, spaces, dashes)", () => {
    expect(normalizeInviteCode("  kq7m-2xda ")).toBe("KQ7M2XDA");
    expect(INVITE_CODE_RE.test(normalizeInviteCode("kq7m2xda"))).toBe(true);
    expect(INVITE_CODE_RE.test(normalizeInviteCode("short"))).toBe(false);
  });
});

describe("invite email best-effort", () => {
  it("returns sent:false (never throws) when Resend is unconfigured", async () => {
    const { sendInviteEmail } = await import("../src/lib/email.js");
    const res = await sendInviteEmail({
      to: "nobody@test.local",
      orgName: "Test Org",
      role: "member",
      invitationUrl: "http://localhost:4000/auth/accept-invite?token=x",
      code: "ABCDEFGH",
      expiresAt: new Date(Date.now() + 3600_000),
    });
    expect(res.sent).toBe(false);
    expect(typeof res.error).toBe("string");
  });
});
