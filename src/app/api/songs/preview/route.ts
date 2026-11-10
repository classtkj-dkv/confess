import type { NextRequest } from "next/server";
import { ApiError, errorResponse } from "@/lib/security/apiHelpers";
import { getTrack } from "@/lib/songs/deezer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy audio preview 30 detik. Dibuat same-origin supaya browser boleh membaca
 * data audionya (Web Audio) untuk gelombang yang mengikuti musik. Mendukung Range
 * supaya geser posisi lagu tetap jalan.
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const id = req.nextUrl.searchParams.get("id") ?? "";
    if (!/^\d{1,12}$/.test(id)) throw new ApiError(400, "Lagu tidak valid.");
    const track = await getTrack(id);
    if (!track?.preview) throw new ApiError(404, "Preview tidak tersedia.");

    const up = await fetch(track.preview, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!up.ok) throw new ApiError(502, "Preview tidak bisa dimuat.");
    const buf = new Uint8Array(await up.arrayBuffer());
    const total = buf.byteLength;
    const type = up.headers.get("content-type") || "audio/mpeg";
    const base = {
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=600",
    };

    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : total - Number(m[2]);
      let end = m[1] && m[2] ? Number(m[2]) : total - 1;
      start = Math.max(0, start);
      end = Math.min(total - 1, end);
      if (start > end || start >= total) {
        return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${total}` } });
      }
      return new Response(buf.slice(start, end + 1), {
        status: 206,
        headers: {
          ...base,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
    return new Response(buf, { status: 200, headers: { ...base, "Content-Length": String(total) } });
  } catch (err) {
    return errorResponse(err);
  }
}
