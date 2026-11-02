import { getAdminSettings } from "@/lib/firebase/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public banner info: maintenance mode + announcement. Read-only. */
export async function GET(): Promise<Response> {
  try {
    const settings = await getAdminSettings();
    return Response.json({
      maintenanceMode: settings.maintenanceMode,
      announcement: settings.announcement,
      allowComments: settings.allowComments,
    });
  } catch {
    return Response.json({
      maintenanceMode: false,
      announcement: "",
      allowComments: true,
    });
  }
}
