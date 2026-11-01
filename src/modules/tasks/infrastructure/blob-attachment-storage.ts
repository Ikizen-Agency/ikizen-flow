/**
 * Attachment bytes in a private Vercel Blob store, for hosts without a persistent disk: `attachments/<workspaceId>/<uuid>`.
 * Blobs are never public; downloads go through the authenticated attachment route.
 * (No "server-only" import: the seed script uses it too.)
 */
import { randomUUID } from "node:crypto";
import { BlobNotFoundError, del, get, list, put } from "@vercel/blob";
import type { AttachmentStorage } from "../application/ports";
import { InvalidStorageKeyError } from "./local-attachment-storage";

const PREFIX = "attachments/";
const KEY = /^attachments\/\d{1,9}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The parts of the `@vercel/blob` SDK this adapter uses. */
export interface BlobClient {
  put(pathname: string, body: Buffer, options: { access: "private"; token: string; addRandomSuffix: false; allowOverwrite: false; contentType: string }): Promise<unknown>;
  get(pathname: string, options: { access: "private"; token: string }): Promise<{ stream: ReadableStream<Uint8Array> | null } | null>;
  del(pathnames: string | string[], options: { token: string }): Promise<void>;
  list(options: { prefix: string; token: string; cursor: string | undefined }): Promise<{ blobs: ReadonlyArray<{ pathname: string }>; cursor?: string; hasMore: boolean }>;
}

export class BlobAttachmentStorage implements AttachmentStorage {
  constructor(
    private readonly token: string,
    private readonly client: BlobClient = { put, get, del, list },
  ) {}

  async save(workspaceId: number, bytes: Uint8Array): Promise<string> {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) throw new InvalidStorageKeyError();
    const key = `${PREFIX}${workspaceId}/${randomUUID()}`;
    await this.client.put(key, Buffer.from(bytes), { access: "private", token: this.token, addRandomSuffix: false, allowOverwrite: false, contentType: "application/octet-stream" });
    return key;
  }

  async read(key: string): Promise<Uint8Array> {
    const blob = await this.client.get(validKey(key), { access: "private", token: this.token });
    if (!blob?.stream) throw new Error("Attachment blob not found.");
    return new Uint8Array(await new Response(blob.stream).arrayBuffer());
  }

  /** A blob that is already gone counts as removed, like a missing file in `LocalAttachmentStorage`. */
  async remove(key: string): Promise<void> {
    try {
      await this.client.del(validKey(key), { token: this.token });
    } catch (error) {
      if (!(error instanceof BlobNotFoundError)) throw error;
    }
  }

  /** Deletes every attachment blob in the store; used by a confirmed remote `db:seed`. */
  async clear(): Promise<void> {
    let cursor: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const page = await this.client.list({ prefix: PREFIX, token: this.token, cursor });
      if (page.blobs.length > 0) await this.client.del(page.blobs.map((blob) => blob.pathname), { token: this.token });
      cursor = page.cursor;
      hasMore = page.hasMore;
    }
  }
}

function validKey(key: string): string {
  if (!KEY.test(key)) throw new InvalidStorageKeyError();
  return key;
}
