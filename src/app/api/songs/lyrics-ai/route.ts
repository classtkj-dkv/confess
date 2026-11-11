import type { NextRequest } from "next/server";
import { ApiError, errorResponse, requireUid } from "@/lib/security/apiHelpers";
import { getTrack } from "@/lib/songs/deezer";
import { findLyrics } from "@/lib/songs/lyrics";
import { fixLyrics, cachedLyricFix } from "@/lib/ai/lyricfix";
import { cachedSongSafety, checkSongSafety } from "@/lib/ai/songcheck";
import { roleStatus } from "@/lib/ai/openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Dipanggil sekali per lagu saat lagu dipilih di form. AI musik (key sendiri,
 * rotasi hingga 5 key OpenRouter) mengerjakan dua tugas:
 *   1. Merapikan & menyusun lirik + taksiran titik mulai preview (lirik susun).
 *   2. Memeriksa keamanan lagu (eksplisit Deezer + lirik lintas platform + AI).
 * Hasil keduanya di-cache supaya pemakaian API key tetap hemat.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireUid(req);

    const body = (await req.json().catch(() => ({}))) as { id?: unknown };
    const id = String(body.id ?? "");
    if (!/^\d{1,12}$/.test(id)) throw new ApiError(400, "Lagu tidak valid.");

    const status = roleStatus("music");
    if (!status.configured) {
      return Response.json({ skipped: true, reason: "ai-not-configured", safety: cachedSongSafety(id) });
    }

    const cached = cachedLyricFix(id);
    if (cached) {
      return Response.json({ ...cached, cached: true, safety: cachedSongSafety(id) });
    }

    const track = await getTrack(id);
    if (!track) throw new ApiError(404, "Lagu tidak ditemukan.");

    // Keamanan lagu dicek lebih dulu — kalau berbahaya, lirik tidak perlu disusun.
    const safety = await checkSongSafety({
      id: track.id,
      title: track.title,
      artist: track.artist,
      explicit: track.explicit,
    });

    const found = await findLyrics(track.title, track.artist);
    if (!found || found.synced.length < 4) {
      // Tidak ada lirik sinkron → tidak ada yang bisa dirapikan/ditatap AI.
      return Response.json({ skipped: true, reason: "no-synced-lyrics", safety });
    }

    const { fix, error } = await fixLyrics(
      id,
      { title: track.title, artist: track.artist, duration: track.duration },
      found.synced
    );
    if (fix) return Response.json({ ...fix, cached: false, safety });
    return Response.json({ skipped: true, reason: error.slice(0, 160) || "ai-failed", safety });
  } catch (err) {
    return errorResponse(err);
  }
}
