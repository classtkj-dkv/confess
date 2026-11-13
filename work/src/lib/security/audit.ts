import { getAdminRtdb } from "@/lib/firebase/admin";

/** Catat tindakan staff/owner ke audit_logs. Gagal tulis tidak boleh memblokir aksi. */
export async function writeAudit(
  actorUid: string,
  action: string,
  target: string,
  extra?: Record<string, unknown>
): Promise<void> {
  try {
    const ref = getAdminRtdb().ref("audit_logs").push();
    await ref.set({
      id: ref.key,
      actorUid,
      action,
      target,
      timestamp: Date.now(),
      ...(extra ? { meta: extra } : {}),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[audit] gagal menulis log:", err);
  }
}

/**
 * Log aktivitas PENGGUNA (daftar, masuk, kirim confession, komentar, like,
 * laporan, sesi anonim baru) → node `activity_logs` di Realtime Database.
 * Gagal tulis tidak boleh memblokir aksi.
 */
export async function writeActivity(
  uid: string,
  type: string,
  target = "",
  extra?: Record<string, unknown>
): Promise<void> {
  try {
    const ref = getAdminRtdb().ref("activity_logs").push();
    await ref.set({
      id: ref.key,
      actorUid: uid,
      action: type,
      target,
      timestamp: Date.now(),
      ...(extra ? { meta: extra } : {}),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[activity] gagal menulis log:", err);
  }
}

/**
 * Sinyal realtime untuk dashboard: setiap mutasi server menaikkan
 * meta/adminTick, dashboard (onValue) lalu memuat ulang tab aktif.
 */
export async function touchAdmin(): Promise<void> {
  try {
    await getAdminRtdb().ref("meta/adminTick").set(Date.now());
  } catch {
    /* non-fatal */
  }
}
