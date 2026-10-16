import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "@/server/db/connect";
import { resolveUploadsDir } from "@/modules/tasks/infrastructure/local-attachment-storage";
import { DEMO_DATABASE_URL, DEMO_UPLOADS_DIR, isEphemeralDemo } from "./demo-mode";

describe("isEphemeralDemo", () => {
  it("is off by default and for local development", () => {
    expect(isEphemeralDemo({})).toBe(false);
    expect(isEphemeralDemo({ NODE_ENV: "production" })).toBe(false);
    expect(isEphemeralDemo({ IKIZEN_DEMO_MODE: "off" })).toBe(false);
  });

  it("is on when explicitly requested", () => {
    expect(isEphemeralDemo({ IKIZEN_DEMO_MODE: "ephemeral" })).toBe(true);
    expect(isEphemeralDemo({ IKIZEN_DEMO_MODE: " ephemeral ", DATABASE_URL: "file:./x.db" })).toBe(true);
  });

  it("turns on automatically on Vercel without a configured database", () => {
    expect(isEphemeralDemo({ VERCEL: "1" })).toBe(true);
    expect(isEphemeralDemo({ VERCEL: "1", DATABASE_URL: "  " })).toBe(true);
    expect(isEphemeralDemo({ VERCEL: "1", DATABASE_URL: "libsql://flow.turso.io" })).toBe(false);
  });
});

describe("demo storage defaults", () => {
  it("puts the database and uploads in /tmp in demo mode", () => {
    expect(resolveDatabaseUrl({ VERCEL: "1" })).toBe(DEMO_DATABASE_URL);
    expect(DEMO_DATABASE_URL).toBe("file:/tmp/ikizen.db");
    expect(resolveUploadsDir({ VERCEL: "1" }, "/var/task")).toBe(DEMO_UPLOADS_DIR);
    expect(DEMO_UPLOADS_DIR).toBe("/tmp/ikizen-uploads");
  });

  it("keeps explicit values and local defaults", () => {
    expect(resolveDatabaseUrl({ IKIZEN_DEMO_MODE: "ephemeral", DATABASE_URL: "file:./demo.db" })).toBe("file:./demo.db");
    expect(resolveUploadsDir({ IKIZEN_DEMO_MODE: "ephemeral", UPLOADS_DIR: "/srv/files" }, "/var/task")).toBe("/srv/files");
    expect(resolveDatabaseUrl({})).toBe("file:./data/ikizen.db");
    expect(resolveUploadsDir({}, "/srv/app")).toBe("/srv/app/data/uploads");
  });
});
