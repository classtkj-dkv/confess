import { isCategoryId } from "@/lib/categories";
import { sanitizeText } from "@/lib/security/sanitize";

const MAX_CONFESSION_LENGTH = 1000;
const MAX_COMMENT_LENGTH = 500;

export interface ValidatedConfessionInput {
  message: string;
  category: string;
}

export function validateConfessionInput(
  body: unknown
): ValidatedConfessionInput {
  if (typeof body !== "object" || body === null) {
    throw new Error("Payload tidak valid.");
  }
  const { message, category } = body as Record<string, unknown>;

  if (typeof message !== "string" || message.trim().length < 10) {
    throw new Error("Confession minimal 10 karakter.");
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
  };
}

export function validateCommentInput(body: unknown): string {
  if (typeof body !== "object" || body === null) {
    throw new Error("Payload tidak valid.");
  }
  const { confessionId, message } = body as Record<string, unknown>;

  if (typeof confessionId !== "string" || !/^[a-zA-Z0-9_-]{5,64}$/.test(confessionId)) {
    throw new Error("Confession tidak ditemukan.");
  }
  if (typeof message !== "string" || message.trim().length < 3) {
    throw new Error("Komentar minimal 3 karakter.");
  }
  if (Array.from(message).length > MAX_COMMENT_LENGTH) {
    throw new Error("Komentar maksimal 500 karakter.");
  }
  return sanitizeText(message, MAX_COMMENT_LENGTH);
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
