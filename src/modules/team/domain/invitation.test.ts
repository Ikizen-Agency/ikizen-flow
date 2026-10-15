import { describe, expect, it } from "vitest";
import {
  acceptanceBlockedReason,
  generateInvitationToken,
  hashInvitationToken,
  invitationEmail,
  invitationExpiry,
  invitationState,
  isInvitationTokenShape,
} from "./invitation";

const now = new Date("2026-10-14T12:00:00Z");
const pending = { email: "jo@x.test", expiresAt: invitationExpiry(now), acceptedAt: null };

describe("invitations", () => {
  it("expire after seven days and become accepted once used", () => {
    expect(invitationExpiry(now).toISOString()).toBe("2026-10-21T12:00:00.000Z");
    expect(invitationState(pending, now)).toBe("pending");
    expect(invitationState(pending, new Date("2026-10-21T12:00:00Z"))).toBe("expired");
    expect(invitationState({ ...pending, acceptedAt: now }, now)).toBe("accepted");
  });

  it("can only be accepted by the invited email while pending", () => {
    expect(acceptanceBlockedReason(pending, " JO@x.test ", now)).toBeNull();
    expect(acceptanceBlockedReason(pending, "other@x.test", now)?.reason).toBe("email_mismatch");
    expect(acceptanceBlockedReason(pending, "jo@x.test", new Date("2026-11-01T00:00:00Z"))?.reason).toBe("expired");
    expect(acceptanceBlockedReason({ ...pending, acceptedAt: now }, "jo@x.test", now)?.reason).toBe("accepted");
  });

  it("uses random URL-safe tokens stored as SHA-256 hashes", () => {
    const token = generateInvitationToken();
    expect(isInvitationTokenShape(token)).toBe(true);
    expect(generateInvitationToken()).not.toBe(token);
    expect(hashInvitationToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInvitationToken(token)).not.toContain(token);
    expect(isInvitationTokenShape("../etc/passwd")).toBe(false);
  });

  it("builds a single-line subject and an escaped HTML body", () => {
    const mail = invitationEmail({ workspace: "Acme <Ops>", inviter: "Alex", role: "admin", link: "http://localhost/invite/abc", expiresAt: invitationExpiry(now) });
    expect(mail.subject).toBe("Alex invited you to Acme <Ops> on Ikizen Flow");
    expect(mail.text).toContain("as an admin");
    expect(mail.text).toContain("http://localhost/invite/abc");
    expect(mail.html).toContain("Acme &lt;Ops&gt;");
  });
});
