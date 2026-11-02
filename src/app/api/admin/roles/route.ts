import type { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  ApiError,
  errorResponse,
  requireOwner,
} from "@/lib/security/apiHelpers";
import { ROLE_RANK, rank, normalizeUserRole } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OWNER-only: mengubah role pengguna lain.
 * Ladder: owner > admin > user. Claim + dokumen users/{uid} diubah bersamaan.
 *
 * Proteksi:
 *  - Tidak bisa mengubah role akun sendiri.
 *  - Owner terakhir tidak bisa diturunkan (min 1 owner tersisa).
 *  - Role yang tidak dikenal ditolak (normalizeUserRole).
 *  - Akun yang diblokir hanya boleh tetap/jadi "user".
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const owner = await requireOwner(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
    }
    const { uid, role } = (body ?? {}) as { uid?: string; role?: string };

    if (!/^[a-zA-Z0-9_-]{17,28}$/.test(String(uid ?? ""))) {
      return Response.json({ error: "UID tidak valid." }, { status: 400 });
    }
    const targetUid = String(uid);
    const nextRole = normalizeUserRole(role);

    if (targetUid === owner.uid) {
      throw new ApiError(400, "Tidak bisa mengubah role akun sendiri.");
    }

    const db = getAdminDb();
    const targetSnap = await db.collection("users").doc(targetUid).get();
    const currentRole = normalizeUserRole(targetSnap.data()?.role);
    const isBlocked = targetSnap.data()?.isBlocked === true;

    if (isBlocked && nextRole !== "user") {
      throw new ApiError(
        400,
        "Akun ini diblokir — lepaskan blokir dulu sebelum memberi role."
      );
    }

    // Menurunkan owner terakhir dibatalkan bila tidak ada owner lain.
    if (
      rank(currentRole) >= ROLE_RANK.owner &&
      nextRole !== "owner"
    ) {
      const ownersSnap = await db.collection("users").where("role", "==", "owner").get();
      const otherOwners = ownersSnap.docs.filter((d) => d.id !== targetUid).length;
      if (otherOwners === 0) {
        throw new ApiError(
          400,
          "Minimal satu owner harus tetap tersisa. Tambahkan owner lain dulu sebelum menurunkan ini."
        );
      }
    }

    // Atomic: claim + DB role berubah bersamaan.
    await getAdminAuth().setCustomUserClaims(targetUid, { role: nextRole });
    await db.collection("users").doc(targetUid).set(
      { uid: targetUid, role: nextRole },
      { merge: true }
    );

    return Response.json({
      ok: true,
      message: `Role ${targetUid.slice(0, 6)}… diubah menjadi ${nextRole.toUpperCase()}.`,
      role: nextRole,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
