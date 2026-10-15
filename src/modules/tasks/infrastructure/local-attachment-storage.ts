/**
 * Attachment bytes on the local disk: `<root>/<workspaceId>/<uuid>`.
 * Keys are generated here and validated on every read/delete, so a key can never point outside `root`.
 * (No "server-only" import: the seed scripts use it too.)
 */
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";
import type { AttachmentStorage } from "../application/ports";

export class InvalidStorageKeyError extends Error {
  constructor() {
    super("Invalid attachment storage key.");
    this.name = "InvalidStorageKeyError";
  }
}

const KEY = /^(\d{1,9})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** `UPLOADS_DIR` (absolute or relative to `cwd`), defaulting to `<cwd>/data/uploads`. */
export function resolveUploadsDir(env: Readonly<Record<string, string | undefined>>, cwd: string = process.cwd()): string {
  const configured = env.UPLOADS_DIR?.trim();
  if (!configured) return join(cwd, "data", "uploads");
  return isAbsolute(configured) ? resolve(configured) : resolve(cwd, configured);
}

export class LocalAttachmentStorage implements AttachmentStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathOf(key: string): string {
    const match = KEY.exec(key);
    if (!match) throw new InvalidStorageKeyError();
    const path = resolve(this.root, match[1]!, match[2]!);
    if (!path.startsWith(this.root + sep)) throw new InvalidStorageKeyError();
    return path;
  }

  async save(workspaceId: number, bytes: Uint8Array): Promise<string> {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) throw new InvalidStorageKeyError();
    const key = `${workspaceId}/${randomUUID()}`;
    const path = this.pathOf(key);
    await mkdir(join(this.root, String(workspaceId)), { recursive: true });
    await writeFile(path, bytes, { flag: "wx" });
    return key;
  }

  async read(key: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.pathOf(key)));
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  /** Deletes every workspace folder (numeric names) under the root; used by `db:reset` / `db:seed`. */
  async clear(): Promise<void> {
    const entries = await readdir(this.root, { withFileTypes: true }).catch(() => []);
    await Promise.all(entries.filter((e) => e.isDirectory() && /^\d+$/.test(e.name)).map((e) => rm(join(this.root, e.name), { recursive: true, force: true })));
  }
}
