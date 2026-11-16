import { describe, expect, it } from "bun:test";
import { createApp } from "../src/app.js";

const app = createApp();

describe("POST /v1/auth/reset-password", () => {
  it("rejects invalid email formats", async () => {
    const res = await app.request("/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email", password: "newpassword123" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const res = await app.request("/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@acme.io", password: "short" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown user", async () => {
    const res = await app.request("/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent-user-12345@example.com", password: "newpassword123" }),
    });
    expect(res.status).toBe(404);
  });

  it("successfully resets password for valid user", async () => {
    const res = await app.request("/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@acme.io", password: "password123" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; message: string };
    expect(data.ok).toBe(true);
  });
});
