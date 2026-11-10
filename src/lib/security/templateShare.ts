import { createHash, randomBytes, randomInt } from "node:crypto";

/** Kode 4 digit dari pengirim: tepat empat angka. */
export const CODE_RE = /^\d{4}$/;
export const TEMPLATE_ID_RE = /^[a-z0-9]{8,12}$/;

export const MAX_DESIGN_BYTES = 60_000;
export const MAX_BG_CHARS = 2_400_000;
export const MAX_FAILED_ATTEMPTS = 8;
export const LOCK_MS = 30 * 60 * 1000;

export function newTemplateId(): string {
  return randomBytes(6).toString("hex").slice(0, 10);
}

export function randomCode(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

export function hashCode(id: string, code: string): string {
  return createHash("sha256").update(`confess-tpl:${id}:${code}`).digest("hex");
}
