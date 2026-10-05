/**
 * Helpers for classifying and identifying attachments across the two backing
 * stores used by the app:
 *   - `attachment` rows (numeric ids)
 *   - `insp_media` rows captured live in the inspection workspace
 *     (ids surfaced as `m-<id>`, `media-<id>` or `media-anom-<id>`)
 */

export type AttachmentCategory = "PHOTO" | "VIDEO" | "DOCUMENT" | "OTHER";

export const ATTACHMENT_CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  PHOTO: "Photos",
  VIDEO: "Videos",
  DOCUMENT: "Documents",
  OTHER: "Other",
};

const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic"];
const VIDEO_EXT = ["mp4", "mov", "webm", "mkv", "avi", "wmv", "m4v", "flv", "asf"];
const DOC_EXT = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt", "rtf", "odt"];

export function getAttachmentCategory(att: any): AttachmentCategory {
  const meta = (att?.meta && typeof att.meta === "object" ? att.meta : {}) as any;

  const explicit = String(meta.type || "").toUpperCase();
  if (explicit === "PHOTO" || explicit === "IMAGE") return "PHOTO";
  if (explicit === "VIDEO") return "VIDEO";
  if (explicit === "DOCUMENT" || explicit === "FILE") return "DOCUMENT";

  const mime = String(meta.file_type || meta.mime || "").toLowerCase();
  if (mime.startsWith("image/")) return "PHOTO";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.includes("pdf") || mime.includes("document") || mime.includes("sheet") || mime.startsWith("text/")) {
    return "DOCUMENT";
  }

  const candidate = String(meta.original_file_name || att?.name || att?.path || "")
    .split("?")[0]
    .split(".")
    .pop()
    ?.toLowerCase();
  if (candidate) {
    if (IMAGE_EXT.includes(candidate)) return "PHOTO";
    if (VIDEO_EXT.includes(candidate)) return "VIDEO";
    if (DOC_EXT.includes(candidate)) return "DOCUMENT";
  }

  return "OTHER";
}

const MEDIA_ID_RE = /^(?:m|media)-(?:anom-)?(\d+)$/;

/** Returns the numeric `insp_media.media_id` for media-style ids, otherwise null. */
export function parseMediaId(id: unknown): number | null {
  const match = String(id ?? "").match(MEDIA_ID_RE);
  return match ? Number(match[1]) : null;
}

export function isMediaAttachment(att: any): boolean {
  return parseMediaId(att?.id) !== null || !!att?.meta?.is_insp_media;
}
