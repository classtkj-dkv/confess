import type { NextRequest } from "next/server";
import { getAdminRtdb } from "@/lib/firebase/admin";
import {
  ApiError,
  assertNotBlocked,
  ensureUserDoc,
  errorResponse,
  requireAuth,
} from "@/lib/security/apiHelpers";
import { sanitizeText } from "@/lib/security/sanitize";
import { writeActivity } from "@/lib/security/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dipanggil setelah daftar/masuk dengan email:
 * memastikan dokumen users/{uid} ada dengan role default "user" (bila baru).
 * Role TIDAK PERNAH bisa diatur dari sini — role hanya diubah langsung
 * di database (Firebase Console → Realtime Database → users → {uid} → role).
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { uid, email, role, isAnonymous } = await requireAuth(req);
    await assertNotBlocked(uid);
    await ensureUserDoc(uid, email, isAnonymous);

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const displayName = sanitizeText(
      (body as Record<string, unknown>)?.displayName,
      40
    );
    const event = (body as Record<string, unknown>)?.event;
    const patch: Record<string, unknown> = {};
    if (displayName) {
      patch.displayName = displayName;
      patch.profileUpdatedAt = Date.now();
    }
    if (!isAnonymous && email) {
      patch.email = email;
      patch.isAnonymous = false;
      if (event === "login") patch.lastLoginAt = Date.now();
      if (event === "register") patch.registeredAt = Date.now();
    }
    if (Object.keys(patch).length > 0) {
      await getAdminRtdb().ref(`users/${uid}`).update(patch);
    }
    if (event === "register" || event === "login") {
      await writeActivity(uid, event, email ?? "");
    }

    return Response.json({ ok: true, role });
  } catch (err) {
    if (err instanceof ApiError) {
      return Response.json(
        { error: err.message, code: err.code ?? null },
        { status: err.status }
      );
    }
    return errorResponse(err);
  }
}
