"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { Icon } from "@/shared/ui/icon";
import { ATTACHMENT_ACCEPT, AttachmentRejectedError, validateAttachment } from "../../domain/attachment";
import { deleteAttachmentAction, uploadAttachmentAction } from "../actions";
import type { TaskMutationResult } from "../form-schema";

const IDLE: TaskMutationResult = { ok: true };

/** Display-ready attachment row (formatting happens on the server). */
export interface AttachmentView {
  id: number;
  fileName: string;
  size: string;
  icon: string;
  uploadedBy: string;
  when: string;
  href: string;
}

export interface TaskAttachmentsProps {
  taskId: number;
  attachments: ReadonlyArray<AttachmentView>;
  /** id of the file input (the comment footer's paperclip is a label for it). */
  inputId: string;
}

/** Drawer "Attachments": upload (validated in the browser and again on the server), download and delete. */
export function TaskAttachments({ taskId, attachments, inputId }: TaskAttachmentsProps) {
  const form = useRef<HTMLFormElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AttachmentView | null>(null);
  const [upload, uploadAction, uploading] = useActionState(async (prev: TaskMutationResult, data: FormData) => {
    const next = await uploadAttachmentAction(prev, data);
    form.current?.reset();
    return next;
  }, IDLE);
  const [deletion, deleteAction, deleting] = useActionState(async (prev: TaskMutationResult, data: FormData) => {
    const next = await deleteAttachmentAction(prev, data);
    if (next.ok) setRemoving(null);
    return next;
  }, IDLE);

  const onPick = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    setClientError(null);
    if (!file) return;
    try {
      validateAttachment({ name: file.name, size: file.size });
    } catch (error) {
      setClientError(error instanceof AttachmentRejectedError ? error.message : "This file cannot be uploaded.");
      input.value = "";
      return;
    }
    form.current?.requestSubmit();
  };

  const error = clientError ?? (upload.ok ? null : upload.message);

  return (
    <section aria-labelledby="task-attachments">
      <div className="flex items-center justify-between gap-space-sm">
        <h3 id="task-attachments" className="text-headline-sm text-ink">
          Attachments <span className="tabular text-label-md text-ink-subtle">({attachments.length})</span>
        </h3>
        <form ref={form} action={uploadAction}>
          <input type="hidden" name="taskId" value={taskId} />
          <input id={inputId} type="file" name="file" accept={ATTACHMENT_ACCEPT} className="sr-only" onChange={(e) => onPick(e.currentTarget)} />
          <label htmlFor={inputId} className="inline-flex cursor-pointer items-center gap-1 text-label-md text-accent hover:underline">
            <Icon name={uploading ? "hourglass_empty" : "upload_file"} size={16} />
            {uploading ? "Uploading..." : "Upload file"}
          </label>
        </form>
      </div>
      <p className="mt-1 text-label-sm text-ink-subtle">Images, PDF, text, Office documents or zip, up to 10 MB.</p>
      {error ? (
        <p role="alert" className="mt-space-sm text-body-sm text-danger-strong">
          {error}
        </p>
      ) : null}
      {attachments.length === 0 ? (
        <p className="mt-space-sm text-body-sm text-ink-subtle">No files attached yet.</p>
      ) : (
        <ul className="mt-space-sm flex flex-col gap-1">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-space-sm rounded-control border border-line-soft bg-card px-space-sm py-2">
              <Icon name={a.icon} size={20} className="shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <a href={a.href} download className="block truncate text-label-md text-ink hover:text-accent hover:underline">
                  {a.fileName}
                </a>
                <p className="truncate text-label-sm text-ink-subtle">
                  {a.size} · {a.uploadedBy} · {a.when}
                </p>
              </div>
              <a href={a.href} download aria-label={`Download ${a.fileName}`} className="rounded-control p-1 text-ink-subtle hover:text-ink">
                <Icon name="download" size={16} />
              </a>
              <button type="button" onClick={() => setRemoving(a)} aria-label={`Delete ${a.fileName}`} className="rounded-control p-1 text-ink-subtle hover:text-danger">
                <Icon name="delete" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        id="delete-attachment"
        title="Delete this attachment?"
        description={
          <>
            <strong className="text-ink">{removing?.fileName}</strong> is permanently removed from the task and from storage.
          </>
        }
        confirmLabel="Delete File"
        action={deleteAction}
        fields={{ attachmentId: removing?.id ?? 0 }}
        pending={deleting}
        error={deletion.ok ? null : deletion.message}
      />
    </section>
  );
}
