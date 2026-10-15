import { describe, expect, it } from "vitest";
import { DEV_AUTH_SECRET, resolveAuthEnv } from "./auth-env";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps same-origin relative paths with their query", () => {
    expect(safeNextPath("/sales?order=SL-1048")).toBe("/sales?order=SL-1048");
  });

  it("rejects absolute, protocol-relative, backslash and auth-page targets", () => {
    for (const next of ["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "/login", "/register?x=1", "", null, undefined]) {
      expect(safeNextPath(next)).toBe("/");
    }
  });

  it("rejects control characters and whitespace that browsers strip into protocol-relative URLs", () => {
    for (const next of ["/\t/evil.test", "/\n/evil.test", "/\r/evil.test", "/ /evil.test", "/\u0000/evil.test"]) {
      expect(safeNextPath(next)).toBe("/");
    }
  });
});

describe("resolveAuthEnv", () => {
  it("uses safe local defaults in development", () => {
    expect(resolveAuthEnv({ NODE_ENV: "development" })).toEqual({ secret: DEV_AUTH_SECRET, baseURL: "http://localhost:3000" });
  });

  it("reads configured values", () => {
    const secret = "x".repeat(40);
    expect(resolveAuthEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: "https://flow.example.com" })).toEqual({
      secret,
      baseURL: "https://flow.example.com",
    });
  });

  it("fails loudly in production without a secret", () => {
    expect(() => resolveAuthEnv({ NODE_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => resolveAuthEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: "short" })).toThrow(/at least 32/);
  });

  it("lets `next build` compile without production secrets", () => {
    expect(resolveAuthEnv({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }).secret).toBe(DEV_AUTH_SECRET);
  });
});
