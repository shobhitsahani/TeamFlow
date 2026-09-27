/**
 * P0-2 regression: JWT_SECRET must fail closed in production.
 * - Missing/weak/default secrets throw at startup (no dev fallback in prod).
 * - ALLOW_AUTH_FALLBACK must never be settable in production.
 * - Dev fallback is allowed only outside production, with a loud warning.
 */
import { describe, expect, it } from "bun:test";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    prev[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

describe("config fail-closed JWT_SECRET", () => {
  it("throws in production when JWT_SECRET is missing", async () => {
    const { loadConfig } = await import("../src/config.js");
    withEnv({ NODE_ENV: "production", JWT_SECRET: undefined, JWT_SECRET_4: undefined }, () => {
      expect(() => loadConfig()).toThrow(/JWT_SECRET/);
    });
  });

  it("throws in production on weak/default secrets", async () => {
    const { loadConfig } = await import("../src/config.js");
    for (const weak of [
      "short",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "dev-only-change-me-at-least-32-chars-with-randomness",
    ]) {
      withEnv({ NODE_ENV: "production", JWT_SECRET: weak, JWT_SECRET_4: undefined }, () => {
        expect(() => loadConfig()).toThrow(/JWT_SECRET/);
      });
    }
  });

  it("accepts a strong secret in production", async () => {
    const { loadConfig } = await import("../src/config.js");
    withEnv(
      {
        NODE_ENV: "production",
        JWT_SECRET: "k7F3q9Zm2vX8pL4nQ6wE1rT5yU0iOaSdFgHjK",
        JWT_SECRET_4: undefined,
        ALLOW_AUTH_FALLBACK: undefined,
      },
      () => {
        expect(loadConfig().jwtSecret).toBe("k7F3q9Zm2vX8pL4nQ6wE1rT5yU0iOaSdFgHjK");
      },
    );
  });

  it("refuses ALLOW_AUTH_FALLBACK=true in production", async () => {
    const { loadConfig } = await import("../src/config.js");
    withEnv(
      {
        NODE_ENV: "production",
        JWT_SECRET: "k7F3q9Zm2vX8pL4nQ6wE1rT5yU0iOaSdFgHjK",
        ALLOW_AUTH_FALLBACK: "true",
      },
      () => {
        expect(() => loadConfig()).toThrow(/ALLOW_AUTH_FALLBACK/);
      },
    );
  });

  it("allows dev fallback outside production (with warning)", async () => {
    const { loadConfig } = await import("../src/config.js");
    withEnv({ NODE_ENV: "development", JWT_SECRET: undefined, JWT_SECRET_4: undefined }, () => {
      expect(loadConfig().jwtSecret.length).toBeGreaterThan(16);
    });
  });
});
