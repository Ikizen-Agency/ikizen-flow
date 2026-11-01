import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES } from "@/modules/tasks/domain/attachment";
import nextConfig from "../../../next.config";

/** Vercel rejects function request and response bodies above 4.5 MB before the app can answer. */
const VERCEL_BODY_LIMIT_BYTES = 4_500_000;

describe("upload limit", () => {
  it("allows 4 MB attachments on every environment", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(4 * 1024 * 1024);
  });

  it("lets the largest attachment and its multipart overhead through, and stays under Vercel's limit", () => {
    const limit = String(nextConfig.experimental?.serverActions?.bodySizeLimit);
    expect(limit).toMatch(/^\d+(\.\d+)?mb$/);
    const bytes = Number.parseFloat(limit) * 1024 * 1024;
    expect(bytes).toBeGreaterThan(MAX_ATTACHMENT_BYTES + 64 * 1024);
    expect(bytes).toBeLessThan(VERCEL_BODY_LIMIT_BYTES);
  });
});
