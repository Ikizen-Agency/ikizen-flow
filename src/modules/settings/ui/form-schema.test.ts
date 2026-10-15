import { describe, expect, it } from "vitest";
import { parseSettingsParams } from "./settings-params";
import { inviteSchema, passwordSchema, preferencesFromForm, profileSchema, teammateSchema, workspaceSchema } from "./form-schema";

describe("parseSettingsParams", () => {
  it("defaults to the workspace tab and ignores unknown values", () => {
    expect(parseSettingsParams({})).toEqual({ tab: "workspace", outbox: { page: 1 }, emailId: null });
    expect(parseSettingsParams({ tab: "nope", page: "-3", kind: "spam", status: "weird", email: "x" })).toEqual({ tab: "workspace", outbox: { page: 1 }, emailId: null });
  });

  it("reads the tab, outbox filters, page and selected email", () => {
    expect(parseSettingsParams({ tab: "email", kind: "invite", status: "failed", page: "3", email: "12" })).toEqual({
      tab: "email",
      outbox: { kind: "invite", status: "failed", page: 3 },
      emailId: 12,
    });
    expect(parseSettingsParams({ tab: ["members", "email"] }).tab).toBe("members");
  });
});

describe("settings form schemas", () => {
  it("validates the workspace profile", () => {
    expect(workspaceSchema.safeParse({ name: " Acme ", tagline: "", slug: "acme" }).data).toEqual({ name: "Acme", tagline: "", slug: "acme" });
    expect(workspaceSchema.safeParse({ name: "", tagline: "", slug: "" }).success).toBe(false);
  });

  it("validates teammates and invitations", () => {
    expect(teammateSchema.safeParse({ name: "Noah", email: "noah@x.test", title: "" }).success).toBe(true);
    expect(teammateSchema.safeParse({ name: "Noah", email: "nope", title: "" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "jo@x.test", role: "admin" }).success).toBe(true);
    expect(inviteSchema.safeParse({ email: "jo@x.test", role: "root" }).success).toBe(false);
  });

  it("validates the profile with an optional avatar colour", () => {
    expect(profileSchema.safeParse({ name: "Alex", title: "Ops", avatarColor: "" }).data).toEqual({ name: "Alex", title: "Ops", avatarColor: null });
    expect(profileSchema.safeParse({ name: "Alex", title: "Ops", avatarColor: "success" }).data?.avatarColor).toBe("success");
    expect(profileSchema.safeParse({ name: "Alex", title: "Ops", avatarColor: "neon" }).success).toBe(false);
  });

  it("requires a confirmed, different new password of at least 8 characters", () => {
    const ok = { currentPassword: "old-pass-1", newPassword: "new-pass-12", confirmPassword: "new-pass-12" };
    expect(passwordSchema.safeParse(ok).success).toBe(true);
    expect(passwordSchema.safeParse({ ...ok, confirmPassword: "other" }).error?.issues[0]?.path).toEqual(["confirmPassword"]);
    expect(passwordSchema.safeParse({ ...ok, newPassword: "short", confirmPassword: "short" }).success).toBe(false);
    expect(passwordSchema.safeParse({ ...ok, newPassword: "old-pass-1", confirmPassword: "old-pass-1" }).error?.issues[0]?.path).toEqual(["newPassword"]);
  });

  it("reads notification checkboxes for every type", () => {
    const form = new FormData();
    form.set("inApp:mention", "on");
    form.set("email:mention", "on");
    form.set("email:bogus", "on");
    const prefs = preferencesFromForm(form);
    expect(prefs.find((p) => p.type === "mention")).toEqual({ type: "mention", inApp: true, email: true });
    expect(prefs.find((p) => p.type === "task_assigned")).toEqual({ type: "task_assigned", inApp: false, email: false });
    expect(prefs).toHaveLength(6);
  });
});
