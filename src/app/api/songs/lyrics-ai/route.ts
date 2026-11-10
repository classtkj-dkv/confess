import type { NextRequest } from "next/server";
import { ApiError, errorResponse, requireUid } from "@/lib/security/apiHelpers";
import { getTrack } from "@/lib/songs/deezer";
import { findLyrics } from "@/lib/songs/lyrics";
import { fixLyrics, cachedLyricFix } from "@/lib/ai/lyricfix";
import { roleStatus } from "@/lib/ai/openrouter";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * AI musik (tugas terpisah dari AI moderasi, key sendiri dengan rotasi 2–3 key)
 * merapikan & menyusun lirik lagu yang dipilih di form + taksiran titik mulai
 * preview. Dipanggil sekali per lagu; hasilnya di-cache supaya kuota AI musik
 * tidak terkuras.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const uid = await requireUid(req);
    const rl = await checkRateLimit({
      scope: "song-lyric-ai",
      uid,
      ...RATE_LIMITS.songLyricAi,
    });
    if (!rl.allowed) {
      throw new ApiError(429, "Terlalu sering memakai AI untuk lagu. Coba lagi nanti.", "rate-limit");
    }

    const body = (await req.json().catch(() => ({}))) as { id?: unknown };
    const id = String(body.id ?? "");
    if (!/^\d{1,12}$/.test(id)) throw new ApiError(400, "Lagu tidak valid.");

    const status = roleStatus("music");
    if (!status.configured) {
      return Response.json({ skipped: true, reason: "ai-not-configured" });
    }

    const cached = cachedLyricFix(id);
    if (cached) {
      return Response.json({ ...cached, cached: true });
    }

    const track = await getTrack(id);
    if (!track) throw new ApiError(404, "Lagu tidak ditemukan.");
    const found = await findLyrics(track.title, track.artist);
    if (!found || found.synced.length < 4) {
      // Tidak ada lirik sinkron → tidak ada yang bisa dirapikan/ditatap AI.
      return Response.json({ skipped: true, reason: "no-synced-lyrics" });
    }

    const { fix, error } = await fixLyrics(
      id,
      { title: track.title, artist: track.artist, duration: track.duration },
      found.synced
    );
    if (fix) return Response.json({ ...fix, cached: false });
    return Response.json({ skipped: true, reason: error.slice(0, 160) || "ai-failed" });
  } catch (err) {
    return errorResponse(err);
  }
}
