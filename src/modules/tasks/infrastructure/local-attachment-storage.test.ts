import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { InvalidStorageKeyError, LocalAttachmentStorage, resolveUploadsDir } from "./local-attachment-storage";

const root = mkdtempSync(join(tmpdir(), "ikizen-uploads-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("LocalAttachmentStorage", () => {
  it("stores files under <workspaceId>/<uuid> and reads them back", async () => {
    const storage = new LocalAttachmentStorage(root);
    const key = await storage.save(7, new TextEncoder().encode("hello"));
    expect(key).toMatch(/^7\/[0-9a-f-]{36}$/);
    expect(new TextDecoder().decode(await storage.read(key))).toBe("hello");
    await storage.remove(key);
    expect(existsSync(join(root, key))).toBe(false);
    await expect(storage.remove(key)).resolves.toBeUndefined();
  });

  it("refuses keys that could escape the uploads directory", async () => {
    const storage = new LocalAttachmentStorage(root);
    for (const key of ["../../etc/passwd", "7/../../secret", "/etc/passwd", "7/not-a-uuid", "x/1b4e28ba-2fa1-11d2-883f-0016d3cca427", ""]) {
      await expect(storage.read(key)).rejects.toThrow(InvalidStorageKeyError);
      await expect(storage.remove(key)).rejects.toThrow(InvalidStorageKeyError);
    }
  });

  it("clears workspace folders only", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ikizen-clear-"));
    const storage = new LocalAttachmentStorage(dir);
    await storage.save(3, new Uint8Array([1]));
    mkdirSync(join(dir, "keep"));
    writeFileSync(join(dir, ".gitkeep"), "");
    await storage.clear();
    expect(existsSync(join(dir, "3"))).toBe(false);
    expect(existsSync(join(dir, "keep"))).toBe(true);
    expect(existsSync(join(dir, ".gitkeep"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("resolveUploadsDir", () => {
  it("defaults to data/uploads and honours UPLOADS_DIR", () => {
    expect(resolveUploadsDir({}, "/srv/app")).toBe("/srv/app/data/uploads");
    expect(resolveUploadsDir({ UPLOADS_DIR: " /var/ikizen " }, "/srv/app")).toBe("/var/ikizen");
    expect(resolveUploadsDir({ UPLOADS_DIR: "files" }, "/srv/app")).toBe("/srv/app/files");
  });
});
