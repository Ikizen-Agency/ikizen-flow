import type { ActivityRepository } from "../../activity/application/ports";
import { NotFoundError, type Clock } from "../../shared-types";
import { MAX_ATTACHMENT_BYTES, validateAttachment } from "../domain/attachment";
import type { AttachmentStorage, TaskAttachment, TaskAttachmentRepository, TaskRepository } from "./ports";

export interface TaskAttachmentDeps {
  workspaceId: number;
  tasks: TaskRepository;
  taskAttachments: TaskAttachmentRepository;
  attachmentStorage: AttachmentStorage;
  activity: ActivityRepository;
  clock: Clock;
}

export interface UploadedFile {
  /** Client file name (sanitized before it is stored). */
  name: string;
  size: number;
  bytes: Uint8Array;
}

export const makeListTaskAttachments =
  ({ taskAttachments }: Pick<TaskAttachmentDeps, "taskAttachments">) =>
  (taskId: number) =>
    taskAttachments.listForTask(taskId);

/** Validates (size, extension allowlist, file name), writes the bytes, then records the row; no orphan files on failure. */
export const makeUploadTaskAttachment =
  (deps: TaskAttachmentDeps) =>
  async (taskId: number, file: UploadedFile, actorId: number | null): Promise<TaskAttachment> => {
    // The declared size is checked first, so an oversized upload is refused before its bytes matter.
    if (file.size > MAX_ATTACHMENT_BYTES) validateAttachment({ name: file.name, size: file.size });
    const { fileName, mimeType, sizeBytes } = validateAttachment({ name: file.name, size: file.bytes.byteLength });
    const now = deps.clock();
    if (!(await deps.tasks.findById(taskId))) throw new NotFoundError("Task", taskId);
    const storageKey = await deps.attachmentStorage.save(deps.workspaceId, file.bytes);
    try {
      const attachment = await deps.taskAttachments.create({ taskId, uploadedById: actorId, fileName, mimeType, sizeBytes, storageKey }, now);
      await deps.activity.record({ actorId, message: `attached ${fileName}`, category: "operations", entityType: "task", entityId: taskId, createdAt: now });
      return attachment;
    } catch (error) {
      await deps.attachmentStorage.remove(storageKey);
      throw error;
    }
  };

export const makeDeleteTaskAttachment =
  (deps: TaskAttachmentDeps) =>
  async (id: number, actorId: number | null): Promise<void> => {
    const attachment = await deps.taskAttachments.findById(id);
    if (!attachment || !(await deps.taskAttachments.delete(id))) throw new NotFoundError("Attachment", id);
    await deps.attachmentStorage.remove(attachment.storageKey);
    await deps.activity.record({
      actorId,
      message: `removed attachment ${attachment.fileName}`,
      category: "operations",
      entityType: "task",
      entityId: attachment.taskId,
      createdAt: deps.clock(),
    });
  };

/** Download: the row (workspace-scoped) plus its bytes, or null when it is not visible to this workspace. */
export const makeGetAttachmentFile =
  ({ taskAttachments, attachmentStorage }: Pick<TaskAttachmentDeps, "taskAttachments" | "attachmentStorage">) =>
  async (id: number): Promise<{ attachment: TaskAttachment; bytes: Uint8Array } | null> => {
    const attachment = await taskAttachments.findById(id);
    if (!attachment) return null;
    return { attachment, bytes: await attachmentStorage.read(attachment.storageKey) };
  };
