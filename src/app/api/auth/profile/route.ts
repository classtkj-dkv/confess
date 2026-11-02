import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  ApiError,
  assertNotBlocked,
  ensureUserDoc,
  errorResponse,
  requireAuth,
} from "@/lib/security/apiHelpers";
import { sanitizeText } from "@/lib/security/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dipanggil setelah daftar/masuk dengan email:
 * memastikan dokumen users/{uid} ada dengan role default "user" (bila baru).
 * Role TIDAK PERNAH bisa diatur dari sini — role hanya diubah langsung
 * di database (Firebase Console → Firestore → users/{uid}.role).
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { uid, email } = await requireAuth(req);
    await assertNotBlocked(uid);
    const role = await ensureUserDoc(uid, email);

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
    if (displayName) {
      await getAdminDb()
        .collection("users")
        .doc(uid)
        .set(
          { displayName, profileUpdatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
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
