/**
 * P1 regression: CORS allowlist + security headers + /healthz.
 * - Unknown origins get NO access-control-allow-origin (no credentialed
 *   reflection, even in development).
 * - Allowlisted / loopback origins are echoed in dev; every response carries
 *   the baseline security headers.
 * - /healthz aliases /livez (public, no auth).
 */
import { describe, expect, it } from "bun:test";
import { createApp } from "../src/app.js";

const app = createApp();

describe("CORS allowlist", () => {
  it("reflects nothing for an unknown origin", async () => {
    const res = await app.request("/livez", { headers: { Origin: "https://evil.example" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("echoes a loopback dev origin", async () => {
    const res = await app.request("/livez", { headers: { Origin: "http://localhost:3000" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });
});

describe("security headers", () => {
  it("sets the baseline set on every response", async () => {
    const res = await app.request("/livez");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin");
  });
});

describe("health endpoints", () => {
  it("/healthz aliases /livez", async () => {
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: "teamflow-api" });
  });
});

describe("openapi + versioning", () => {
  it("serves a valid OpenAPI 3.1 pilot doc", async () => {
    const res = await app.request("/v1/openapi.json");
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { openapi: string; info: { version: string }; paths: Record<string, unknown> };
    expect(doc.openapi).toMatch(/^3\.1/);
    expect(doc.info.version).toBe("1.0.0");
    expect(Object.keys(doc.paths)).toContain("/v1/auth/login");
  });

  it("stamps API-Version on /v1 responses", async () => {
    const res = await app.request("/v1/openapi.json");
    expect(res.headers.get("api-version")).toBe("v1");
  });
});
