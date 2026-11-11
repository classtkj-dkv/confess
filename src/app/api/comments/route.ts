import type { NextRequest } from "next/server";
import { ServerValue } from "firebase-admin/database";
import { getAdminRtdb } from "@/lib/firebase/admin";
import {
  ApiError,
  assertNotBlocked,
  errorResponse,
  requireUid,
} from "@/lib/security/apiHelpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { validateCommentInput } from "@/lib/validations";
import { getAdminSettings } from "@/lib/firebase/settings";
import { publicCommentOf } from "@/lib/firebase/publicData";
import { touchAdmin, writeActivity } from "@/lib/security/audit";
import { enforceIp } from "@/lib/security/ipWatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const uid = await requireUid(req);
    await assertNotBlocked(uid);

    // Anti-spam per jaringan: IP diblokir/dibanjir langsung ditolak.
    const ipWatch = await enforceIp(req, uid, "comment");

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new ApiError(400, "Body JSON tidak valid.");
    }

    const confessionId = String((raw as Record<string, string> | null)?.confessionId ?? "");
    if (!/^[a-zA-Z0-9_-]{5,64}$/.test(confessionId)) {
      throw new ApiError(400, "Confession tidak ditemukan.");
    }
    const { message: clean, fromName, parentId } = validateCommentInput(raw);

    const db = getAdminRtdb();

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

    const confStatus = await db.ref(`confessions/${confessionId}/status`).get();
    if (confStatus.val() !== "PUBLISHED") {
      throw new ApiError(404, "Confession tidak ditemukan atau tidak aktif.");
    }

    // Balasan: induk harus komentar tayang di confession yang sama.
    // Balasan dari balasan dirapikan ke komentar tingkat atas (satu level).
    let rootId = "";
    let replyToName = "";
    if (parentId) {
      const parentSnap = await db.ref(`public/comments/${confessionId}/${parentId}`).get();
      if (!parentSnap.exists()) {
        throw new ApiError(404, "Komentar yang dibalas sudah tidak ada.");
      }
      const parent = parentSnap.val() as Record<string, unknown>;
      rootId = String(parent.parentId || parentId);
      replyToName = String(parent.fromName || "Anonim");
    }

    const ref = db.ref("comments").push();
    const commentId = ref.key as string;
    const record = {
      id: commentId,
      confessionId,
      authorUid: uid,
      message: clean,
      ...(fromName ? { fromName } : {}),
      ...(rootId ? { parentId: rootId, replyToName } : {}),
      // Catatan jaringan (privat, hanya staff): tampil di admin panel.
      ...(ipWatch.ip ? { ip: ipWatch.ip } : {}),
      createdAt: Date.now(),
      status: "VISIBLE",
    };
    // Satu update multi-path: komentar privat + publik + counter (atomik).
    await db.ref().update({
      [`comments/${commentId}`]: record,
      [`public/comments/${confessionId}/${commentId}`]: publicCommentOf(commentId, record),
      [`confessions/${confessionId}/commentsCount`]: ServerValue.increment(1),
      [`public/confessions/${confessionId}/commentsCount`]: ServerValue.increment(1),
    });
    await touchAdmin();
    await writeActivity(uid, "comment_created", commentId, {
      confessionId,
      ...(ipWatch.ip ? { ip: ipWatch.ip } : {}),
    });

    return Response.json(
      { ok: true, id: commentId, status: "VISIBLE" },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
