import type { NextRequest } from "next/server";
import { errorResponse, requireStaff } from "@/lib/security/apiHelpers";
import { updateAdminSettings } from "@/lib/firebase/settings";
import { sanitizeText } from "@/lib/security/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireStaff(req);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return Response.json({ error: "Body tidak valid." }, { status: 400 });
    }

    const body = (raw ?? {}) as Record<string, unknown>;
    const patch: Partial<{
      maintenanceMode: boolean;
      announcement: string;
      allowComments: boolean;
    }> = {};

    if (typeof body.maintenanceMode === "boolean") {
      patch.maintenanceMode = body.maintenanceMode;
    }
    if (typeof body.allowComments === "boolean") {
      patch.allowComments = body.allowComments;
    }
    if (typeof body.announcement === "string") {
      patch.announcement = sanitizeText(body.announcement, 280);
    }

    const next = await updateAdminSettings(patch);
    return Response.json({ ok: true, settings: next });
  } catch (err) {
    return errorResponse(err);
  }
}
