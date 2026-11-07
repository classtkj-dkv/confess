import { getAdminRtdb } from "@/lib/firebase/admin";

/**
 * Data confession ada di DUA tempat:
 *  - confessions/{id}        → privat (berisi authorUid; hanya staff/server)
 *  - public/confessions/{id} → proyeksi publik (tanpa authorUid), hanya yang PUBLISHED
 * Server menjaga keduanya sinkron. Klien publik hanya membaca `public/*`.
 */
export function publicConfessionOf(
  id: string,
  c: Record<string, unknown>
): Record<string, unknown> {
  const fromName = String(c.fromName ?? "");
  const toName = String(c.toName ?? "");
  return {
    id,
    message: String(c.message ?? ""),
    ...(fromName ? { fromName } : {}),
    ...(toName ? { toName } : {}),
    messageLower: String(c.messageLower ?? String(c.message ?? "").toLowerCase()),
    category: String(c.category ?? "random"),
    createdAt: Number(c.createdAt ?? 0),
    likesCount: Number(c.likesCount ?? 0),
    commentsCount: Number(c.commentsCount ?? 0),
  };
}

export function publicCommentOf(
  id: string,
  c: Record<string, unknown>
): Record<string, unknown> {
  const fromName = String(c.fromName ?? "");
  const parentId = String(c.parentId ?? "");
  const replyToName = String(c.replyToName ?? "");
  return {
    id,
    confessionId: String(c.confessionId ?? ""),
    message: String(c.message ?? ""),
    ...(fromName ? { fromName } : {}),
    ...(parentId ? { parentId } : {}),
    ...(parentId && replyToName ? { replyToName } : {}),
    createdAt: Number(c.createdAt ?? 0),
  };
}

/** Hapus semua data publik + privat terkait satu confession (multi-path atomik). */
export async function deleteConfessionCascade(id: string): Promise<void> {
  const db = getAdminRtdb();
  const [comments, reports] = await Promise.all([
    db.ref("comments").orderByChild("confessionId").equalTo(id).get(),
    db.ref("reports").orderByChild("confessionId").equalTo(id).get(),
  ]);
  const updates: Record<string, null> = {
    [`confessions/${id}`]: null,
    [`public/confessions/${id}`]: null,
    [`public/comments/${id}`]: null,
    [`reactions/${id}`]: null,
  };
  comments.forEach((c) => {
    updates[`comments/${c.key}`] = null;
  });
  reports.forEach((r) => {
    updates[`reports/${r.key}`] = null;
  });
  await db.ref().update(updates);
}
