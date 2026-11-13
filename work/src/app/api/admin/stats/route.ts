import type { NextRequest } from "next/server";
import { errorResponse, requireStaff } from "@/lib/security/apiHelpers";
import { getAdminRtdb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireStaff(req);
    const db = getAdminRtdb();
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const byStatus = (path: string, status: string) =>
      db.ref(path).orderByChild("status").equalTo(status).get();

    const [pending, published, rejected, comments, openReports, users, recent] =
      await Promise.all([
        byStatus("confessions", "PENDING"),
        byStatus("confessions", "PUBLISHED"),
        byStatus("confessions", "REJECTED"),
        db.ref("comments").get(),
        byStatus("reports", "OPEN"),
        db.ref("users").get(),
        db.ref("confessions").orderByChild("createdAt").startAt(since).get(),
      ]);

    const stats = {
      totalConfessions:
        pending.numChildren() + published.numChildren() + rejected.numChildren(),
      pendingConfessions: pending.numChildren(),
      publishedConfessions: published.numChildren(),
      rejectedConfessions: rejected.numChildren(),
      totalComments: comments.numChildren(),
      openReports: openReports.numChildren(),
      totalUsers: Object.values(
        (users.val() ?? {}) as Record<string, Record<string, unknown>>
      ).filter((u) => Boolean(u?.email)).length,
      last7DaysConfessions: recent.numChildren(),
    };

    // Snapshot ringkas agar bisa dilihat langsung di Console (stats/).
    await db.ref("stats").set({
      totalUsers: stats.totalUsers,
      totalConfessions: stats.totalConfessions,
      pendingConfessions: stats.pendingConfessions,
      publishedConfessions: stats.publishedConfessions,
      totalComments: stats.totalComments,
      totalReports: stats.openReports,
      updatedAt: Date.now(),
    });

    return Response.json(stats);
  } catch (err) {
    return errorResponse(err);
  }
}
