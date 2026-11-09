import type { AppSettings } from "@/types";

export const DEFAULT_SETTINGS: AppSettings = {
  websiteName: "CONFESS",
  maintenanceMode: false,
  announcement: "",
  allowComments: true,
  allowConfessions: true,
  allowSongs: true,
  maxConfessionLength: 1000,
  dailySubmissionLimit: 5,
};

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Normalisasi data mentah settings/general → AppSettings (server & klien). */
export function parseSettings(data: unknown): AppSettings {
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    websiteName:
      typeof d.websiteName === "string" && d.websiteName.trim()
        ? d.websiteName.slice(0, 60)
        : DEFAULT_SETTINGS.websiteName,
    maintenanceMode: d.maintenanceMode === true,
    announcement: typeof d.announcement === "string" ? d.announcement : "",
    allowComments: d.allowComments !== false,
    allowConfessions: d.allowConfessions !== false,
    allowSongs: d.allowSongs !== false,
    maxConfessionLength: clampInt(d.maxConfessionLength, 50, 1000, 1000),
    dailySubmissionLimit: clampInt(d.dailySubmissionLimit, 1, 50, 5),
  };
}
