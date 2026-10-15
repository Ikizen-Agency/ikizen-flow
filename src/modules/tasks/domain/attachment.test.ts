import { describe, expect, it } from "vitest";
import {
  AttachmentRejectedError,
  attachmentContentDisposition,
  formatFileSize,
  MAX_ATTACHMENT_BYTES,
  sanitizeFileName,
  validateAttachment,
} from "./attachment";

describe("sanitizeFileName", () => {
  it("drops directories, traversal segments and control characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\alex\\Q4 report.pdf")).toBe("Q4 report.pdf");
    expect(sanitizeFileName("evil\u0000name\r\n.txt")).toBe("evilname.txt");
  });

  it("replaces unsafe characters and trims leading dots", () => {
    expect(sanitizeFileName('..hidden"<script>.txt')).toBe("hidden_script_.txt");
    expect(sanitizeFileName("résumé final.docx")).toBe("résumé final.docx");
    expect(sanitizeFileName("   ")).toBe("file");
    expect(sanitizeFileName("..")).toBe("file");
  });

  it("caps long names but keeps the extension", () => {
    const name = sanitizeFileName(`${"a".repeat(300)}.pdf`);
    expect(name.length).toBeLessThanOrEqual(120);
    expect(name.endsWith(".pdf")).toBe(true);
  });
});

describe("validateAttachment", () => {
  it("accepts allowlisted files and derives the MIME type from the extension", () => {
    expect(validateAttachment({ name: "Brief.PDF", size: 2048 })).toEqual({ fileName: "Brief.PDF", mimeType: "application/pdf", sizeBytes: 2048 });
    expect(validateAttachment({ name: "notes.txt", size: 1 }).mimeType).toBe("text/plain");
    expect(validateAttachment({ name: "photo.jpeg", size: 1 }).mimeType).toBe("image/jpeg");
    expect(validateAttachment({ name: "deck.pptx", size: 1 }).mimeType).toMatch(/presentationml/);
    expect(validateAttachment({ name: "bundle.zip", size: 1 }).mimeType).toBe("application/zip");
  });

  it("rejects empty, oversized and non-allowlisted files", () => {
    expect(() => validateAttachment({ name: "a.txt", size: 0 })).toThrow(AttachmentRejectedError);
    expect(() => validateAttachment({ name: "a.pdf", size: MAX_ATTACHMENT_BYTES + 1 })).toThrow(/10 MB/);
    expect(validateAttachment({ name: "a.pdf", size: MAX_ATTACHMENT_BYTES }).sizeBytes).toBe(MAX_ATTACHMENT_BYTES);
    for (const name of ["run.exe", "page.html", "logo.svg", "script.js", "noextension"]) {
      expect(() => validateAttachment({ name, size: 10 })).toThrow(AttachmentRejectedError);
    }
  });
});

describe("attachment presentation", () => {
  it("formats sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1_572_864)).toBe("1.5 MB");
  });

  it("builds a download header with an ASCII fallback and an encoded UTF-8 name", () => {
    expect(attachmentContentDisposition("résumé final.pdf")).toBe(`attachment; filename="r_sum_ final.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9%20final.pdf`);
  });
});
