import type { NextRequest } from "next/server";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { touchAdmin } from "@/lib/security/audit";
import {
  ApiError,
  assertNotBlocked,
  errorResponse,
  requireUid,
} from "@/lib/security/apiHelpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { isCategoryId } from "@/lib/categories";
import { sanitizeText } from "@/lib/security/sanitize";
import { validateConfessionInput } from "@/lib/validations";
import { getAdminSettings } from "@/lib/firebase/settings";

const RECENT_WINDOW_MS = 30 * 60 * 1000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const uid = await requireUid(req);
    await assertNotBlocked(uid);

    const settings = await getAdminSettings();
    if (settings.maintenanceMode) {
      throw new ApiError(
        503,
        "CONFESS sedang dalam mode perawatan. Coba lagi nanti.",
        "maintenance"
      );
    }
    if (!settings.allowConfessions) {
      throw new ApiError(
        503,
        "Pengiriman confession sedang dinonaktifkan admin.",
        "confessions-disabled"
      );
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new ApiError(400, "Body JSON tidak valid.");
    }

    const { message, category } = validateConfessionInput(raw);

    if (!isCategoryId(category)) {
      throw new ApiError(400, "Kategori tidak valid.");
    }

    // Spam heuristics: reject 3+ URLs and emoji-only walls.
    const urlMatches = message.match(/https?:\/\/\S+/gi);
    if (urlMatches && urlMatches.length >= 3) {
      throw new ApiError(400, "Terlalu banyak tautan; tulis tanpa tautan ya.");
    }
    const letters = message.replace(/[^a-zA-Z\u00C0-\u024F]/g, "");
    if (letters.length < 8) {
      throw new ApiError(400, "Confession harus memuat kesan bermakna, bukan simbol saja.");
    }

    const db = getAdminRtdb();
    const maxLen = settings.maxConfessionLength;
    if (Array.from(message).length > maxLen) {
      throw new ApiError(400, `Confession maksimal ${maxLen.toLocaleString("id-ID")} karakter.`);
    }

    // Rate limit: dailySubmissionLimit confession per UID per hari.
    const rl = await checkRateLimit({
      scope: "confession",
      uid,
      limit: settings.dailySubmissionLimit,
      windowMs: RATE_LIMITS.confessionPerDay.windowMs,
    });
    if (!rl.allowed) {
      throw new ApiError(
        429,
        `Batas ${settings.dailySubmissionLimit} confession per hari sudah tercapai. Coba lagi besok.`,
        "rate-limited"
      );
    }

    // Duplicate submission protection within 30 minutes.
    const dup = await db
      .ref("confessions")
      .orderByChild("authorUid")
      .equalTo(uid)
      .limitToLast(20)
      .get();
    if (dup.exists()) {
      const lower = message.toLowerCase().replace(/\s+/g, " ");
      const since = Date.now() - RECENT_WINDOW_MS;
      let dupFound = false;
      dup.forEach((d) => {
        const v = d.val() as Record<string, unknown>;
        if (Number(v.createdAt ?? 0) > since && String(v.messageLower ?? "") === lower) {
          dupFound = true;
        }
      });
      if (dupFound) {
        throw new ApiError(409, "Confession yang sama baru saja kamu kirim.", "duplicate");
      }
    }

    // Re-check: FINAL sanity trim + length enforcement
    const finalMessage = sanitizeText(message, maxLen);
    if (Array.from(finalMessage).length < 10) {
      throw new ApiError(400, "Confession minimal 10 karakter.");
    }

    const ref = db.ref("confessions").push();
    const now = Date.now();
    await ref.set({
      id: ref.key,
      message: finalMessage,
      messageLower: finalMessage.toLowerCase(),
      category,
      authorUid: uid,
      createdAt: now,
      updatedAt: now,
      status: "PENDING",
      likesCount: 0,
      commentsCount: 0,
    });
    await touchAdmin();

    return Response.json(
      { ok: true, id: ref.key, status: "PENDING" },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
