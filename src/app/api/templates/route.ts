import type { NextRequest } from "next/server";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { writeActivity } from "@/lib/security/audit";
import {
  ApiError,
  assertNotBlocked,
  errorResponse,
  requireUid,
} from "@/lib/security/apiHelpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import {
  CODE_RE,
  MAX_BG_CHARS,
  MAX_DESIGN_BYTES,
  hashCode,
  newTemplateId,
  randomCode,
} from "@/lib/security/templateShare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pengirim membagikan template: server menyimpan & mengembalikan id + kode 4 digit. */
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
    const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

    const name = typeof b.name === "string" ? Array.from(b.name).slice(0, 30).join("").trim() : "";
    if (!name) throw new ApiError(400, "Nama template wajib diisi.");

    if (!b.design || typeof b.design !== "object" || Array.isArray(b.design)) {
      throw new ApiError(400, "Data template tidak valid.");
    }
    const designJson = JSON.stringify(b.design);
    if (designJson.length > MAX_DESIGN_BYTES) {
      throw new ApiError(413, "Template terlalu besar.");
    }

    let bg: string | null = null;
    if (b.bg !== null && b.bg !== undefined) {
      if (
        typeof b.bg !== "string" ||
        b.bg.length > MAX_BG_CHARS ||
        !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.bg)
      ) {
        throw new ApiError(400, "Gambar latar template tidak valid atau terlalu besar.");
      }
      bg = b.bg;
    }

    let code: string;
    if (b.code === undefined || b.code === null || b.code === "") {
      code = randomCode();
    } else if (typeof b.code === "string" && CODE_RE.test(b.code)) {
      code = b.code;
    } else {
      throw new ApiError(400, "Kode harus tepat 4 angka.");
    }

    const rl = await checkRateLimit({
      scope: "tplshare",
      uid,
      limit: RATE_LIMITS.templateShare.limit,
      windowMs: RATE_LIMITS.templateShare.windowMs,
    });
    if (!rl.allowed) throw new ApiError(429, "Batas berbagi template harian tercapai.");

    const id = newTemplateId();
    await getAdminRtdb().ref(`sharedTemplates/${id}`).set({
      id,
      name,
      design: designJson,
      bg,
      codeHash: hashCode(id, code),
      ownerUid: uid,
      createdAt: Date.now(),
      uses: 0,
      failCount: 0,
      lockedUntil: 0,
    });
    await writeActivity(uid, "template_shared", id);

    return Response.json({ ok: true, id, code }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
