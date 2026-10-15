/**
 * Task comments and @mentions.
 * Mentions are stored inline as `@[Name](memberId)`: the id drives notifications, the name renders.
 */

export const COMMENT_MAX_LENGTH = 2000;

export interface MentionTarget {
  id: number;
  name: string;
}

export type CommentSegment = { kind: "text"; text: string } | { kind: "mention"; name: string; memberId: number };

export class CommentRejectedError extends Error {
  constructor(message = `Write a comment (up to ${COMMENT_MAX_LENGTH.toLocaleString("en-US")} characters).`) {
    super(message);
    this.name = "CommentRejectedError";
  }
}

export class CommentPermissionError extends Error {
  constructor() {
    super("Only the author can change this comment.");
    this.name = "CommentPermissionError";
  }
}

const MENTION = /@\[([^\][()\n]{1,80})\]\((\d{1,9})\)/g;

/** Member name safe to embed in a token (no brackets, parentheses or line breaks). */
const tokenName = (name: string) => name.replace(/[[\]()]/g, "").replace(/\s+/g, " ").trim();

export function mentionToken({ id, name }: MentionTarget): string {
  return `@[${tokenName(name)}](${id})`;
}

/** Distinct mentioned member ids, in order of appearance. */
export function parseMentions(body: string): number[] {
  const ids: number[] = [];
  for (const match of body.matchAll(MENTION)) {
    const id = Number(match[2]);
    if (id > 0 && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Mentions present in `after` but not in `before` (only those are notified after an edit). */
export function newMentions(before: string, after: string): number[] {
  const previous = new Set(parseMentions(before));
  return parseMentions(after).filter((id) => !previous.has(id));
}

export function commentSegments(body: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(MENTION)) {
    if (match.index > last) segments.push({ kind: "text", text: body.slice(last, match.index) });
    segments.push({ kind: "mention", name: match[1]!, memberId: Number(match[2]) });
    last = match.index + match[0].length;
  }
  if (last < body.length) segments.push({ kind: "text", text: body.slice(last) });
  return segments;
}

/** Body with mentions rendered as `@Name` (notification bodies, activity, plain previews). */
export function plainCommentText(body: string): string {
  return body.replace(MENTION, (_, name: string) => `@${name}`);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Composer text -> stored body: every `@Name` of a picked member becomes its token.
 * Longest names go first so "@Maya Chen" wins over "@Maya"; a name must end at a non-word character.
 */
export function serializeMentions(text: string, picks: ReadonlyArray<MentionTarget>): string {
  const byLength = [...picks].sort((a, b) => tokenName(b.name).length - tokenName(a.name).length);
  const placeholders: string[] = [];
  let out = text.replace(/\u0000/g, "");
  for (const pick of byLength) {
    const pattern = new RegExp(`@${escapeRegExp(tokenName(pick.name))}(?![\\p{L}\\p{N}_])`, "gu");
    out = out.replace(pattern, () => {
      placeholders.push(mentionToken(pick));
      return `\u0000${placeholders.length - 1}\u0000`;
    });
  }
  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => placeholders[Number(i)]!);
}

/** Stored body -> composer text with `@Name` references plus the picks needed to serialize it again. */
export function editableComment(body: string): { text: string; picks: MentionTarget[] } {
  const picks: MentionTarget[] = [];
  for (const segment of commentSegments(body)) {
    if (segment.kind === "mention" && !picks.some((p) => p.id === segment.memberId)) picks.push({ id: segment.memberId, name: segment.name });
  }
  return { text: plainCommentText(body), picks };
}

export function normalizeCommentBody(body: string): string {
  const text = body.trim();
  if (!text || text.length > COMMENT_MAX_LENGTH) throw new CommentRejectedError();
  return text;
}

export function assertCommentAuthor(comment: { authorId: number | null }, memberId: number): void {
  if (comment.authorId === null || comment.authorId !== memberId) throw new CommentPermissionError();
}
