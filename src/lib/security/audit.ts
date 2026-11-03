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
