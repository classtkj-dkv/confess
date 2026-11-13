"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/lib/auth/ToastProvider";
import { useNotifications } from "@/lib/firebase/useNotifications";
import { notificationTitle } from "@/lib/notifications";

export function NotificationBell() {
  const { items, unread, loading } = useNotifications();
  const { toast } = useToast();
  // Id yang sudah dilihat; muatan awal dicatat tanpa pop-up supaya notifikasi
  // lama tidak membanjiri layar tiap kali situs dibuka.
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (loading) return;
    if (seen.current === null) {
      seen.current = new Set(items.map((n) => n.id));
      return;
    }
    for (const n of items) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (!n.read) toast("info", notificationTitle(n));
    }
  }, [items, loading, toast]);

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
      className="icon-btn"
    >
      <Icon name="bell" className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-background tabular-nums">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
