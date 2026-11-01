/**
 * Chooses where attachment bytes live. (No "server-only" import: the seed script uses it too.)
 */
import { isEphemeralDemo } from "../../../shared/config/demo-mode";
import type { AttachmentStorage } from "../application/ports";
import { BlobAttachmentStorage } from "./blob-attachment-storage";
import { LocalAttachmentStorage, resolveUploadsDir } from "./local-attachment-storage";

export type ClearableAttachmentStorage = AttachmentStorage & { clear(): Promise<void> };

/** Vercel Blob with `BLOB_READ_WRITE_TOKEN`, otherwise the local disk. The ephemeral demo always stays local: it seeds and wipes at runtime. */
export function createAttachmentStorage(env: Readonly<Record<string, string | undefined>>): ClearableAttachmentStorage {
  const token = env.BLOB_READ_WRITE_TOKEN?.trim();
  return token && !isEphemeralDemo(env) ? new BlobAttachmentStorage(token) : new LocalAttachmentStorage(resolveUploadsDir(env));
}
