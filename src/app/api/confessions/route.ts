import type { NextRequest } from "next/server";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { touchAdmin, writeActivity } from "@/lib/security/audit";
import {
  ApiError,
  assertNotBlocked,
  errorResponse,
  requireUid,
} from "@/lib/security/apiHelpers";
import { checkRateLimit, peekRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { aiApprovalsPerHour, isAiConfigured, moderateWithAI } from "@/lib/ai/moderate";
import { publicConfessionOf } from "@/lib/firebase/publicData";
import { isCategoryId } from "@/lib/categories";
import { sanitizeText } from "@/lib/security/sanitize";
import { validateConfessionInput } from "@/lib/validations";
import { getTrack } from "@/lib/songs/deezer";
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

    const { message, category, fromName, toName, songId, songLyric } =
      validateConfessionInput(raw);

    if (!isCategoryId(category)) {
      throw new ApiError(400, "Kategori tidak valid.");
    }

    // Spam heuristics: reject 3+ URLs and emoji-only walls.
    const urlMatches = message.match(/https?:\/\/\S+/gi);
    if (urlMatches && urlMatches.length >= 3) {
      throw new ApiError(400, "Terlalu banyak tautan; tulis tanpa tautan ya.");
    }
    if (!/[\p{L}\p{N}]/u.test(message)) {
      throw new ApiError(400, "Isi confession dengan huruf atau angka.");
    }

    const db = getAdminRtdb();
    const maxLen = settings.maxConfessionLength;
    if (Array.from(message).length > maxLen) {
      throw new ApiError(400, `Confession maksimal ${maxLen.toLocaleString("id-ID")} karakter.`);
    }

    // Lagu (opsional): data kanonik diambil ulang dari Deezer, klien tidak dipercaya.
    let song: { id: string; title: string; artist: string; cover: string } | null = null;
    if (songId) {
      if (!settings.allowSongs) throw new ApiError(403, "Fitur lagu sedang dinonaktifkan.");
      const track = await getTrack(songId);
      if (!track) throw new ApiError(400, "Lagu tidak ditemukan. Pilih lagu lain.");
      song = { id: track.id, title: track.title, artist: track.artist, cover: track.cover };
    }

    // Duplicate submission protection within 30 minutes.
    const dup = await db
      .ref("confessions")
      .orderByChild("authorUid")
      .equalTo(uid)
      .limitToLast(20)
      .get();
    if (dup.exists()) {
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const lower = norm(message);
      const since = Date.now() - RECENT_WINDOW_MS;
      let dupFound = false;
      dup.forEach((d) => {
        const v = d.val() as Record<string, unknown>;
        if (Number(v.createdAt ?? 0) > since && norm(String(v.message ?? v.messageLower ?? "")) === lower) {
          dupFound = true;
        }
      });
      if (dupFound) {
        throw new ApiError(409, "Confession yang sama baru saja kamu kirim.", "duplicate");
      }
    }

    const dailyCfg = {
      scope: "confession",
      uid,
      limit: settings.dailySubmissionLimit,
      windowMs: RATE_LIMITS.confessionPerDay.windowMs,
    };
    const dailyError = new ApiError(
      429,
      `Batas ${settings.dailySubmissionLimit} confession per hari sudah tercapai. Coba lagi besok.`,
      "rate-limited"
    );
    // Cek dulu tanpa mengurangi kuota: yang sudah habis tidak boleh memakai AI.
    if (!(await peekRateLimit(dailyCfg))) throw dailyError;

    // ── Moderasi AI (opsional). Gagal/penuh → otomatis moderasi manual. ──
    let status: "PENDING" | "PUBLISHED" = "PENDING";
    let moderation: Record<string, unknown> | null = null;
    if (settings.aiModeration && isAiConfigured()) {
      const aiCheck = await checkRateLimit({
        scope: "aicheck",
        uid,
        limit: RATE_LIMITS.aiCheckPerHour.limit,
        windowMs: RATE_LIMITS.aiCheckPerHour.windowMs,
      });
      const approveCfg = {
        scope: "aiapprove",
        uid: "global",
        limit: aiApprovalsPerHour(),
        windowMs: 60 * 60 * 1000,
      };
      if (aiCheck.allowed && (await peekRateLimit(approveCfg))) {
        const ai = await moderateWithAI({
          message,
          fromName,
          toName,
          songLabel: song ? `${song.title} - ${song.artist}` : "",
          lyric: song ? songLyric : "",
        });
        if (ai?.verdict === "revise") {
          throw new ApiError(422, ai.feedback, "needs-revision");
        }
        if (ai?.verdict === "approve") {
          // Kuota persetujuan AI global (per jam) baru dikurangi saat benar-benar menyetujui.
          const slot = await checkRateLimit(approveCfg);
          if (slot.allowed) {
            status = "PUBLISHED";
            moderation = { by: "ai", verdict: "approve", model: ai.model, at: Date.now() };
          }
        } else if (ai) {
          moderation = { by: "ai", verdict: "manual", model: ai.model, at: Date.now() };
        }
      }
    }

    // Kuota harian hanya berkurang untuk kiriman yang benar-benar tersimpan.
    const rl = await checkRateLimit(dailyCfg);
    if (!rl.allowed) throw dailyError;

    // Re-check: FINAL sanity trim + length enforcement
    const finalMessage = sanitizeText(message, maxLen);
    if (!/[\p{L}\p{N}]/u.test(finalMessage)) {
      throw new ApiError(400, "Confession tidak boleh kosong.");
    }

    const ref = db.ref("confessions").push();
    const id = String(ref.key);
    const now = Date.now();
    const record: Record<string, unknown> = {
      id,
      message: finalMessage,
      messageLower: finalMessage.toLowerCase(),
      category,
      ...(fromName ? { fromName } : {}),
      ...(toName ? { toName } : {}),
      ...(song ? { song, ...(songLyric ? { songLyric } : {}) } : {}),
      ...(moderation ? { moderation } : {}),
      authorUid: uid,
      createdAt: now,
      updatedAt: now,
      status,
      likesCount: 0,
      commentsCount: 0,
    };
    if (status === "PUBLISHED") {
      await db.ref().update({
        [`confessions/${id}`]: record,
        [`public/confessions/${id}`]: publicConfessionOf(id, record),
      });
    } else {
      await ref.set(record);
    }
    await touchAdmin();
    await writeActivity(uid, "confession_submitted", id, {
      category,
      status,
      ai: moderation ? String(moderation.verdict) : "none",
    });

    return Response.json(
      { ok: true, id, status },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
