import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DrizzleActivityRepository } from "@/modules/activity/infrastructure/drizzle-activity-repository";
import { DrizzleMemberRepository } from "@/modules/team/infrastructure/drizzle-member-repository";
import type { Database } from "@/server/db/connect";
import { seedDatabase, type SeedSummary } from "@/server/db/seed/seed";
import { createTestDatabase } from "@/test/test-database";
import {
  makeDeleteTaskAttachment,
  makeGetAttachmentFile,
  makeListTaskAttachments,
  makeUploadTaskAttachment,
} from "../application/attachment-use-cases";
import { makeDeleteTimeEntry, makeListTimeEntries, makeLogTime } from "../application/time-use-cases";
import { makeDeleteTask } from "../application/use-cases";
import { AttachmentRejectedError } from "../domain/attachment";
import { TimeEntryPermissionError } from "../domain/time-entry";
import { DrizzleTaskAttachmentRepository } from "./drizzle-task-attachment-repository";
import { DrizzleTaskRepository } from "./drizzle-task-repository";
import { DrizzleTaskTimeEntryRepository } from "./drizzle-task-time-entry-repository";
import { LocalAttachmentStorage } from "./local-attachment-storage";

const now = new Date("2026-10-14T12:00:00Z");
const uploads = mkdtempSync(join(tmpdir(), "ikizen-task-files-"));
const storage = new LocalAttachmentStorage(uploads);
let db: Database;
let cleanup: () => void;
let seed: SeedSummary;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDatabase());
  seed = await seedDatabase(db, now, { attachmentStorage: storage });
});
afterAll(() => {
  cleanup();
  rmSync(uploads, { recursive: true, force: true });
});

const deps = (ws: number) => ({
  workspaceId: ws,
  tasks: new DrizzleTaskRepository(db, ws),
  taskAttachments: new DrizzleTaskAttachmentRepository(db, ws),
  taskTimeEntries: new DrizzleTaskTimeEntryRepository(db, ws),
  attachmentStorage: storage,
  activity: new DrizzleActivityRepository(db, ws),
  clock: () => now,
});
const north = () => deps(seed.workspaces.northstar);
const sandbox = () => deps(seed.workspaces.sandbox);
const file = (name: string, text = "hello world") => {
  const bytes = new TextEncoder().encode(text);
  return { name, size: bytes.byteLength, bytes };
};

describe("task attachments", () => {
  it("seeds a downloadable text attachment", async () => {
    expect(seed.attachments).toBe(1);
    const d = north();
    const task = (await d.tasks.listBoard({ q: "TASK-842" }))[0]!;
    const [seeded] = await makeListTaskAttachments(d)(task.id);
    expect(seeded).toMatchObject({ mimeType: "text/plain", uploadedByName: expect.any(String) });
    const download = await makeGetAttachmentFile(d)(seeded!.id);
    expect(new TextDecoder().decode(download!.bytes)).toMatch(/handover/i);
  });

  it("uploads, lists, downloads and deletes a file on disk", async () => {
    const d = north();
    const [task] = await d.tasks.listBoard({ priority: "low" });
    const attachment = await makeUploadTaskAttachment(d)(task!.id, file("../../Brief notes.txt"), seed.demoMembers.northstar);
    expect(attachment).toMatchObject({ fileName: "Brief notes.txt", mimeType: "text/plain", sizeBytes: 11, taskId: task!.id });
    expect(attachment.storageKey).toMatch(new RegExp(`^${seed.workspaces.northstar}/`));
    expect(existsSync(join(uploads, attachment.storageKey))).toBe(true);
    expect((await d.activity.forEntity("task", task!.id, 1))[0]?.message).toBe("attached Brief notes.txt");

    const download = await makeGetAttachmentFile(d)(attachment.id);
    expect(new TextDecoder().decode(download!.bytes)).toBe("hello world");

    await makeDeleteTaskAttachment(d)(attachment.id, seed.demoMembers.northstar);
    expect(existsSync(join(uploads, attachment.storageKey))).toBe(false);
    expect(await makeGetAttachmentFile(d)(attachment.id)).toBeNull();
  });

  it("rejects disallowed files before writing anything", async () => {
    const d = north();
    const [task] = await d.tasks.listBoard({});
    await expect(makeUploadTaskAttachment(d)(task!.id, file("payload.html", "<script>"), null)).rejects.toThrow(AttachmentRejectedError);
    await expect(makeUploadTaskAttachment(d)(task!.id, { name: "big.pdf", size: 11 * 1024 * 1024, bytes: new Uint8Array(1) }, null)).rejects.toThrow(/10 MB/);
  });

  it("removes stored files when the task is deleted", async () => {
    const d = north();
    const [task] = await d.tasks.listBoard({ priority: "medium" });
    const attachment = await makeUploadTaskAttachment(d)(task!.id, file("plan.csv", "a,b"), null);
    await makeDeleteTask(d)(task!.id);
    expect(existsSync(join(uploads, attachment.storageKey))).toBe(false);
  });

  it("never exposes or deletes another workspace's attachments", async () => {
    const d = north();
    const [task] = await d.tasks.listBoard({ priority: "high" });
    const attachment = await makeUploadTaskAttachment(d)(task!.id, file("secret.txt"), null);
    const s = sandbox();
    expect(await makeGetAttachmentFile(s)(attachment.id)).toBeNull();
    expect(await makeListTaskAttachments(s)(task!.id)).toEqual([]);
    await expect(makeDeleteTaskAttachment(s)(attachment.id, seed.demoMembers.sandbox)).rejects.toThrow(/not found/i);
    await expect(makeUploadTaskAttachment(s)(task!.id, file("x.txt"), null)).rejects.toThrow(/not found/i);
    expect(existsSync(join(uploads, attachment.storageKey))).toBe(true);
  });
});

describe("time tracking", () => {
  it("derives tracked hours from seeded and logged entries", async () => {
    const d = north();
    const task = (await d.tasks.listBoard({ q: "TASK-842" }))[0]!;
    expect(task.trackedHours).toBe(14);
    const entry = await makeLogTime(d)(task.id, { hours: 1.5, note: " QA pass " }, seed.demoMembers.northstar);
    expect(entry).toMatchObject({ minutes: 90, note: "QA pass", memberId: seed.demoMembers.northstar });
    expect((await d.tasks.findById(task.id))?.trackedHours).toBe(15.5);
    expect((await makeListTimeEntries(d)(task.id)).map((e) => e.id)).toContain(entry.id);
    expect((await d.activity.forEntity("task", task.id, 1))[0]?.message).toBe("logged 1h 30m");
  });

  it("lets members delete only their own entries", async () => {
    const d = north();
    const [task] = await d.tasks.listBoard({ priority: "low" });
    const maya = (await new DrizzleMemberRepository(db, seed.workspaces.northstar).list()).find((m) => m.name === "Maya Chen")!;
    const entry = await makeLogTime(d)(task!.id, { hours: 2, note: null }, seed.demoMembers.northstar);
    await expect(makeDeleteTimeEntry(d)(entry.id, maya.id)).rejects.toThrow(TimeEntryPermissionError);
    await makeDeleteTimeEntry(d)(entry.id, seed.demoMembers.northstar);
    expect((await makeListTimeEntries(d)(task!.id)).some((e) => e.id === entry.id)).toBe(false);
  });

  it("rejects entries on, or deletes of, another workspace's data", async () => {
    const d = north();
    const [task] = await d.tasks.listBoard({});
    const entry = await makeLogTime(d)(task!.id, { hours: 1, note: null }, seed.demoMembers.northstar);
    const s = sandbox();
    await expect(makeLogTime(s)(task!.id, { hours: 1, note: null }, seed.demoMembers.sandbox)).rejects.toThrow(/not found/i);
    await expect(makeDeleteTimeEntry(s)(entry.id, seed.demoMembers.northstar)).rejects.toThrow(/not found/i);
    expect(await makeListTimeEntries(s)(task!.id)).toEqual([]);
  });
});
