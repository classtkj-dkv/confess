import { isCategoryId } from "@/lib/categories";
import { sanitizeText } from "@/lib/security/sanitize";

const MAX_CONFESSION_LENGTH = 1000;
const MAX_COMMENT_LENGTH = 500;
const MAX_NAME_LENGTH = 30;
const MAX_LYRIC_LENGTH = 200;

/** Nama opsional: satu baris, tanpa HTML, dipotong diam-diam. */
export function cleanName(value: unknown): string {
  if (typeof value !== "string") return "";
  return sanitizeText(value.replace(/[\r\n]+/g, " "), MAX_NAME_LENGTH).trim();
}

export interface ValidatedConfessionInput {
  message: string;
  category: string;
  fromName: string;
  toName: string;
  kind: "menfess" | "songfess";
  songId: string;
  songLyric: string;
}

export function validateConfessionInput(
  body: unknown
): ValidatedConfessionInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Payload tidak valid.");
  }
  const { message, category, fromName, toName, songId, songLyric, kind } = body as Record<
    string,
    unknown
  >;
  const cleanSongId = typeof songId === "string" && /^\d{1,12}$/.test(songId) ? songId : "";

  if (typeof message !== "string" || !/[\p{L}\p{N}]/u.test(message)) {
    throw new Error("Confession tidak boleh kosong.");
  }
  if (Array.from(message).length > MAX_CONFESSION_LENGTH) {
    throw new Error("Confession maksimal 1.000 karakter.");
  }
  if (!isCategoryId(category)) {
    throw new Error("Kategori tidak valid.");
  }

  return {
    message: sanitizeText(message, MAX_CONFESSION_LENGTH),
    category,
    fromName: cleanName(fromName),
    toName: cleanName(toName),
    kind: kind === "songfess" ? "songfess" : "menfess",
    songId: cleanSongId,
    songLyric:
      cleanSongId && typeof songLyric === "string"
        ? sanitizeText(songLyric, MAX_LYRIC_LENGTH).trim()
        : "",
  };
}

export function validateCommentInput(body: unknown): {
  message: string;
  fromName: string;
  parentId: string;
} {
  if (typeof body !== "object" || body === null) {
    throw new Error("Payload tidak valid.");
  }
  const { confessionId, message, fromName, parentId } = body as Record<string, unknown>;

  if (typeof confessionId !== "string" || !/^[a-zA-Z0-9_-]{5,64}$/.test(confessionId)) {
    throw new Error("Confession tidak ditemukan.");
  }
  if (typeof message !== "string" || !/[\p{L}\p{N}]/u.test(message)) {
    throw new Error("Komentar tidak boleh kosong.");
  }
  if (Array.from(message).length > MAX_COMMENT_LENGTH) {
    throw new Error("Komentar maksimal 500 karakter.");
  }
  return {
    message: sanitizeText(message, MAX_COMMENT_LENGTH),
    fromName: cleanName(fromName),
    parentId:
      typeof parentId === "string" && /^[a-zA-Z0-9_-]{5,64}$/.test(parentId) ? parentId : "",
  };
}

export function validateReportInput(body: unknown): {
  confessionId: string;
  reason: string;
  detail: string;
} {
  if (typeof body !== "object" || body === null) {
    throw new Error("Payload tidak valid.");
  }
  const { confessionId, reason, detail } = body as Record<string, unknown>;

  if (typeof confessionId !== "string" || !/^[a-zA-Z0-9_-]{5,64}$/.test(confessionId)) {
    throw new Error("Confession tidak ditemukan.");
  }
  if (typeof reason !== "string" || reason.length === 0 || reason.length > 32) {
    throw new Error("Alasan laporan tidak valid.");
  }

  return {
    confessionId,
    reason,
    detail: sanitizeText(detail, 300),
  };
}

export { MAX_CONFESSION_LENGTH, MAX_COMMENT_LENGTH };
