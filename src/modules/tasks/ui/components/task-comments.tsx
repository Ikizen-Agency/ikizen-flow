"use client";

import { useActionState, useState } from "react";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/dialog";
import { Icon } from "@/shared/ui/icon";
import { commentSegments, type MentionTarget } from "../../domain/comment";
import { addCommentAction, deleteCommentAction, editCommentAction } from "../actions";
import type { TaskMutationResult } from "../form-schema";
import { MentionComposer } from "./mention-composer";

const IDLE: TaskMutationResult = { ok: true };

export interface CommentView {
  id: number;
  author: string;
  when: string;
  edited: boolean;
  /** Stored body with `@[Name](memberId)` mentions. */
  body: string;
  /** The signed-in member wrote it (may edit / delete). */
  own: boolean;
}

/** Comment text with highlighted mentions. */
function CommentBody({ body }: { body: string }) {
  return (
    <p className="mt-1 text-body-sm break-words whitespace-pre-line text-ink-muted">
      {commentSegments(body).map((segment, i) =>
        segment.kind === "mention" ? (
          <span key={i} className="rounded bg-accent-tint px-1 font-medium text-accent">
            @{segment.name}
          </span>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </p>
  );
}

function CommentItem({ comment, members }: { comment: CommentView; members: ReadonlyArray<MentionTarget> }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editState, editAction, saving] = useActionState(async (prev: TaskMutationResult, data: FormData) => {
    const next = await editCommentAction(prev, data);
    if (next.ok) setEditing(false);
    return next;
  }, IDLE);
  const [deletion, deleteAction, deleting] = useActionState(async (prev: TaskMutationResult, data: FormData) => {
    const next = await deleteCommentAction(prev, data);
    if (next.ok) setConfirming(false);
    return next;
  }, IDLE);

  return (
    <li className="flex gap-space-sm">
      <Avatar name={comment.author} size="sm" />
      <div className="min-w-0 flex-1 rounded-card bg-surface-container-low p-space-sm">
        <div className="flex items-center justify-between gap-space-sm">
          <span className="text-label-md text-ink">{comment.author}</span>
          <span className="flex items-center gap-1 text-label-sm text-ink-subtle">
            {comment.when}
            {comment.edited ? " · edited" : ""}
            {comment.own && !editing ? (
              <>
                <button type="button" onClick={() => setEditing(true)} aria-label="Edit comment" className="rounded-control p-0.5 hover:text-ink">
                  <Icon name="edit" size={14} />
                </button>
                <button type="button" onClick={() => setConfirming(true)} aria-label="Delete comment" className="rounded-control p-0.5 hover:text-danger">
                  <Icon name="delete" size={14} />
                </button>
              </>
            ) : null}
          </span>
        </div>
        {editing ? (
          <form action={editAction} className="mt-1 flex flex-col gap-space-sm">
            <input type="hidden" name="commentId" value={comment.id} />
            <div className="rounded-control border border-line bg-card px-space-sm">
              <MentionComposer members={members} name="body" label="Edit comment" initialBody={comment.body} autoFocus />
            </div>
            <div className="flex justify-end gap-space-sm">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        ) : (
          <CommentBody body={comment.body} />
        )}
        {!editState.ok ? (
          <p role="alert" className="mt-1 text-body-sm text-danger-strong">
            {editState.message}
          </p>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        id={`delete-comment-${comment.id}`}
        title="Delete this comment?"
        description="The comment is permanently removed from the task."
        confirmLabel="Delete Comment"
        action={deleteAction}
        fields={{ commentId: comment.id }}
        pending={deleting}
        error={deletion.ok ? null : deletion.message}
      />
    </li>
  );
}

/** Drawer "Comments" section: real comments, own ones editable / deletable. */
export function TaskCommentList({ comments, members }: { comments: ReadonlyArray<CommentView>; members: ReadonlyArray<MentionTarget> }) {
  return (
    <section aria-labelledby="task-comments">
      <h3 id="task-comments" className="text-headline-sm text-ink">
        Comments <span className="tabular text-label-md text-ink-subtle">({comments.length})</span>
      </h3>
      {comments.length === 0 ? (
        <p className="mt-space-sm text-body-sm text-ink-subtle">No comments yet. Post the first update below.</p>
      ) : (
        <ol className="mt-space-md flex flex-col gap-space-md">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} members={members} />
          ))}
        </ol>
      )}
    </section>
  );
}

export interface TaskCommentComposerProps {
  taskId: number;
  members: ReadonlyArray<MentionTarget>;
  /** id of the attachments file input, opened by the paperclip button. */
  attachInputId?: string;
}

/** Sticky drawer footer: comment box with @mentions; ⌘/Ctrl+Enter posts. */
export function TaskCommentComposer({ taskId, members, attachInputId }: TaskCommentComposerProps) {
  const [generation, setGeneration] = useState(0);
  const [state, action, pending] = useActionState(async (prev: TaskMutationResult, data: FormData) => {
    const next = await addCommentAction(prev, data);
    if (next.ok) setGeneration((g) => g + 1);
    return next;
  }, IDLE);

  return (
    <form action={action} className="border-t border-line-soft bg-card p-space-md">
      <input type="hidden" name="taskId" value={taskId} />
      <div className="flex items-end gap-space-sm rounded-control bg-surface-container-low p-1 pl-space-sm">
        <MentionComposer key={generation} members={members} name="body" label="Add a comment" placeholder="Add a comment or operational update... Type @ to mention" />
        <Button type="submit" size="sm" trailingIcon="send" disabled={pending} className="mb-1">
          {pending ? "Posting..." : "Post"}
        </Button>
      </div>
      <div className="mt-1 flex items-center justify-between text-label-sm text-ink-subtle">
        {state.ok ? (
          <span>
            Press <kbd className="rounded bg-surface-container px-1">⌘Enter</kbd> to submit · <kbd className="rounded bg-surface-container px-1">@</kbd> to mention
          </span>
        ) : (
          <span role="alert" className="text-danger-strong">
            {state.message}
          </span>
        )}
        {attachInputId ? (
          <label htmlFor={attachInputId} title="Attach a file" className="inline-flex cursor-pointer items-center gap-1 rounded-control p-1 hover:text-ink">
            <Icon name="attach_file" size={16} />
            <span className="sr-only">Attach a file</span>
          </label>
        ) : null}
      </div>
    </form>
  );
}
