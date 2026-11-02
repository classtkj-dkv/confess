"use client";

import { useEffect, useState } from "react";

const CACHE_KEY = "confess-settings";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface SettingsShape {
  maintenanceMode: boolean;
  announcement: string;
  allowComments: boolean;
  fetchedAt?: number;
}

function readCache(): SettingsShape | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SettingsShape;
    if (!parsed.fetchedAt || Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AnnouncementBanner() {
  const [settings, setSettings] = useState<SettingsShape | null>(() =>
    typeof window === "undefined" ? null : readCache()
  );

  useEffect(() => {
    if (settings) return;
    let alive = true;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: SettingsShape) => {
        if (!alive) return;
        const withTime = { ...data, fetchedAt: Date.now() };
        try {
          window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(withTime));
        } catch {
          /* ignore quota */
        }
        if (data.maintenanceMode || data.announcement) setSettings(withTime);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!settings) return null;

  if (settings.maintenanceMode) {
    return (
      <div
        role="status"
        className="border-b border-hairline bg-warning/15 px-4 py-2 text-center text-xs font-semibold text-ink"
      >
        ⚠️ CONFESS sedang dalam mode perawatan — pengiriman ditutup sementara.
      </div>
    );
  }

  const announcement = settings.announcement.trim();
  if (!announcement) return null;

  return (
    <div
      role="status"
      className="border-b border-hairline bg-primary/15 px-4 py-2 text-center text-xs text-ink"
    >
      📣 {announcement}
    </div>
  );
}
