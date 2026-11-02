import type { NextRequest } from "next/server";
import { errorResponse, requireStaff } from "@/lib/security/apiHelpers";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 30;

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireStaff(req);
    const db = getAdminDb();
    const url = new URL(req.url);
    const resource = url.searchParams.get("type") ?? "";
    const status = url.searchParams.get("status") ?? "ALL";
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE)
    );

    if (resource === "comments") {
      let queryRef = db.collection("comments").orderBy("createdAt", "desc");
      if (status === "VISIBLE" || status === "HIDDEN" || status === "PENDING") {
        queryRef = queryRef.where("status", "==", status).orderBy("createdAt", "desc") as typeof queryRef;
      }
      const snap = await queryRef.offset((page - 1) * pageSize).limit(pageSize).get();
      const items = snap.docs.map((d) => toComment(d));
      return Response.json({ items, page, pageSize });
    }

    if (resource === "reports") {
      let queryRef = db.collection("reports").orderBy("createdAt", "desc");
      if (status === "OPEN" || status === "RESOLVED" || status === "DISMISSED") {
        queryRef = queryRef.where("status", "==", status).orderBy("createdAt", "desc") as typeof queryRef;
      }
      const snap = await queryRef.offset((page - 1) * pageSize).limit(pageSize).get();
      const items = snap.docs.map(toReport);
      return Response.json({ items, page, pageSize });
    }

    if (resource === "users") {
      const search = (url.searchParams.get("blocked") ?? "") === "true";
      let queryRef = db.collection("users").orderBy("createdAt", "desc");
      if (search) {
        queryRef = queryRef.where("isBlocked", "==", true).orderBy("createdAt", "desc") as typeof queryRef;
      }
      const snap = await queryRef.offset((page - 1) * pageSize).limit(pageSize).get();
      const items = snap.docs.map((d) => ({
        uid: d.id,
        role: String((d.data() as Record<string, unknown>).role ?? "user"),
        isBlocked: (d.data() as Record<string, unknown>).isBlocked === true,
        createdAt:
          typeof d.data().createdAt === "number"
            ? d.data().createdAt
            : Date.now(),
      }));
      return Response.json({ items, page, pageSize });
    }

    return Response.json({ error: "Endpoint tidak ditemukan." }, { status: 404 });
  } catch (err) {
    return errorResponse(err);
  }
}

function toComment(d: { id: string; data: () => Record<string, unknown> }) {
  const data = d.data();
  const created = data.createdAt as { toMillis?: () => number } | number;
  return {
    id: d.id,
    confessionId: String(data.confessionId ?? ""),
    message: String(data.message ?? ""),
    status: String(data.status ?? "VISIBLE"),
    createdAt: typeof created === "number" ? created : created?.toMillis?.() ?? 0,
  };
}

function toReport(d: { id: string; data: () => Record<string, unknown> }) {
  const data = d.data();
  const created = data.createdAt as { toMillis?: () => number } | number;
  return {
    id: d.id,
    confessionId: String(data.confessionId ?? ""),
    reason: String(data.reason ?? ""),
    detail: String(data.detail ?? ""),
    status: String(data.status ?? "OPEN"),
    createdAt: typeof created === "number" ? created : created?.toMillis?.() ?? 0,
  };
}
