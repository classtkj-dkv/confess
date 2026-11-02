import { getAdminDb } from "@/lib/firebase/admin";

export interface AdminSettings {
  maintenanceMode: boolean;
  announcement: string;
  allowComments: boolean;
}

export const DEFAULT_SETTINGS: AdminSettings = {
  maintenanceMode: false,
  announcement: "",
  allowComments: true,
};

const SETTINGS_DOC_PATH = ["settings", "app"] as const;

export async function getAdminSettings(): Promise<AdminSettings> {
  const db = getAdminDb();
  const snap = await db.collection(SETTINGS_DOC_PATH[0]).doc(SETTINGS_DOC_PATH[1]).get();
  if (!snap.exists) return DEFAULT_SETTINGS;
  const data = snap.data() as Partial<AdminSettings> | undefined;
  return {
    maintenanceMode: data?.maintenanceMode === true,
    announcement: typeof data?.announcement === "string" ? data.announcement : "",
    allowComments: data?.allowComments !== false,
  };
}

export async function updateAdminSettings(
  patch: Partial<AdminSettings>
): Promise<AdminSettings> {
  const db = getAdminDb();
  const current = await getAdminSettings();
  const next: AdminSettings = { ...current, ...patch };
  next.announcement = (next.announcement ?? "").slice(0, 280);
  await db.collection(SETTINGS_DOC_PATH[0]).doc(SETTINGS_DOC_PATH[1]).set(next, {
    merge: true,
  });
  return next;
}
