import type { NextRequest } from "next/server";
import { errorResponse, requireStaff } from "@/lib/security/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireStaff(req);
    const { getAdminDb } = await import("@/lib/firebase/admin");
    const db = getAdminDb();
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const [totalConf, pending, published, rejected, totalComments, openReports, users, recentConf] =
      await Promise.all([
        db.collection("confessions").count().get(),
        db.collection("confessions").where("status", "==", "PENDING").count().get(),
        db.collection("confessions").where("status", "==", "PUBLISHED").count().get(),
        db.collection("confessions").where("status", "==", "REJECTED").count().get(),
        db.collection("comments").count().get(),
        db.collection("reports").where("status", "==", "OPEN").count().get(),
        db.collection("users").count().get(),
        db.collection("confessions").where("createdAt", ">", since).count().get(),
      ]);

    return Response.json({
      totalConfessions: totalConf.data().count,
      pendingConfessions: pending.data().count,
      publishedConfessions: published.data().count,
      rejectedConfessions: rejected.data().count,
      totalComments: totalComments.data().count,
      openReports: openReports.data().count,
      totalUsers: users.data().count,
      last7DaysConfessions: recentConf.data().count,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
