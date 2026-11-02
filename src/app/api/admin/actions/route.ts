import type { NextRequest } from "next/server";
import { errorResponse, requireStaff } from "@/lib/security/apiHelpers";
import { getAdminDb } from "@/lib/firebase/admin";

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
  | "dismissReport";

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
];

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireStaff(req);
    const db = getAdminDb();

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

    let message = "Aksi berhasil.";

    switch (body.type) {
      case "approveConfession": {
        await db.collection("confessions").doc(body.id).update({
          status: "PUBLISHED",
        });
        message = "Confession disetujui.";
        break;
      }
      case "rejectConfession": {
        await db.collection("confessions").doc(body.id).update({
          status: "REJECTED",
        });
        message = "Confession ditolak.";
        break;
      }
      case "deleteConfession": {
        const ref = db.collection("confessions").doc(body.id);
        // Cascade: remove related comments, reactions, reports.
        const [comments, reactions, reports] = await Promise.all([
          db.collection("comments").where("confessionId", "==", body.id).get(),
          db.collection("reactions").where("confessionId", "==", body.id).get(),
          db.collection("reports").where("confessionId", "==", body.id).get(),
        ]);
        await db.runTransaction(async (tx) => {
          tx.delete(ref);
          comments.forEach((c) => tx.delete(c.ref));
          reactions.forEach((r) => tx.delete(r.ref));
        });
        await Promise.all(reports.docs.map((r) => r.ref.delete()));
        message = "Confession dihapus beserta data terkait.";
        break;
      }
      case "hideComment": {
        await db.collection("comments").doc(body.id).update({ status: "HIDDEN" });
        const c = await db.collection("comments").doc(body.id).get();
        const confessionId = String(c?.data()?.confessionId ?? "");
        if (confessionId) {
          await db.collection("confessions").doc(confessionId).update({
            commentsCount: Math.max(0, Number((await db.collection("confessions").doc(confessionId).get()).data()?.commentsCount ?? 0) - 1),
          });
        }
        message = "Komentar disembunyikan.";
        break;
      }
      case "publishComment": {
        await db.collection("comments").doc(body.id).update({ status: "VISIBLE" });
        const c = await db.collection("comments").doc(body.id).get();
        const confessionId = String(c?.data()?.confessionId ?? "");
        if (confessionId) {
          await db.collection("confessions").doc(confessionId).update({
            commentsCount: Number((await db.collection("confessions").doc(confessionId).get()).data()?.commentsCount ?? 0) + 1,
          });
        }
        message = "Komentar ditayangkan.";
        break;
      }
      case "deleteComment": {
        const c = await db.collection("comments").doc(body.id).get();
        await db.collection("comments").doc(body.id).delete();
        const confessionId = String(c?.data()?.confessionId ?? "");
        if (confessionId && c.exists && c.data()?.status === "VISIBLE") {
          await db.collection("confessions").doc(confessionId).update({
            commentsCount: Math.max(0, Number(c.data()?.commentsCount ?? 0) - 1),
          });
        }
        message = "Komentar dihapus.";
        break;
      }
      case "deleteReport": {
        await db.collection("reports").doc(body.id).delete();
        message = "Laporan dihapus.";
        break;
      }
      case "resolveReport": {
        await db.collection("reports").doc(body.id).update({ status: "RESOLVED" });
        message = "Laporan ditandai selesai.";
        break;
      }
      case "dismissReport": {
        await db.collection("reports").doc(body.id).update({ status: "DISMISSED" });
        message = "Laporan diabaikan.";
        break;
      }
      case "blockUser": {
        if (!/^[a-zA-Z0-9_-]{17,28}$/.test(body.id)) {
          return Response.json({ error: "UID tidak valid." }, { status: 400 });
        }
        const targetUser = await db.collection("users").doc(body.id).get();
        if (targetUser.data()?.role === "owner") {
          return Response.json(
            { error: "Owner tidak bisa diblokir." },
            { status: 403 }
          );
        }
        await db.collection("users").doc(body.id).set(
          { uid: body.id, isBlocked: true },
          { merge: true }
        );
        message = "Akun diblokir.";
        break;
      }
      case "unblockUser": {
        if (!/^[a-zA-Z0-9_-]{17,28}$/.test(body.id)) {
          return Response.json({ error: "UID tidak valid." }, { status: 400 });
        }
        await db.collection("users").doc(body.id).set(
          { uid: body.id, isBlocked: false },
          { merge: true }
        );
        message = "Blokir dilepas.";
        break;
      }
    }

    return Response.json({ ok: true, message });
  } catch (err) {
    return errorResponse(err);
  }
}
