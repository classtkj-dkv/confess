import { getAdminRtdb } from "@/lib/firebase/admin";
import type { AppSettings } from "@/types";
import { DEFAULT_SETTINGS, parseSettings } from "@/lib/settingsShared";

export type AdminSettings = AppSettings;

export { DEFAULT_SETTINGS, parseSettings };

const SETTINGS_PATH = "settings/general";

export async function getAdminSettings(): Promise<AdminSettings> {
  const snap = await getAdminRtdb().ref(SETTINGS_PATH).get();
  return parseSettings(snap.val());
}

export async function updateAdminSettings(
  patch: Partial<AdminSettings>
): Promise<AdminSettings> {
  const current = await getAdminSettings();
  const next: AdminSettings = { ...current, ...patch };
  next.announcement = (next.announcement ?? "").slice(0, 280);
  await getAdminRtdb().ref(SETTINGS_PATH).set({ ...next, updatedAt: Date.now() });
  return next;
}
