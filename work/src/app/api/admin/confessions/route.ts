import type { NextRequest } from "next/server";
import { errorResponse, requireStaff } from "@/lib/security/apiHelpers";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { isCategoryId } from "@/lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;

/** Hanya field lagu yang dibutuhkan pemutar preview. */
function pickSong(v: unknown): { id: string; title: string; artist: string; cover: string } | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  if (typeof s.id !== "string" || !s.id) return null;
  return {
    id: s.id,
    title: String(s.title ?? ""),
    artist: String(s.artist ?? ""),
    cover: typeof s.cover === "string" ? s.cover : "",
  };
}

/**
 * Daftar confession untuk moderasi. Hanya proyeksi AMAN —
 * authorUid tidak pernah dikirim ke klien.
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireStaff(req);
    const db = getAdminRtdb();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "ALL";
    const category = url.searchParams.get("category") ?? "";
    const pageSize = Math.min(
      50,
      Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE)
    );
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

    const hasStatus =
      status === "PENDING" || status === "PUBLISHED" || status === "REJECTED";
    const hasCategory = isCategoryId(category);
    const ref = db.ref("confessions");

    // Satu orderBy saja di RTDB: pilih yang paling selektif, sisanya difilter di memori.
    const snap = hasStatus
      ? await ref.orderByChild("status").equalTo(status).get()
      : hasCategory
        ? await ref.orderByChild("category").equalTo(category).get()
        : await ref.orderByChild("createdAt").limitToLast(page * pageSize).get();

    const rows: Array<Record<string, unknown>> = [];
    snap.forEach((c) => {
      rows.push({ id: c.key, ...(c.val() as Record<string, unknown>) });
    });
    const filtered = rows
      .filter((r) => (hasStatus && hasCategory ? r.category === category : true))
      .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));

    const items = filtered
      .slice((page - 1) * pageSize, page * pageSize)
      .map((data) => ({
        id: String(data.id),
        message: String(data.message ?? ""),
        category: String(data.category ?? "random"),
        createdAt: Number(data.createdAt ?? 0),
        status: String(data.status ?? "PENDING"),
        likesCount: Number(data.likesCount ?? 0),
        commentsCount: Number(data.commentsCount ?? 0),
        fromName: typeof data.fromName === "string" ? data.fromName : "",
        toName: typeof data.toName === "string" ? data.toName : "",
        song: pickSong(data.song),
        songLyric: typeof data.songLyric === "string" ? data.songLyric : "",
        // Catatan jaringan untuk anti-spam (staff-only endpoint).
        ip: typeof data.ip === "string" ? data.ip : "",
        ai:
          data.moderation && (data.moderation as Record<string, unknown>).by === "ai"
            ? String((data.moderation as Record<string, unknown>).verdict ?? "")
            : "",
      }));

    return Response.json({ items, page, pageSize });
  } catch (err) {
    return errorResponse(err);
  }
}
