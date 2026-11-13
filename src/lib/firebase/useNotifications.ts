"use client";

import { useEffect, useMemo, useState } from "react";
import { limitToLast, onValue, query, ref } from "firebase/database";
import { getRtdb } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { NOTIFICATION_TYPES } from "@/lib/notifications";
import type { AppNotification, NotificationType } from "@/types";

const PAGE = 30;

function toNotification(id: string, v: Record<string, unknown>): AppNotification | null {
  const type = String(v.type ?? "");
  if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) return null;
  return {
    id,
    type: type as NotificationType,
    confessionId: String(v.confessionId ?? ""),
    commentId: v.commentId ? String(v.commentId) : undefined,
    fromName: v.fromName ? String(v.fromName) : undefined,
    snippet: v.snippet ? String(v.snippet) : undefined,
    createdAt: Number(v.createdAt ?? 0),
    read: v.read === true,
  };
}

/**
 * Notifikasi milik sesi ini (realtime). `notifications/{uid}` hanya bisa
 * dibaca pemiliknya; sesi anonim terikat ke browser/perangkat yang sama.
 */
export function useNotifications(): {
  items: AppNotification[];
  unread: number;
  loading: boolean;
} {
  const { configured, uid, loading: authLoading } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!configured || !uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Kunci push berurutan waktu, jadi limitToLast tanpa index tambahan.
    const unsub = onValue(
      query(ref(getRtdb(), `notifications/${uid}`), limitToLast(PAGE)),
      (snap) => {
        const out: AppNotification[] = [];
        snap.forEach((c) => {
          const n = toNotification(String(c.key), c.val() as Record<string, unknown>);
          if (n) out.push(n);
        });
        setItems(out.sort((a, b) => b.createdAt - a.createdAt));
        setLoading(false);
      },
      () => {
        setItems([]);
        setLoading(false);
      }
    );
    return unsub;
  }, [configured, uid, authLoading]);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);
  return { items, unread, loading: authLoading || loading };
}
