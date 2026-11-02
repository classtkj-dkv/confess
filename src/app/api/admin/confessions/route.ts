import type { NextRequest } from "next/server";
import { errorResponse, requireStaff } from "@/lib/security/apiHelpers";
import { getAdminDb } from "@/lib/firebase/admin";
import { isCategoryId } from "@/lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 20;

/**
 * Lists confessions for moderation. Returns SAFE projections only —
 * authorUid is never echoed to the client.
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireStaff(req);
    const db = getAdminDb();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "ALL";
    const category = url.searchParams.get("category") ?? "";
    const pageSize = Math.min(
      50,
      Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE)
    );
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

    const base = db.collection("confessions");
    let queryRef = base.orderBy("createdAt", "desc");

    if (status === "PENDING" || status === "PUBLISHED" || status === "REJECTED") {
      queryRef = db.collection("confessions").where("status", "==", status).orderBy("createdAt", "desc");
    }
    if (isCategoryId(category)) {
      queryRef = queryRef.where("category", "==", category);
    }

    const snap = await queryRef
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const items = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const created = data.createdAt as { toMillis?: () => number } | number;
      return {
        id: d.id,
        message: String(data.message ?? ""),
        category: String(data.category ?? "random"),
        createdAt:
          typeof created === "number"
            ? created
            : created?.toMillis?.() ?? 0,
        status: String(data.status ?? "PENDING"),
        likesCount: Number(data.likesCount ?? 0),
        commentsCount: Number(data.commentsCount ?? 0),
      };
    });

    return Response.json({ items, page, pageSize });
  } catch (err) {
    return errorResponse(err);
  }
}
