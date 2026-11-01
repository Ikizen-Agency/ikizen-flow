import { describe, expect, it } from "vitest";
import { CONFIRM_REMOTE_SEED_VAR, databaseTarget, decideSeed, isRemoteDatabaseUrl, seedStorageEnv } from "./database-target";

const REMOTE = "libsql://flow-acme.turso.io";

describe("isRemoteDatabaseUrl", () => {
  it("treats only file: URLs as local", () => {
    expect(isRemoteDatabaseUrl("file:./data/ikizen.db")).toBe(false);
    expect(isRemoteDatabaseUrl(REMOTE)).toBe(true);
    expect(isRemoteDatabaseUrl("https://db.example.com")).toBe(true);
    expect(isRemoteDatabaseUrl("not a url")).toBe(true);
  });
});

describe("databaseTarget", () => {
  it("reduces a remote URL to its host, dropping credentials, port, path and query", () => {
    const target = databaseTarget("libsql://admin:hunter2@flow-acme.turso.io:8080/db?authToken=secret-token#frag");
    expect(target).toBe("flow-acme.turso.io");
  });

  it("keeps the path of a local file but not its query", () => {
    expect(databaseTarget("file:./data/ikizen.db")).toBe("file:./data/ikizen.db");
    expect(databaseTarget("file:./data/ikizen.db?authToken=secret-token")).toBe("file:./data/ikizen.db");
  });

  it("never echoes a URL it cannot parse", () => {
    expect(databaseTarget("libsql://user:hunter2@")).toBe("remote database (unrecognized URL)");
    expect(databaseTarget("hunter2")).toBe("remote database (unrecognized URL)");
  });
});

describe("decideSeed", () => {
  it("always allows a local database", () => {
    expect(decideSeed("file:./data/ikizen.db", {})).toEqual({ allowed: true });
  });

  it("refuses a remote database without confirmation and explains how to confirm", () => {
    const decision = decideSeed(REMOTE, {});
    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toContain("flow-acme.turso.io");
    expect(decision.reason).toContain(CONFIRM_REMOTE_SEED_VAR);
    expect(decision.reason).toMatch(/deletes every row/);
  });

  it("refuses a confirmation that is not exactly the target host", () => {
    for (const value of ["", "yes", "true", "other.turso.io", "flow-acme.turso.io ", "FLOW-ACME.TURSO.IO", REMOTE]) {
      expect(decideSeed(REMOTE, { [CONFIRM_REMOTE_SEED_VAR]: value }).allowed).toBe(false);
    }
  });

  it("allows a remote database when the confirmation equals the target host", () => {
    expect(decideSeed(REMOTE, { [CONFIRM_REMOTE_SEED_VAR]: "flow-acme.turso.io", BLOB_READ_WRITE_TOKEN: "test-token" })).toEqual({ allowed: true });
  });

  it("refuses a confirmed remote seed without Blob, whose attachments would stay on this machine", () => {
    const decision = decideSeed(REMOTE, { [CONFIRM_REMOTE_SEED_VAR]: "flow-acme.turso.io" });
    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toContain("BLOB_READ_WRITE_TOKEN");
  });

  it("cannot be confirmed when the URL has no recognizable host", () => {
    const decision = decideSeed("not a url", { [CONFIRM_REMOTE_SEED_VAR]: "not a url" });
    expect(decision.allowed).toBe(false);
  });

  it("does not leak credentials in the refusal", () => {
    const decision = decideSeed("libsql://admin:hunter2@flow-acme.turso.io?authToken=secret-token", {});
    expect(JSON.stringify(decision)).not.toMatch(/hunter2|secret-token/);
  });
});

describe("seedStorageEnv", () => {
  it("keeps the Blob token for a remote database", () => {
    expect(seedStorageEnv(REMOTE, { BLOB_READ_WRITE_TOKEN: "test-token" }).BLOB_READ_WRITE_TOKEN).toBe("test-token");
  });

  it("drops the Blob token for a local database, so a local seed never clears the shared store", () => {
    expect(seedStorageEnv("file:./data/ikizen.db", { BLOB_READ_WRITE_TOKEN: "test-token", UPLOADS_DIR: "/srv/files" })).toEqual({ UPLOADS_DIR: "/srv/files" });
  });
});
