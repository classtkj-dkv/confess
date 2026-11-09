import type { NextRequest } from "next/server";
import { ApiError, errorResponse, requireUid } from "@/lib/security/apiHelpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { getAdminSettings } from "@/lib/firebase/settings";
import { searchTracks } from "@/lib/songs/deezer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const uid = await requireUid(req);
    const settings = await getAdminSettings();
    if (!settings.allowSongs) throw new ApiError(403, "Fitur lagu sedang dinonaktifkan.");

    const q = (req.nextUrl.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (q.length < 2) return Response.json({ tracks: [] });

    const rl = await checkRateLimit({
      scope: "songsearch",
      uid,
      limit: RATE_LIMITS.songSearch.limit,
      windowMs: RATE_LIMITS.songSearch.windowMs,
    });
    if (!rl.allowed) throw new ApiError(429, "Terlalu sering mencari lagu. Coba lagi sebentar.");

    return Response.json({ tracks: await searchTracks(q) });
  } catch (err) {
    return errorResponse(err);
  }
}
