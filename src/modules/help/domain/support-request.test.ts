import { describe, expect, it } from "vitest";
import { composeSupportEmail, supportRequestSchema } from "./support-request";

describe("support request", () => {
  it("validates the contact form", () => {
    expect(supportRequestSchema.safeParse({ topic: "billing", subject: "  Invoice question ", message: "How do I resend an invoice?" }).success).toBe(true);
    const invalid = supportRequestSchema.safeParse({ topic: "other-thing", subject: "", message: "short" });
    expect(invalid.success).toBe(false);
    const fields = invalid.success ? [] : invalid.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["topic", "subject", "message"]));
  });

  it("composes a single-line subject and a body that identifies the requester", () => {
    const email = composeSupportEmail(
      { topic: "bug", subject: "Board\r\nwill not load", message: "The tasks board shows an error." },
      { name: "Alex Vance", email: "alex@northstar.studio", workspace: "Northstar Studio", page: "/tasks" },
    );
    expect(email.subject).toBe("[Ikizen support] Bug report: Board will not load");
    expect(email.text).toContain("From: Alex Vance <alex@northstar.studio>");
    expect(email.text).toContain("Workspace: Northstar Studio");
    expect(email.text).toContain("The tasks board shows an error.");
  });
});
