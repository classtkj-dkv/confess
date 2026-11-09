import type { NextRequest } from "next/server";
import { ApiError, errorResponse } from "@/lib/security/apiHelpers";
import { getTrack } from "@/lib/songs/deezer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Preview 30 detik segar (URL dari Deezer kedaluwarsa). Publik, read-only. */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const id = req.nextUrl.searchParams.get("id") ?? "";
    if (!/^\d{1,12}$/.test(id)) throw new ApiError(400, "Lagu tidak valid.");
    const track = await getTrack(id);
    if (!track) throw new ApiError(404, "Lagu tidak ditemukan.");
    return Response.json({ preview: track.preview });
  } catch (err) {
    return errorResponse(err);
  }
}
