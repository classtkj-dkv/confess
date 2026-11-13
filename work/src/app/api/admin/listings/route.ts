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
      )
        // Akun anonim tetap tercatat di RTDB, tetapi daftar admin hanya akun terdaftar.
        .filter(([, d]) => Boolean(d?.email))
        .map(([uid, d]) => ({
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

    if (resource === "ips") {
      await requireAdmin(req);
      const snap = await getAdminRtdb().ref("ip_logs").get();
      const all = Object.entries(
        (snap.val() ?? {}) as Record<string, Record<string, unknown>>
      ).map(([key, d]) => ({
        id: key,
        ip: String(d?.ip ?? ""),
        firstSeen: typeof d?.firstSeen === "number" ? d.firstSeen : 0,
        lastSeen: typeof d?.lastSeen === "number" ? d.lastSeen : 0,
        confessions: Number(d?.confessions ?? 0),
        comments: Number(d?.comments ?? 0),
        blocked: d?.blocked === true,
        flagged: d?.flagged === true,
        uidCount: d?.uids && typeof d.uids === "object" ? Object.keys(d.uids).length : 0,
      }));
      const items = all
        .sort((x, y) => y.lastSeen - x.lastSeen)
        .slice((page - 1) * pageSize, page * pageSize);
      return Response.json({ items, page, pageSize });
    }

    if (resource === "audit") {
      await requireAdmin(req);
      const source = url.searchParams.get("source") === "activity" ? "activity_logs" : "audit_logs";
      const rows = await fetchRows(source, "timestamp", null, page, pageSize);
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
