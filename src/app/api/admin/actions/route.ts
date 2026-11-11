import type { NextRequest } from "next/server";
import { ServerValue } from "firebase-admin/database";
import {
  ApiError,
  errorResponse,
  requireStaff,
  type AuthContext,
} from "@/lib/security/apiHelpers";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { isAdminRole, normalizeUserRole, rank } from "@/lib/auth/roles";
import {
  deleteConfessionCascade,
  publicCommentOf,
  publicConfessionOf,
} from "@/lib/firebase/publicData";
import { touchAdmin, writeAudit } from "@/lib/security/audit";
import { ipKey, setIpBlocked } from "@/lib/security/ipWatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminAction =
  | "approveConfession"
  | "rejectConfession"
  | "deleteConfession"
  | "hideComment"
  | "publishComment"
  | "deleteComment"
  | "deleteReport"
  | "blockUser"
  | "unblockUser"
  | "resolveReport"
  | "dismissReport"
  | "blockIp"
  | "unblockIp";

interface ActionBody {
  type: AdminAction;
  id: string;
}

const allowedActions: readonly AdminAction[] = [
  "approveConfession",
  "rejectConfession",
  "deleteConfession",
  "hideComment",
  "publishComment",
  "deleteComment",
  "deleteReport",
  "blockUser",
  "unblockUser",
  "resolveReport",
  "dismissReport",
  "blockIp",
  "unblockIp",
];

/** Aksi yang hanya boleh admin/owner (bukan moderator). */
const ADMIN_ONLY: readonly AdminAction[] = [
  "blockUser",
  "unblockUser",
  "deleteConfession",
  "blockIp",
  "unblockIp",
];

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const actor: AuthContext = await requireStaff(req);
    const db = getAdminRtdb();

    let body: ActionBody;
    try {
      body = (await req.json()) as ActionBody;
    } catch {
      return Response.json({ error: "Body tidak valid." }, { status: 400 });
    }
    if (!body || typeof body.type !== "string" || typeof body.id !== "string") {
      return Response.json({ error: "Payload aksi tidak valid." }, { status: 400 });
    }
    if (!allowedActions.includes(body.type)) {
      return Response.json({ error: "Aksi tidak dikenal." }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]{5,64}$/.test(body.id)) {
      return Response.json({ error: "ID tidak valid." }, { status: 400 });
    }
    if (ADMIN_ONLY.includes(body.type) && !isAdminRole(actor.role)) {
      throw new ApiError(403, "Aksi ini hanya untuk admin/owner.", "not-admin");
    }

    const now = Date.now();
    let message = "Aksi berhasil.";

    switch (body.type) {
      case "approveConfession": {
        const snap = await db.ref(`confessions/${body.id}`).get();
        if (!snap.exists()) throw new ApiError(404, "Confession tidak ditemukan.");
        const conf = snap.val() as Record<string, unknown>;
        await db.ref().update({
          [`confessions/${body.id}/status`]: "PUBLISHED",
          [`confessions/${body.id}/updatedAt`]: now,
          [`public/confessions/${body.id}`]: publicConfessionOf(body.id, conf),
        });
        message = "Confession disetujui.";
        break;
      }
      case "rejectConfession": {
        const snap = await db.ref(`confessions/${body.id}`).get();
        if (!snap.exists()) throw new ApiError(404, "Confession tidak ditemukan.");
        await db.ref().update({
          [`confessions/${body.id}/status`]: "REJECTED",
          [`confessions/${body.id}/updatedAt`]: now,
          [`public/confessions/${body.id}`]: null,
        });
        message = "Confession ditolak.";
        break;
      }
      case "deleteConfession": {
        await deleteConfessionCascade(body.id);
        message = "Confession dihapus beserta data terkait.";
        break;
      }
      case "hideComment": {
        const snap = await db.ref(`comments/${body.id}`).get();
        if (!snap.exists()) throw new ApiError(404, "Komentar tidak ditemukan.");
        const c = snap.val() as Record<string, unknown>;
        const cid = String(c.confessionId ?? "");
        if (c.status === "VISIBLE" && cid) {
          await db.ref().update({
            [`comments/${body.id}/status`]: "HIDDEN",
            [`public/comments/${cid}/${body.id}`]: null,
            [`confessions/${cid}/commentsCount`]: ServerValue.increment(-1),
            [`public/confessions/${cid}/commentsCount`]: ServerValue.increment(-1),
          });
        } else {
          await db.ref(`comments/${body.id}/status`).set("HIDDEN");
        }
        message = "Komentar disembunyikan.";
        break;
      }
      case "publishComment": {
        const snap = await db.ref(`comments/${body.id}`).get();
        if (!snap.exists()) throw new ApiError(404, "Komentar tidak ditemukan.");
        const c = snap.val() as Record<string, unknown>;
        const cid = String(c.confessionId ?? "");
        if (c.status !== "VISIBLE" && cid) {
          await db.ref().update({
            [`comments/${body.id}/status`]: "VISIBLE",
            [`public/comments/${cid}/${body.id}`]: publicCommentOf(body.id, c),
            [`confessions/${cid}/commentsCount`]: ServerValue.increment(1),
            [`public/confessions/${cid}/commentsCount`]: ServerValue.increment(1),
          });
        }
        message = "Komentar ditayangkan.";
        break;
      }
      case "deleteComment": {
        const snap = await db.ref(`comments/${body.id}`).get();
        if (!snap.exists()) throw new ApiError(404, "Komentar tidak ditemukan.");
        const c = snap.val() as Record<string, unknown>;
        const cid = String(c.confessionId ?? "");
        const updates: Record<string, unknown> = {
          [`comments/${body.id}`]: null,
          [`public/comments/${cid}/${body.id}`]: null,
        };
        if (c.status === "VISIBLE" && cid) {
          updates[`confessions/${cid}/commentsCount`] = ServerValue.increment(-1);
          updates[`public/confessions/${cid}/commentsCount`] = ServerValue.increment(-1);
        }
        await db.ref().update(updates);
        message = "Komentar dihapus.";
        break;
      }
      case "deleteReport": {
        await db.ref(`reports/${body.id}`).remove();
        message = "Laporan dihapus.";
        break;
      }
      case "resolveReport": {
        await db.ref(`reports/${body.id}/status`).set("RESOLVED");
        message = "Laporan ditandai selesai.";
        break;
      }
      case "dismissReport": {
        await db.ref(`reports/${body.id}/status`).set("DISMISSED");
        message = "Laporan diabaikan.";
        break;
      }
      case "blockUser":
      case "unblockUser": {
        if (!/^[a-zA-Z0-9_-]{17,128}$/.test(body.id)) {
          return Response.json({ error: "UID tidak valid." }, { status: 400 });
        }
        const userRef = db.ref(`users/${body.id}`);
        const target = await userRef.get();
        const targetRole = normalizeUserRole(target.val()?.role);
        if (body.type === "blockUser") {
          if (body.id === actor.uid) {
            throw new ApiError(400, "Tidak bisa memblokir akun sendiri.");
          }
          if (rank(targetRole) >= rank(actor.role)) {
            throw new ApiError(
              403,
              "Tidak bisa memblokir akun dengan role setara atau lebih tinggi."
            );
          }
        }
        const blocked = body.type === "blockUser";
        await userRef.update({
          uid: body.id,
          isBlocked: blocked,
          status: blocked ? "blocked" : "active",
          updatedAt: now,
        });
        message = blocked ? "Akun diblokir." : "Blokir dilepas.";
        break;
      }
      case "blockIp":
      case "unblockIp": {
        // body.id = kunci hash IP (dipilih dari daftar IP di admin panel).
        if (!/^[a-f0-9]{40}$/.test(body.id)) {
          return Response.json({ error: "Kunci IP tidak valid." }, { status: 400 });
        }
        const ipSnap = await db.ref(`ip_logs/${body.id}/ip`).get();
        const ip = String(ipSnap.val() ?? "");
        if (!ip) throw new ApiError(404, "Catatan IP tidak ditemukan.");
        await setIpBlocked(ip, body.type === "blockIp", actor.uid);
        message = body.type === "blockIp" ? "IP diblokir." : "Blokir IP dilepas.";
        break;
      }
    }

    await writeAudit(actor.uid, body.type, body.id);
    await touchAdmin();
    return Response.json({ ok: true, message });
  } catch (err) {
    return errorResponse(err);
  }
}
