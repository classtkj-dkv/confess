import { getAdminAuth, getAdminRtdb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cek konfigurasi tanpa membocorkan nilai rahasia: hanya true/false.
 * Buka https://<domain>/api/health di browser.
 */
export async function GET(): Promise<Response> {
  const env = {
    NEXT_PUBLIC_FIREBASE_API_KEY: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    NEXT_PUBLIC_FIREBASE_DATABASE_URL: Boolean(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL),
    FIREBASE_ADMIN_PROJECT_ID: Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID),
    FIREBASE_ADMIN_CLIENT_EMAIL: Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL),
    FIREBASE_ADMIN_PRIVATE_KEY: Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
    ADMIN_SETUP_SECRET: Boolean(process.env.ADMIN_SETUP_SECRET),
  };
  const dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "";
  let rtdb: { ok: boolean; error?: string } = { ok: false };
  try {
    await getAdminRtdb().ref("settings/general").get();
    rtdb = { ok: true };
  } catch (err) {
    rtdb = { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "unknown" };
  }
  // Admin Auth: bukti kredensial service account benar (dipakai verifikasi token).
  let adminAuth: { ok: boolean; error?: string } = { ok: false };
  try {
    await getAdminAuth().listUsers(1);
    adminAuth = { ok: true };
  } catch (err) {
    adminAuth = { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "unknown" };
  }
  return Response.json({
    version: "rtdb-migration",
    env,
    databaseUrlLooksValid: /^https:\/\/.+\.(firebaseio\.com|firebasedatabase\.app)\/?$/.test(dbUrl),
    rtdb,
    adminAuth,
  });
}
