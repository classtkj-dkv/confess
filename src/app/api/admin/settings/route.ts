import type { NextRequest } from "next/server";
import { errorResponse, requireAdmin } from "@/lib/security/apiHelpers";
import { updateAdminSettings } from "@/lib/firebase/settings";
import { sanitizeText } from "@/lib/security/sanitize";
import { touchAdmin, writeAudit } from "@/lib/security/audit";
import type { AppSettings } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const actor = await requireAdmin(req);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return Response.json({ error: "Body tidak valid." }, { status: 400 });
    }

    const body = (raw ?? {}) as Record<string, unknown>;
    const patch: Partial<AppSettings> = {};

    if (typeof body.maintenanceMode === "boolean") {
      patch.maintenanceMode = body.maintenanceMode;
    }
    if (typeof body.allowComments === "boolean") {
      patch.allowComments = body.allowComments;
    }
    if (typeof body.allowConfessions === "boolean") {
      patch.allowConfessions = body.allowConfessions;
    }
    if (typeof body.allowSongs === "boolean") {
      patch.allowSongs = body.allowSongs;
    }
    if (typeof body.websiteName === "string" && body.websiteName.trim()) {
      patch.websiteName = sanitizeText(body.websiteName, 60);
    }
    if (typeof body.maxConfessionLength === "number") {
      patch.maxConfessionLength = Math.min(1000, Math.max(50, Math.round(body.maxConfessionLength)));
    }
    if (typeof body.dailySubmissionLimit === "number") {
      patch.dailySubmissionLimit = Math.min(50, Math.max(1, Math.round(body.dailySubmissionLimit)));
    }
    if (typeof body.announcement === "string") {
      patch.announcement = sanitizeText(body.announcement, 280);
    }

    const next = await updateAdminSettings(patch);
    await writeAudit(actor.uid, "updateSettings", "settings/general", patch);
    await touchAdmin();
    return Response.json({ ok: true, settings: next });
  } catch (err) {
    return errorResponse(err);
  }
}
