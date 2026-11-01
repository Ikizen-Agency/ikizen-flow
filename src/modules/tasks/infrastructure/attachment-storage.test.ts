import { describe, expect, it } from "vitest";
import { createAttachmentStorage } from "./attachment-storage";
import { BlobAttachmentStorage } from "./blob-attachment-storage";
import { LocalAttachmentStorage } from "./local-attachment-storage";

describe("createAttachmentStorage", () => {
  it("uses Vercel Blob when a token is configured", () => {
    expect(createAttachmentStorage({ BLOB_READ_WRITE_TOKEN: "test-token" })).toBeInstanceOf(BlobAttachmentStorage);
  });

  it("keeps the local disk without a token", () => {
    expect(createAttachmentStorage({})).toBeInstanceOf(LocalAttachmentStorage);
    expect(createAttachmentStorage({ BLOB_READ_WRITE_TOKEN: "  " })).toBeInstanceOf(LocalAttachmentStorage);
    expect(createAttachmentStorage({ IKIZEN_DEMO_MODE: "ephemeral" })).toBeInstanceOf(LocalAttachmentStorage);
  });

  it("keeps the ephemeral demo off the shared store even if a token reaches it", () => {
    expect(createAttachmentStorage({ IKIZEN_DEMO_MODE: "ephemeral", BLOB_READ_WRITE_TOKEN: "test-token" })).toBeInstanceOf(LocalAttachmentStorage);
  });
});
