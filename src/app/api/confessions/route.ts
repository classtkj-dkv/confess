import type { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  ApiError,
  assertNotBlocked,
  ensureUserDoc,
  errorResponse,
  requireUid,
} from "@/lib/security/apiHelpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { isCategoryId } from "@/lib/categories";
import { sanitizeText } from "@/lib/security/sanitize";
import { validateConfessionInput } from "@/lib/validations";
import { getAdminSettings } from "@/lib/firebase/settings";

const CONFESSION_MAX_LENGTH = 1000;
const RECENT_WINDOW_MS = 30 * 60 * 1000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const uid = await requireUid(req);
    await assertNotBlocked(uid);
    await ensureUserDoc(uid);

    const settings = await getAdminSettings();
    if (settings.maintenanceMode) {
      throw new ApiError(
        503,
        "CONFESS sedang dalam mode perawatan. Coba lagi nanti.",
        "maintenance"
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

    const db = getAdminDb();

    // Rate limit: max 5 confessions per UID per day.
    const rl = await checkRateLimit({
      scope: "confession",
      uid,
      limit: RATE_LIMITS.confessionPerDay.limit,
      windowMs: RATE_LIMITS.confessionPerDay.windowMs,
    });
    if (!rl.allowed) {
      throw new ApiError(
        429,
        "Batas 5 confession per hari sudah tercapai. Coba lagi besok.",
        "rate-limited"
      );
    }

    // Duplicate submission protection within 30 minutes.
    const dupCheck = db
      .collection("confessions")
      .where("authorUid", "==", uid)
      .where("createdAt", ">", Date.now() - RECENT_WINDOW_MS)
      .limit(20);
    const dup = await dupCheck.get();
    if (!dup.empty) {
      const lower = message.toLowerCase().replace(/\s+/g, " ");
      for (const d of dup.docs) {
        const prev = String(d.data()?.messageLower ?? "");
        if (prev === lower) {
          throw new ApiError(409, "Confession yang sama baru saja kamu kirim.", "duplicate");
        }
      }
    }

    // Re-check: FINAL sanity trim + length enforcement
    const finalMessage = sanitizeText(message, CONFESSION_MAX_LENGTH);
    if (Array.from(finalMessage).length < 10) {
      throw new ApiError(400, "Confession minimal 10 karakter.");
    }

    const ref = db.collection("confessions").doc();
    await ref.set({
      id: ref.id,
      message: finalMessage,
      messageLower: finalMessage.toLowerCase(),
      category,
      authorUid: uid,
      createdAt: Date.now(),
      status: "PENDING",
      likesCount: 0,
      commentsCount: 0,
    });

    return Response.json(
      { ok: true, id: ref.id, status: "PENDING" },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
