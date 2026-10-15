import { describe, expect, it } from "vitest";
import {
  assertCommentAuthor,
  CommentPermissionError,
  CommentRejectedError,
  commentSegments,
  editableComment,
  mentionToken,
  newMentions,
  normalizeCommentBody,
  parseMentions,
  plainCommentText,
  serializeMentions,
} from "./comment";

const maya = { id: 2, name: "Maya Chen" };
const alex = { id: 1, name: "Alex Vance" };

describe("mention tokens", () => {
  it("encodes a member as @[Name](id) without characters that break the token", () => {
    expect(mentionToken(maya)).toBe("@[Maya Chen](2)");
    expect(mentionToken({ id: 9, name: "Ann [QA] (Ops)\nLead" })).toBe("@[Ann QA Ops Lead](9)");
  });

  it("parses distinct mentioned member ids in order", () => {
    expect(parseMentions("Hi @[Maya Chen](2) and @[Alex Vance](1), cc @[Maya Chen](2)")).toEqual([2, 1]);
    expect(parseMentions("email me at a@b.co, @[broken](x) @[](3)")).toEqual([]);
  });

  it("lists only mentions added by an edit", () => {
    expect(newMentions("@[Maya Chen](2)", "@[Maya Chen](2) @[Alex Vance](1)")).toEqual([1]);
    expect(newMentions("@[Maya Chen](2)", "no mentions")).toEqual([]);
  });
});

describe("comment rendering", () => {
  it("splits a body into text and mention segments", () => {
    expect(commentSegments("Ping @[Maya Chen](2) today")).toEqual([
      { kind: "text", text: "Ping " },
      { kind: "mention", name: "Maya Chen", memberId: 2 },
      { kind: "text", text: " today" },
    ]);
  });

  it("renders mentions as plain @Name text", () => {
    expect(plainCommentText("Ping @[Maya Chen](2)!")).toBe("Ping @Maya Chen!");
  });
});

describe("composer serialization", () => {
  it("turns picked @Name references into tokens, longest names first", () => {
    const picks = [maya, { id: 3, name: "Maya" }];
    expect(serializeMentions("@Maya Chen and @Maya, not @Mayanne", picks)).toBe("@[Maya Chen](2) and @[Maya](3), not @Mayanne");
  });

  it("ignores picks whose name was deleted from the text", () => {
    expect(serializeMentions("Hello team", [alex])).toBe("Hello team");
  });

  it("round-trips a stored body into editable text and picks", () => {
    const body = `${mentionToken(alex)} please review with ${mentionToken(maya)}`;
    const editable = editableComment(body);
    expect(editable).toEqual({ text: "@Alex Vance please review with @Maya Chen", picks: [alex, maya] });
    expect(serializeMentions(editable.text, editable.picks)).toBe(body);
  });
});

describe("comment rules", () => {
  it("trims bodies and rejects empty or oversized comments", () => {
    expect(normalizeCommentBody("  Looks good  ")).toBe("Looks good");
    expect(() => normalizeCommentBody("   ")).toThrow(CommentRejectedError);
    expect(() => normalizeCommentBody("x".repeat(2001))).toThrow(CommentRejectedError);
  });

  it("only lets authors change their comments", () => {
    expect(() => assertCommentAuthor({ authorId: 1 }, 1)).not.toThrow();
    expect(() => assertCommentAuthor({ authorId: 1 }, 2)).toThrow(CommentPermissionError);
    expect(() => assertCommentAuthor({ authorId: null }, 2)).toThrow(CommentPermissionError);
  });
});
