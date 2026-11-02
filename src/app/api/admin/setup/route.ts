import type { NextRequest } from "next/server";
import { errorResponse, ApiError } from "@/lib/security/apiHelpers";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bootstrap OWNER pertama (role ladder: owner > admin > user).
 * Dikunci dengan ADMIN_SETUP_SECRET (env-only, tidak ada di kode).
 * Bila owner sudah ada, endpoint menolak — penambahan admin/owner lanjutan
 * hanya dilakukan oleh owner lewat /api/admin/roles.
 *
 * Steps: curl -X POST <domain>/api/admin/setup
 *        -H "Content-Type: application/json"
 *        -d '{"secret":"<ADMIN_SETUP_SECRET>","uid":"<UID_LOGIN_MU>"}'
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const secret = process.env.ADMIN_SETUP_SECRET;
    if (!secret) {
      return Response.json(
        { error: "ADMIN_SETUP_SECRET tidak tersedia; bootstrap dikunci." },
        { status: 503 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body tidak valid." }, { status: 400 });
    }
    const { secret: providedSecret, uid } = (body ?? {}) as {
      secret?: string;
      uid?: string;
    };

    if (
      typeof providedSecret !== "string" ||
      providedSecret.length !== secret.length ||
      !timingSafeEqual(providedSecret, secret)
    ) {
      return Response.json({ error: "Secret salah." }, { status: 403 });
    }
    if (typeof uid !== "string" || !/^[a-zA-Z0-9_-]{17,28}$/.test(uid)) {
      return Response.json(
        { error: "UID login tidak valid (17-28 karakter). Buka /admin saat sudah login untuk menyalin UID-mu." },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    // Tolak bila owner sudah ada di database.
    const existingOwners = await db
      .collection("users")
      .where("role", "==", "owner")
      .limit(1)
      .get();

    if (!existingOwners.empty) {
      return Response.json(
        { error: "Owner sudah ditetapkan. Gunakan fitur kelola role oleh owner di /admin." },
        { status: 409 }
      );
    }

    // claim role "owner" — hanya bisa diset dari Server (Admin SDK).
    await getAdminAuth().setCustomUserClaims(uid, { role: "owner" });
    await db.collection("users").doc(uid).set(
      {
        uid,
        role: "owner",
        isBlocked: false,
        createdAt: Date.now(),
      },
      { merge: true }
    );

    return Response.json({
      ok: true,
      message: "UID telah ditetapkan sebagai OWNER. Login ulang / refresh token bila perlu.",
      role: "owner",
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(err);
  }
}

/** Constant-time compare tanpa dependensi tambahan. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
