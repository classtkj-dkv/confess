import type { NextRequest } from "next/server";
import {
  errorResponse,
  requireAdmin,
  requireStaff,
} from "@/lib/security/apiHelpers";
import { getAdminRtdb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 30;

type Row = Record<string, unknown> & { id: string };

async function fetchRows(
  path: string,
  orderField: string,
  status: string | null,
  page: number,
  pageSize: number
): Promise<Row[]> {
  const ref = getAdminRtdb().ref(path);
  const snap = status
    ? await ref.orderByChild("status").equalTo(status).get()
    : await ref.orderByChild(orderField).limitToLast(page * pageSize).get();
  const rows: Row[] = [];
  snap.forEach((c) => {
    rows.push({ id: String(c.key), ...(c.val() as Record<string, unknown>) });
  });
  rows.sort((a, b) => Number(b[orderField] ?? 0) - Number(a[orderField] ?? 0));
  return rows.slice((page - 1) * pageSize, page * pageSize);
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const resource = url.searchParams.get("type") ?? "";
    const status = url.searchParams.get("status") ?? "ALL";
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE)
    );

    if (resource === "comments") {
      await requireStaff(req);
      const filter =
        status === "VISIBLE" || status === "HIDDEN" || status === "PENDING"
          ? status
          : null;
      const rows = await fetchRows("comments", "createdAt", filter, page, pageSize);
      const items = rows.map((d) => ({
        id: d.id,
        confessionId: String(d.confessionId ?? ""),
        message: String(d.message ?? ""),
        status: String(d.status ?? "VISIBLE"),
        createdAt: Number(d.createdAt ?? 0),
      }));
      return Response.json({ items, page, pageSize });
    }

    if (resource === "reports") {
      await requireStaff(req);
      const filter =
        status === "OPEN" || status === "RESOLVED" || status === "DISMISSED"
          ? status
          : null;
      const rows = await fetchRows("reports", "createdAt", filter, page, pageSize);
      const items = rows.map((d) => ({
        id: d.id,
        confessionId: String(d.confessionId ?? ""),
        reason: String(d.reason ?? ""),
        detail: String(d.detail ?? ""),
        status: String(d.status ?? "OPEN"),
        createdAt: Number(d.createdAt ?? 0),
      }));
      return Response.json({ items, page, pageSize });
    }

    if (resource === "users") {
      await requireAdmin(req);
      const onlyBlocked = (url.searchParams.get("blocked") ?? "") === "true";
      const snap = await getAdminRtdb().ref("users").get();
      const all = Object.entries(
        (snap.val() ?? {}) as Record<string, Record<string, unknown>>
      ).map(([uid, d]) => ({
        uid,
        email: String(d?.email ?? ""),
        displayName: String(d?.displayName ?? ""),
        role: String(d?.role ?? "user"),
        isBlocked: d?.isBlocked === true,
        createdAt: typeof d?.createdAt === "number" ? d.createdAt : 0,
      }));
      const list = (onlyBlocked ? all.filter((u) => u.isBlocked) : all).sort(
        (x, y) => y.createdAt - x.createdAt
      );
      const items = list.slice((page - 1) * pageSize, page * pageSize);
      return Response.json({ items, page, pageSize });
    }

    if (resource === "audit") {
      await requireAdmin(req);
      const rows = await fetchRows("audit_logs", "timestamp", null, page, pageSize);
      const items = rows.map((d) => ({
        id: d.id,
        actorUid: String(d.actorUid ?? ""),
        action: String(d.action ?? ""),
        target: String(d.target ?? ""),
        timestamp: Number(d.timestamp ?? 0),
      }));
      return Response.json({ items, page, pageSize });
    }

    return Response.json({ error: "Endpoint tidak ditemukan." }, { status: 404 });
  } catch (err) {
    return errorResponse(err);
  }
}
