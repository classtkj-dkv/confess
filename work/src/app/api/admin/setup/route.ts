import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  ApiError,
  errorResponse,
  requireAuth,
} from "@/lib/security/apiHelpers";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { writeAudit, touchAdmin } from "@/lib/security/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Bootstrap OWNER PERTAMA. Hanya berfungsi selama belum ada owner di
 * database, butuh login email, dan butuh ADMIN_SETUP_SECRET yang benar.
 * Setelah ada owner, endpoint ini selalu menolak.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const secretEnv = process.env.ADMIN_SETUP_SECRET;
    if (!secretEnv || secretEnv.length < 16) {
      throw new ApiError(503, "Setup owner belum diaktifkan (ADMIN_SETUP_SECRET).", "setup-disabled");
    }
    const ctx = await requireAuth(req);
    if (!ctx.email) {
      throw new ApiError(403, "Masuk dengan akun email terlebih dahulu.", "anonymous");
    }

    let body: { secret?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      throw new ApiError(400, "Body tidak valid.");
    }
    if (typeof body.secret !== "string" || !safeEqual(body.secret, secretEnv)) {
      throw new ApiError(403, "Kunci setup salah.", "bad-secret");
    }

    const db = getAdminRtdb();
    const existing = await db
      .ref("users")
      .orderByChild("role")
      .equalTo("owner")
      .limitToFirst(1)
      .get();
    if (existing.exists()) {
      throw new ApiError(409, "Owner sudah ada. Setup ditutup.", "owner-exists");
    }

    await db.ref(`users/${ctx.uid}`).update({
      uid: ctx.uid,
      email: ctx.email,
      role: "owner",
      status: "active",
      isBlocked: false,
      updatedAt: Date.now(),
    });
    await writeAudit(ctx.uid, "bootstrapOwner", ctx.uid);
    await touchAdmin();

    return Response.json({ ok: true, role: "owner" });
  } catch (err) {
    return errorResponse(err);
  }
}
