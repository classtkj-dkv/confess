import type { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  ApiError,
  assertNotBlocked,
  errorResponse,
  requireUid,
} from "@/lib/security/apiHelpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { isReportReason } from "@/lib/categories";
import { validateReportInput } from "@/lib/validations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const input = validateReportInput(raw);
    if (!isReportReason(input.reason)) {
      throw new ApiError(400, "Alasan laporan tidak valid.");
    }

    const db = getAdminDb();
    const confessionSnap = await db.collection("confessions").doc(input.confessionId).get();
    if (!confessionSnap.exists) {
      throw new ApiError(404, "Confession tidak ditemukan.");
    }

    // Dupe protection: same reporter + confession = one report only.
    const existing = await db
      .collection("reports")
      .where("confessionId", "==", input.confessionId)
      .where("reporterUid", "==", uid)
      .limit(1)
      .get();
    if (!existing.empty) {
      return Response.json({ ok: true, duplicate: true }, { status: 200 });
    }

    const rl = await checkRateLimit({
      scope: "report",
      uid,
      limit: RATE_LIMITS.reportPerDay.limit,
      windowMs: RATE_LIMITS.reportPerDay.windowMs,
    });
    if (!rl.allowed) {
      throw new ApiError(429, "Batas laporan harian tercapai.");
    }

    const ref = db.collection("reports").doc();
    await ref.set({
      id: ref.id,
      confessionId: input.confessionId,
      reporterUid: uid,
      reason: input.reason,
      detail: input.detail,
      createdAt: Date.now(),
      status: "OPEN",
    });

    return Response.json({ ok: true, id: ref.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
