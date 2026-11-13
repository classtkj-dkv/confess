import type { NextRequest } from "next/server";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { ApiError, errorResponse, requireUid } from "@/lib/security/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEEP_DAYS = 30;
const SCAN_LIMIT = 100;

/**
 * Menandai notifikasi sudah dibaca. Klien hanya boleh membaca node
 * `notifications/{uid}`; semua penulisan lewat endpoint ini.
 * Body: { id: string } untuk satu notifikasi, atau { all: true } untuk semua.
 * Penandaan "semua" sekaligus membuang notifikasi yang lebih tua dari 30 hari.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const uid = await requireUid(req);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new ApiError(400, "Body JSON tidak valid.");
    }
    const body = (raw ?? {}) as { id?: unknown; all?: unknown };
    const db = getAdminRtdb();

    if (typeof body.id === "string") {
      if (!/^[-A-Za-z0-9_]{5,40}$/.test(body.id)) {
        throw new ApiError(400, "ID notifikasi tidak valid.");
      }
      const refPath = `notifications/${uid}/${body.id}`;
      const snap = await db.ref(refPath).get();
      if (snap.exists()) await db.ref(`${refPath}/read`).set(true);
      return Response.json({ ok: true });
    }

    if (body.all === true) {
      const snap = await db.ref(`notifications/${uid}`).limitToLast(SCAN_LIMIT).get();
      const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
      const updates: Record<string, unknown> = {};
      snap.forEach((child) => {
        const v = child.val() as Record<string, unknown>;
        if (Number(v?.createdAt ?? 0) < cutoff) {
          updates[`notifications/${uid}/${child.key}`] = null;
        } else if (v?.read !== true) {
          updates[`notifications/${uid}/${child.key}/read`] = true;
        }
      });
      if (Object.keys(updates).length > 0) await db.ref().update(updates);
      return Response.json({ ok: true });
    }

    throw new ApiError(400, "Permintaan tidak valid.");
  } catch (err) {
    return errorResponse(err);
  }
}
