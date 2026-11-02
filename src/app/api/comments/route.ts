import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  ApiError,
  assertNotBlocked,
  ensureUserDoc,
  errorResponse,
  requireUid,
} from "@/lib/security/apiHelpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { validateCommentInput } from "@/lib/validations";
import { getAdminSettings } from "@/lib/firebase/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const uid = await requireUid(req);
    await assertNotBlocked(uid);
    await ensureUserDoc(uid);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new ApiError(400, "Body JSON tidak valid.");
    }

    const confessionId = String((raw as Record<string, string> | null)?.confessionId ?? "");
    if (!confessionId) {
      throw new ApiError(400, "Confession tidak ditemukan.");
    }
    const clean = validateCommentInput(raw);

    const db = getAdminDb();

    const settings = await getAdminSettings();
    if (settings.maintenanceMode) {
      throw new ApiError(503, "CONFESS sedang dalam mode perawatan.");
    }
    if (!settings.allowComments) {
      throw new ApiError(503, "Komentar sedang dinonaktifkan admin.");
    }

    const rl = await checkRateLimit({
      scope: "comment",
      uid,
      limit: RATE_LIMITS.commentPerHour.limit,
      windowMs: RATE_LIMITS.commentPerHour.windowMs,
    });
    if (!rl.allowed) {
      throw new ApiError(429, "Batas 10 komentar per jam tercapai. Coba lagi nanti.");
    }

    const confessionRef = db.collection("confessions").doc(confessionId);
    let commentId = "";

    await db.runTransaction(async (tx) => {
      const confSnap = await tx.get(confessionRef);
      if (!confSnap.exists || confSnap.data()?.status !== "PUBLISHED") {
        throw new ApiError(404, "Confession tidak ditemukan atau tidak aktif.");
      }

      const ref = db.collection("comments").doc();
      tx.set(ref, {
        id: ref.id,
        confessionId,
        authorUid: uid,
        message: clean,
        createdAt: Date.now(),
        status: "VISIBLE",
      });
      tx.update(confessionRef, {
        commentsCount: FieldValue.increment(1),
      });
      commentId = ref.id;
    });

    return Response.json(
      { ok: true, id: commentId, status: "VISIBLE" },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
