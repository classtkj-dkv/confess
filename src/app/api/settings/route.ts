import { getAdminSettings, DEFAULT_SETTINGS } from "@/lib/firebase/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Info publik (fallback non-realtime): maintenance + pengumuman. Read-only. */
export async function GET(): Promise<Response> {
  try {
    const s = await getAdminSettings();
    return Response.json({
      maintenanceMode: s.maintenanceMode,
      announcement: s.announcement,
      allowComments: s.allowComments,
      allowConfessions: s.allowConfessions,
      allowSongs: s.allowSongs,
      websiteName: s.websiteName,
    });
  } catch {
    return Response.json({
      maintenanceMode: DEFAULT_SETTINGS.maintenanceMode,
      announcement: "",
      allowComments: true,
      allowConfessions: true,
      allowSongs: true,
      websiteName: DEFAULT_SETTINGS.websiteName,
    });
  }
}
