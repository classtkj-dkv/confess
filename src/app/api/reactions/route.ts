import type { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
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
 * Toggle a reaction. One reaction per (uid, confession) — the doc id is
 * deterministic `${confessionId}__${userUid}`, so toggling is idempotent
 * even under races. Counter updates happen in the same transaction.
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
    const { confessionId, type } = raw as Record<string, string>;

    if (
      typeof confessionId !== "string" ||
      !/^[a-zA-Z0-9_-]{5,64}$/.test(confessionId)
    ) {
      throw new ApiError(400, "Confession tidak ditemukan.");
    }
    if (typeof type !== "string" || !VALID_TYPES.has(type)) {
      throw new ApiError(400, "Tipe reaksi tidak valid.");
    }

    const db = getAdminDb();
    const confessionRef = db.collection("confessions").doc(confessionId);
    const reactionRef = db
      .collection("reactions")
      .doc(`${confessionId}_${uid}`);

    let liked = false;

    await db.runTransaction(async (tx) => {
      const [confSnap, reactionSnap] = await Promise.all([
        tx.get(confessionRef),
        tx.get(reactionRef),
      ]);

      if (!confSnap.exists || confSnap.data()?.status !== "PUBLISHED") {
        throw new ApiError(404, "Confession tidak ditemukan atau tidak aktif.");
      }

      if (reactionSnap.exists) {
        tx.delete(reactionRef);
        tx.update(confessionRef, {
          likesCount: Math.max(0, Number(confSnap.data()?.likesCount ?? 0) - 1),
        });
        liked = false;
      } else {
        tx.set(reactionRef, {
          id: reactionRef.id,
          confessionId,
          userUid: uid,
          type,
          createdAt: Date.now(),
        });
        tx.update(confessionRef, {
          likesCount: Number(confSnap.data()?.likesCount ?? 0) + 1,
        });
        liked = true;
      }
    });

    return Response.json({ ok: true, liked });
  } catch (err) {
    return errorResponse(err);
  }
}
