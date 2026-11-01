import { BlobNotFoundError, BlobServiceNotAvailable } from "@vercel/blob";
import { describe, expect, it, vi } from "vitest";
import { BlobAttachmentStorage, type BlobClient } from "./blob-attachment-storage";
import { InvalidStorageKeyError } from "./local-attachment-storage";

const TOKEN = "test-token";
const KEY = "attachments/7/1b4e28ba-2fa1-41d2-883f-0016d3cca427";

function stubClient(overrides: Partial<BlobClient> = {}): BlobClient {
  return {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    del: vi.fn(async () => undefined),
    list: vi.fn(async () => ({ blobs: [], hasMore: false })),
    ...overrides,
  };
}

const streamOf = (text: string) => new Blob([text]).stream();

describe("BlobAttachmentStorage", () => {
  it("saves private blobs under attachments/<workspaceId>/<uuid> without overwriting", async () => {
    const client = stubClient();
    const key = await new BlobAttachmentStorage(TOKEN, client).save(7, new TextEncoder().encode("hello"));

    expect(key).toMatch(/^attachments\/7\/[0-9a-f-]{36}$/);
    const [pathname, body, options] = vi.mocked(client.put).mock.calls[0]!;
    expect(pathname).toBe(key);
    expect(Buffer.from(body).toString()).toBe("hello");
    expect(options).toEqual({ access: "private", token: TOKEN, addRandomSuffix: false, allowOverwrite: false, contentType: "application/octet-stream" });
  });

  it("refuses an invalid workspace id", async () => {
    const client = stubClient();
    await expect(new BlobAttachmentStorage(TOKEN, client).save(0, new Uint8Array([1]))).rejects.toThrow(InvalidStorageKeyError);
    expect(client.put).not.toHaveBeenCalled();
  });

  it("reads the bytes back through the private API", async () => {
    const client = stubClient({ get: vi.fn(async () => ({ stream: streamOf("hello") })) });
    const bytes = await new BlobAttachmentStorage(TOKEN, client).read(KEY);

    expect(new TextDecoder().decode(bytes)).toBe("hello");
    expect(client.get).toHaveBeenCalledWith(KEY, { access: "private", token: TOKEN });
  });

  it("fails a read of a missing blob, like a missing local file", async () => {
    await expect(new BlobAttachmentStorage(TOKEN, stubClient()).read(KEY)).rejects.toThrow(/not found/);
  });

  it("removes a blob by key", async () => {
    const client = stubClient();
    await new BlobAttachmentStorage(TOKEN, client).remove(KEY);
    expect(client.del).toHaveBeenCalledWith(KEY, { token: TOKEN });
  });

  it("treats removing a missing blob as done, like a missing local file", async () => {
    const client = stubClient({ del: vi.fn(() => Promise.reject(new BlobNotFoundError())) });
    await expect(new BlobAttachmentStorage(TOKEN, client).remove(KEY)).resolves.toBeUndefined();
  });

  it("still reports real removal failures", async () => {
    const client = stubClient({ del: vi.fn(() => Promise.reject(new BlobServiceNotAvailable())) });
    await expect(new BlobAttachmentStorage(TOKEN, client).remove(KEY)).rejects.toThrow(BlobServiceNotAvailable);
  });

  it("refuses keys outside the attachments prefix", async () => {
    const client = stubClient();
    const storage = new BlobAttachmentStorage(TOKEN, client);
    for (const key of ["../secret", "other/7/1b4e28ba-2fa1-41d2-883f-0016d3cca427", "attachments/7/not-a-uuid", "attachments/x/1b4e28ba-2fa1-41d2-883f-0016d3cca427", "https://evil.example/a", ""]) {
      await expect(storage.read(key)).rejects.toThrow(InvalidStorageKeyError);
      await expect(storage.remove(key)).rejects.toThrow(InvalidStorageKeyError);
    }
    expect(client.get).not.toHaveBeenCalled();
    expect(client.del).not.toHaveBeenCalled();
  });

  it("clears every page of attachments and nothing else", async () => {
    const list = vi
      .fn<BlobClient["list"]>()
      .mockResolvedValueOnce({ blobs: [{ pathname: "attachments/1/a" }, { pathname: "attachments/1/b" }], cursor: "next", hasMore: true })
      .mockResolvedValueOnce({ blobs: [{ pathname: "attachments/2/c" }], hasMore: false });
    const client = stubClient({ list });

    await new BlobAttachmentStorage(TOKEN, client).clear();

    expect(list).toHaveBeenNthCalledWith(1, { prefix: "attachments/", token: TOKEN, cursor: undefined });
    expect(list).toHaveBeenNthCalledWith(2, { prefix: "attachments/", token: TOKEN, cursor: "next" });
    expect(client.del).toHaveBeenNthCalledWith(1, ["attachments/1/a", "attachments/1/b"], { token: TOKEN });
    expect(client.del).toHaveBeenNthCalledWith(2, ["attachments/2/c"], { token: TOKEN });
  });

  it("has nothing to delete when the store is empty", async () => {
    const client = stubClient();
    await new BlobAttachmentStorage(TOKEN, client).clear();
    expect(client.del).not.toHaveBeenCalled();
  });
});
