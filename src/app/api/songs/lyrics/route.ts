import type { NextRequest } from "next/server";
import { ApiError, errorResponse } from "@/lib/security/apiHelpers";
import { getTrack } from "@/lib/songs/deezer";
import { findLyrics } from "@/lib/songs/lyrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Saran lirik otomatis untuk lagu Deezer. Publik, read-only. */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const id = req.nextUrl.searchParams.get("id") ?? "";
    if (!/^\d{1,12}$/.test(id)) throw new ApiError(400, "Lagu tidak valid.");
    const track = await getTrack(id);
    if (!track) throw new ApiError(404, "Lagu tidak ditemukan.");
    const found = await findLyrics(track.title, track.artist);
    return Response.json(
      {
        lines: found?.lines ?? [],
        suggestion: found?.suggestion ?? "",
        synced: found?.synced ?? [],
      },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
