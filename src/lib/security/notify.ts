import { getAdminRtdb } from "@/lib/firebase/admin";
import type { NotificationType } from "@/types";

export interface NotificationInput {
  type: NotificationType;
  confessionId: string;
  commentId?: string;
  /** Nama tampil pengomentar (kosong = Anonim). */
  fromName?: string;
  /** Cuplikan komentar (dipotong 120 karakter). */
  snippet?: string;
}

/**
 * Menambahkan notifikasi untuk `targetUid` ke objek multi-path `updates`
 * (ditulis atomik bersama data lain). Klien hanya boleh MEMBACA
 * `notifications/{uid}` miliknya sendiri (lihat database.rules.json);
 * semua penulisan lewat server.
 */
export function addNotification(
  updates: Record<string, unknown>,
  targetUid: string,
  n: NotificationInput
): void {
  if (!targetUid) return;
  const key = getAdminRtdb().ref(`notifications/${targetUid}`).push().key;
  if (!key) return;
  updates[`notifications/${targetUid}/${key}`] = {
    id: key,
    type: n.type,
    confessionId: n.confessionId,
    ...(n.commentId ? { commentId: n.commentId } : {}),
    ...(n.fromName ? { fromName: n.fromName } : {}),
    ...(n.snippet ? { snippet: Array.from(n.snippet).slice(0, 120).join("") } : {}),
    createdAt: Date.now(),
    read: false,
  };
}
