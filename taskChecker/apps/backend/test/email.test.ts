import { describe, expect, it } from "bun:test";
import { supabaseAuthBase } from "../src/lib/email.js";

describe("supabaseAuthBase", () => {
  it("appends /auth/v1 to a project-root URL", () => {
    expect(supabaseAuthBase("https://lnplireboawtrfpwpcdd.supabase.co")).toBe(
      "https://lnplireboawtrfpwpcdd.supabase.co/auth/v1",
    );
  });

  it("tolerates trailing slashes", () => {
    expect(supabaseAuthBase("https://lnplireboawtrfpwpcdd.supabase.co///")).toBe(
      "https://lnplireboawtrfpwpcdd.supabase.co/auth/v1",
    );
  });

  it("strips a mistaken /auth/v1 suffix instead of doubling the path", () => {
    // The exact misconfig that surfaced as `supabase_404: 404 page not found`
    // on invite sends (GoTrue 404s /auth/v1/auth/v1/admin/invite).
    expect(supabaseAuthBase("https://lnplireboawtrfpwpcdd.supabase.co/auth/v1")).toBe(
      "https://lnplireboawtrfpwpcdd.supabase.co/auth/v1",
    );
    expect(supabaseAuthBase("https://lnplireboawtrfpwpcdd.supabase.co/auth/v1/")).toBe(
      "https://lnplireboawtrfpwpcdd.supabase.co/auth/v1",
    );
  });
});
