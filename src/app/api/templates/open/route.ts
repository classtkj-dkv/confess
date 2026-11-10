import type { NextRequest } from "next/server";
import { getAdminRtdb } from "@/lib/firebase/admin";
import {
  ApiError,
  assertNotBlocked,
  errorResponse,
  requireUid,
} from "@/lib/security/apiHelpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import {
  CODE_RE,
  LOCK_MS,
  MAX_FAILED_ATTEMPTS,
  TEMPLATE_ID_RE,
  hashCode,
} from "@/lib/security/templateShare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Stored {
  name?: string;
  design?: string;
  bg?: string | null;
  codeHash?: string;
  failCount?: number;
  lockedUntil?: number;
  uses?: number;
}

/** Penerima membuka template dengan link (id) + 4 kode dari pengirim. */
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
    const id = typeof b.id === "string" ? b.id.toLowerCase() : "";
    const code = typeof b.code === "string" ? b.code : "";
    if (!TEMPLATE_ID_RE.test(id)) throw new ApiError(400, "Link template tidak valid.");
    if (!CODE_RE.test(code)) throw new ApiError(400, "Kode harus tepat 4 angka.");

    const rl = await checkRateLimit({
      scope: "tplopen",
      uid,
      limit: RATE_LIMITS.templateOpen.limit,
      windowMs: RATE_LIMITS.templateOpen.windowMs,
    });
    if (!rl.allowed) throw new ApiError(429, "Terlalu banyak percobaan. Coba lagi nanti.");

    const ref = getAdminRtdb().ref(`sharedTemplates/${id}`);
    const snap = await ref.get();
    if (!snap.exists()) throw new ApiError(404, "Template tidak ditemukan atau sudah dihapus.");
    const t = snap.val() as Stored;

    const now = Date.now();
    if (typeof t.lockedUntil === "number" && t.lockedUntil > now) {
      throw new ApiError(429, "Template dikunci sementara karena terlalu banyak kode salah. Coba lagi nanti.");
    }

    if (t.codeHash !== hashCode(id, code)) {
      const failCount = (typeof t.failCount === "number" ? t.failCount : 0) + 1;
      const lock = failCount >= MAX_FAILED_ATTEMPTS;
      await ref.update({
        failCount: lock ? 0 : failCount,
        lockedUntil: lock ? now + LOCK_MS : 0,
      });
      throw new ApiError(403, "Kode salah.", "bad-code");
    }

    await ref.update({
      failCount: 0,
      lockedUntil: 0,
      uses: (typeof t.uses === "number" ? t.uses : 0) + 1,
    });

    let design: unknown = null;
    try {
      design = JSON.parse(String(t.design ?? "null"));
    } catch {
      design = null;
    }
    if (!design) throw new ApiError(500, "Data template rusak.");

    return Response.json({
      ok: true,
      name: String(t.name ?? "Template"),
      design,
      bg: typeof t.bg === "string" ? t.bg : null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
