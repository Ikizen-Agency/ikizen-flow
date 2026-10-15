/**
 * Task attachment rules. Files are typed by an extension allowlist: the stored (and served) MIME type is
 * derived from the extension, never taken from the client, and downloads are always `attachment`.
 */

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const FILE_NAME_MAX_LENGTH = 120;

/** Allowed extensions -> MIME type: images, PDF, text, office documents and zip archives. */
export const ATTACHMENT_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};

/** `accept` attribute for file inputs. */
export const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");

export class AttachmentRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentRejectedError";
  }
}

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

/**
 * Display/download-safe file name: keeps only the last path segment, drops control characters,
 * replaces anything outside letters, digits, space, `.`, `_`, `-`, `(`, `)` and trims leading dots.
 */
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[/\\]/).pop() ?? "";
  let name = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N} ._()-]/gu, "_")
    .replace(/_+/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+/, "")
    .trim();
  if (name.length > FILE_NAME_MAX_LENGTH) {
    const ext = extensionOf(name);
    const suffix = ext && ext.length <= 10 ? `.${ext}` : "";
    name = `${name.slice(0, FILE_NAME_MAX_LENGTH - suffix.length).trimEnd()}${suffix}`;
  }
  return name || "file";
}

const MB = 1024 * 1024;

export function validateAttachment({ name, size }: { name: string; size: number }): { fileName: string; mimeType: string; sizeBytes: number } {
  const fileName = sanitizeFileName(name);
  const mimeType = ATTACHMENT_TYPES[extensionOf(fileName)];
  if (!mimeType) throw new AttachmentRejectedError("This file type is not allowed. Use images, PDF, text, Office documents or zip archives.");
  if (!Number.isFinite(size) || size <= 0) throw new AttachmentRejectedError("The file is empty.");
  if (size > MAX_ATTACHMENT_BYTES) throw new AttachmentRejectedError(`Files can be up to ${MAX_ATTACHMENT_BYTES / MB} MB.`);
  return { fileName, mimeType, sizeBytes: size };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(1).replace(/\.0$/, "")} MB`;
}

/** Material Symbols ligature for a MIME type. */
export function attachmentIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "picture_as_pdf";
  if (mimeType === "application/zip") return "folder_zip";
  if (/spreadsheet|ms-excel|csv/.test(mimeType)) return "table_chart";
  if (/presentation|powerpoint/.test(mimeType)) return "slideshow";
  return "description";
}

/** `Content-Disposition` forcing a download, with an ASCII fallback and an RFC 5987 UTF-8 name. */
export function attachmentContentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
