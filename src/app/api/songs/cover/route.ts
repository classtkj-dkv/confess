import type { NextRequest } from "next/server";
import { ApiError, errorResponse } from "@/lib/security/apiHelpers";
import { getTrack } from "@/lib/songs/deezer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchImage(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

/**
 * Cover album dari domain kita sendiri. Gambar Deezer tidak mengirim header CORS,
 * sehingga kanvas (untuk unduh kartu) akan "tercemar" bila memuatnya langsung.
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const id = req.nextUrl.searchParams.get("id") ?? "";
    if (!/^\d{1,12}$/.test(id)) throw new ApiError(400, "Lagu tidak valid.");
    const track = await getTrack(id);
    if (!track?.cover) throw new ApiError(404, "Cover tidak tersedia.");

    // Coba resolusi lebih tinggi dulu; bila gagal pakai ukuran asli.
    const res =
      (await fetchImage(track.cover.replace("250x250", "500x500"))) ??
      (await fetchImage(track.cover));
    if (!res) throw new ApiError(502, "Cover tidak bisa dimuat.");

    return new Response(await res.arrayBuffer(), {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
