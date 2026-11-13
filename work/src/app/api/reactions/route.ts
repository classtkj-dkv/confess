import type { NextRequest } from "next/server";
import { ServerValue } from "firebase-admin/database";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { writeActivity } from "@/lib/security/audit";
import {
  ApiError,
  assertNotBlocked,
  errorResponse,
  requireUid,
} from "@/lib/security/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(["like"]);

/**
 * Toggle reaksi. Satu reaksi per (confession, uid) di
 * reactions/{confessionId}/{uid}. Toggle memakai transaction pada node
 * reaksi itu sendiri sehingga aman dari klik ganda / race; counter diubah
 * lewat ServerValue.increment pada data privat + publik.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const uid = await requireUid(req);
    await assertNotBlocked(uid);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new ApiError(400, "Body JSON tidak valid.");
    }
    const { confessionId, type } = (raw ?? {}) as Record<string, string>;

    if (
      typeof confessionId !== "string" ||
      !/^[a-zA-Z0-9_-]{5,64}$/.test(confessionId)
    ) {
      throw new ApiError(400, "Confession tidak ditemukan.");
    }
    if (typeof type !== "string" || !VALID_TYPES.has(type)) {
      throw new ApiError(400, "Tipe reaksi tidak valid.");
    }

    const db = getAdminRtdb();
    const status = await db.ref(`confessions/${confessionId}/status`).get();
    if (status.val() !== "PUBLISHED") {
      throw new ApiError(404, "Confession tidak ditemukan atau tidak aktif.");
    }

    const reactionRef = db.ref(`reactions/${confessionId}/${uid}`);
    const tx = await reactionRef.transaction((cur: unknown) =>
      cur ? null : { type, createdAt: Date.now() }
    );
    if (!tx.committed) {
      throw new ApiError(409, "Reaksi sedang diproses, coba lagi.");
    }
    const liked = tx.snapshot.exists();

    const delta = ServerValue.increment(liked ? 1 : -1);
    await db.ref().update({
      [`confessions/${confessionId}/likesCount`]: delta,
      [`public/confessions/${confessionId}/likesCount`]: delta,
    });

    // Jaga agar counter tidak negatif bila data lama tidak konsisten.
    const cur = await db.ref(`confessions/${confessionId}/likesCount`).get();
    if (Number(cur.val() ?? 0) < 0) {
      await db.ref().update({
        [`confessions/${confessionId}/likesCount`]: 0,
        [`public/confessions/${confessionId}/likesCount`]: 0,
      });
    }

    await writeActivity(uid, liked ? "like" : "unlike", String(confessionId));
    return Response.json({ ok: true, liked });
  } catch (err) {
    return errorResponse(err);
  }
}
