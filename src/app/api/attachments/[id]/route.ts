import { connection } from "next/server";
import { attachmentContentDisposition } from "@/modules/tasks/domain/attachment";
import { authorizeRoute } from "@/server/request-context";

const notFound = () => Response.json({ error: "not_found", message: "Attachment not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/attachments/:id: downloads a task attachment of the active workspace (401 signed out, 404 when the
 * id belongs to another workspace or does not exist). Always served as a download with `nosniff`, using the
 * MIME type derived from the extension allowlist at upload time.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/attachments/[id]">) {
  await connection();
  const auth = await authorizeRoute();
  if (auth instanceof Response) return auth;
  const { id: raw } = await params;
  const id = Number(raw);
  if (!/^\d{1,9}$/.test(raw) || id <= 0) return notFound();

  let file: Awaited<ReturnType<typeof auth.app.tasks.attachmentFile>>;
  try {
    file = await auth.app.tasks.attachmentFile(id);
  } catch (error) {
    console.error("GET /api/attachments failed", error);
    return notFound();
  }
  if (!file) return notFound();

  const body = new Uint8Array(file.bytes);
  return new Response(body, {
    headers: {
      "Content-Type": file.attachment.mimeType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": attachmentContentDisposition(file.attachment.fileName),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
