import { describe, expect, it } from "vitest";
import { DEV_AUTH_SECRET, resolveAuthEnv } from "./auth-env";
import { isDataRoute, safeNextPath } from "./redirect";

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
    expect(resolveAuthEnv({ NODE_ENV: "development" })).toEqual({
      secret: DEV_AUTH_SECRET,
      baseURL: "http://localhost:3000",
      trustedOrigins: ["http://localhost:3000"],
    });
  });

  it("reads configured values", () => {
    const secret = "x".repeat(40);
    expect(resolveAuthEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: "https://flow.example.com" })).toEqual({
      secret,
      baseURL: "https://flow.example.com",
      trustedOrigins: ["https://flow.example.com"],
    });
  });

  it("fails loudly in production without a secret", () => {
    expect(() => resolveAuthEnv({ NODE_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => resolveAuthEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: "short" })).toThrow(/at least 32/);
  });

  it("lets `next build` compile without production secrets", () => {
    expect(resolveAuthEnv({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }).secret).toBe(DEV_AUTH_SECRET);
  });

  it("only trusts the base URL outside Vercel", () => {
    expect(resolveAuthEnv({ NODE_ENV: "development" }).trustedOrigins).toEqual(["http://localhost:3000"]);
  });

  describe("on Vercel", () => {
    const secret = "y".repeat(40);
    const vercel = {
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: secret,
      VERCEL: "1",
      VERCEL_PROJECT_PRODUCTION_URL: "flow.example.com",
      VERCEL_URL: "flow-abc123.vercel.app",
      VERCEL_BRANCH_URL: "flow-git-staging.vercel.app",
    };

    it("falls back to the production domain in production", () => {
      const resolved = resolveAuthEnv({ ...vercel, VERCEL_ENV: "production" });
      expect(resolved.baseURL).toBe("https://flow.example.com");
      expect(resolved.trustedOrigins).toEqual(["https://flow.example.com", "https://flow-abc123.vercel.app", "https://flow-git-staging.vercel.app"]);
    });

    it("uses the deployment URL for previews and trusts the branch and production URLs", () => {
      const resolved = resolveAuthEnv({ ...vercel, VERCEL_ENV: "preview" });
      expect(resolved.baseURL).toBe("https://flow-abc123.vercel.app");
      expect(resolved.trustedOrigins).toEqual(["https://flow-abc123.vercel.app", "https://flow-git-staging.vercel.app", "https://flow.example.com"]);
    });

    it("prefers an explicit BETTER_AUTH_URL and still trusts the Vercel URLs", () => {
      const resolved = resolveAuthEnv({ ...vercel, VERCEL_ENV: "production", BETTER_AUTH_URL: "https://demo.ikizen.dev/" });
      expect(resolved.baseURL).toBe("https://demo.ikizen.dev/");
      expect(resolved.trustedOrigins).toEqual([
        "https://demo.ikizen.dev",
        "https://flow-abc123.vercel.app",
        "https://flow-git-staging.vercel.app",
        "https://flow.example.com",
      ]);
    });

    it("still requires a production secret", () => {
      expect(() => resolveAuthEnv({ ...vercel, BETTER_AUTH_SECRET: undefined, VERCEL_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET/);
    });
  });
});

describe("isDataRoute", () => {
  it("treats API and CSV export routes as data (401 instead of a login redirect)", () => {
    for (const path of ["/api/orders", "/customers/export", "/invoices/export", "/reports/export"]) expect(isDataRoute(path)).toBe(true);
    for (const path of ["/", "/invoices", "/invoices/INV-2047", "/reports", "/exports", "/invoices/export/x"]) expect(isDataRoute(path)).toBe(false);
  });
});
