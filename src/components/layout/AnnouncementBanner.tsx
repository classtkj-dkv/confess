"use client";

import { useSettings } from "@/lib/firebase/useSettings";

/** Banner realtime: maintenance + pengumuman (tanpa refresh). */
export function AnnouncementBanner() {
  const { settings } = useSettings();

  if (settings.maintenanceMode) {
    return (
      <div
        role="status"
        className="border-b border-hairline bg-warning/15 px-4 py-2 text-center text-xs font-semibold text-ink"
      >
        ⚠️ {settings.websiteName} sedang dalam mode perawatan — pengiriman ditutup sementara.
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
