/**
 * P0-3 regression: auth must fail closed when dependencies are down.
 * - DB-down errors surface as retryable 503 dependency_unavailable
 *   (login/signup return 503, never a valid token).
 * - auth.ts must not contain a sandbox fallback that mints owner JWTs.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("DB-down maps to 503, never a token", () => {
  it("errorHandler returns retryable 503 dependency_unavailable", async () => {
    const { errorHandler } = await import("../src/lib/errors.js");
    // postgres-js surfaces a refused connection as an AggregateError with an
    // empty message — the ECONNREFUSED code is the only signal.
    const agg = new AggregateError([{ code: "ECONNREFUSED", message: "" }], "");
    const fakeCtx = {
      get: () => "test-req",
      json: (body: unknown, status: number) => ({ body, status }),
    } as unknown as Parameters<typeof errorHandler>[1];
    const res = (await errorHandler(agg as unknown as Error, fakeCtx)) as unknown as {
      body: { error: { code: string; retryable: boolean } };
      status: number;
    };
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("dependency_unavailable");
    expect(res.body.error.retryable).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain("accessToken");
  });

  it("auth.ts contains no sandbox fallback that mints tokens on DB failure", () => {
    const src = readFileSync(join(import.meta.dir, "..", "src", "modules", "auth.ts"), "utf8");
    expect(src).not.toMatch(/sandbox/i);
    expect(src).not.toMatch(/TeamFlow Workspace/);
    // No catch-block token issuance: signAccessToken must only appear on the
    // happy path, never inside a catch.
    const catches = src.match(/catch[\s\S]{0,400}?signAccessToken/g) ?? [];
    expect(catches).toEqual([]);
  });
});
