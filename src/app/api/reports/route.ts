import type { NextRequest } from "next/server";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { touchAdmin, writeActivity } from "@/lib/security/audit";
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

    const db = getAdminRtdb();
    const confessionSnap = await db.ref(`confessions/${input.confessionId}/status`).get();
    if (!confessionSnap.exists()) {
      throw new ApiError(404, "Confession tidak ditemukan.");
    }

    // Dupe protection: id laporan deterministik per (confession, reporter).
    const reportId = `${input.confessionId}_${uid}`;
    const existing = await db.ref(`reports/${reportId}`).get();
    if (existing.exists()) {
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

    await db.ref(`reports/${reportId}`).set({
      id: reportId,
      confessionId: input.confessionId,
      reporterUid: uid,
      reason: input.reason,
      detail: input.detail ?? "",
      createdAt: Date.now(),
      status: "OPEN",
    });
    await touchAdmin();
    await writeActivity(uid, "report_created", reportId, { confessionId: input.confessionId, reason: input.reason });

    return Response.json({ ok: true, id: reportId }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
