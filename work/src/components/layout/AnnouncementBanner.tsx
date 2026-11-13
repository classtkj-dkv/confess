"use client";

import { useSettings } from "@/lib/firebase/useSettings";
import { Icon } from "@/components/ui/Icon";

/** Banner realtime: maintenance + pengumuman (tanpa refresh). */
export function AnnouncementBanner() {
  const { settings } = useSettings();

  if (settings.maintenanceMode) {
    return (
      <div
        role="status"
        className="border-b border-warning/20 bg-warning/10 px-4 py-2 text-center text-xs font-semibold text-ink"
      >
        <Icon name="alert" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        {settings.websiteName} sedang dalam mode perawatan — pengiriman ditutup sementara.
      </div>
    );
  }

  const announcement = settings.announcement.trim();
  if (!announcement) return null;

  return (
    <div
      role="status"
      className="border-b border-primary/20 bg-primary/10 px-4 py-2 text-center text-xs font-medium text-ink"
    >
      <Icon name="megaphone" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
      {announcement}
    </div>
  );
}
