export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function msg(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 240);
}

/**
 * Cek konfigurasi tanpa membocorkan nilai rahasia: hanya true/false + pesan error.
 * Seluruh handler dibungkus try/catch dan modul admin dimuat dinamis, sehingga
 * kegagalan apa pun (termasuk saat import) tetap menghasilkan JSON, bukan 500 polos.
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
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";

  const result: Record<string, unknown> = {
    version: "rtdb",
    nodeVersion: process.version,
    env,
    databaseUrlLooksValid: /^https:\/\/.+\.(firebaseio\.com|firebasedatabase\.app)\/?$/.test(dbUrl),
    privateKeyLooksValid:
      rawKey.includes("BEGIN") && rawKey.includes("PRIVATE KEY") && rawKey.includes("END"),
    adminModule: { ok: false },
    rtdb: { ok: false },
    adminAuth: { ok: false },
  };

  try {
    const admin = await import("@/lib/firebase/admin");
    result.adminModule = { ok: true };

    try {
      await admin.getAdminRtdb().ref("settings/general").get();
      result.rtdb = { ok: true };
    } catch (err) {
      result.rtdb = { ok: false, error: msg(err) };
    }

    try {
      await admin.getAdminAuth().listUsers(1);
      result.adminAuth = { ok: true };
    } catch (err) {
      result.adminAuth = { ok: false, error: msg(err) };
    }
  } catch (err) {
    result.adminModule = { ok: false, error: msg(err) };
  }

  return Response.json(result);
}
