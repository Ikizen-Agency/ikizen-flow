import { createClient } from "@libsql/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase, databaseClientConfig } from "./connect";

// The stub records the configuration and opens an in-memory database, so no test reaches the network.
vi.mock("@libsql/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@libsql/client")>();
  return { ...actual, createClient: vi.fn(() => actual.createClient({ url: "file::memory:" })) };
});

const REMOTE = "libsql://flow-acme.turso.io";

describe("databaseClientConfig", () => {
  it("sends the auth token to a remote database as a separate option, never in the URL", () => {
    expect(databaseClientConfig(REMOTE, { DATABASE_AUTH_TOKEN: " token-value " })).toEqual({ url: REMOTE, authToken: "token-value" });
  });

  it("omits the option when no token is configured", () => {
    expect(databaseClientConfig(REMOTE, {})).toEqual({ url: REMOTE });
    expect(databaseClientConfig(REMOTE, { DATABASE_AUTH_TOKEN: "  " })).toEqual({ url: REMOTE });
  });

  it("never hands the token to a local file database", () => {
    expect(databaseClientConfig("file:./data/ikizen.db", { DATABASE_AUTH_TOKEN: "token-value" })).toEqual({ url: "file:./data/ikizen.db" });
  });
});

describe("createDatabase", () => {
  beforeEach(() => vi.mocked(createClient).mockClear());

  it("opens the client with the configured auth token", () => {
    createDatabase(REMOTE, { DATABASE_AUTH_TOKEN: "token-value" }).client.close();
    expect(createClient).toHaveBeenCalledWith({ url: REMOTE, authToken: "token-value" });
  });
});
