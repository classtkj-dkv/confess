"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/ui/States";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeletons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useNotifications } from "@/lib/firebase/useNotifications";
import { notificationTitle } from "@/lib/notifications";
import { formatRelativeTime } from "@/utils/format";
import type { NotificationType } from "@/types";

const ICONS: Record<NotificationType, IconName> = {
  comment: "message",
  reply: "message",
  approved: "check",
  rejected: "xcircle",
};

export function NotificationsClient() {
  const { configured, uid } = useAuth();
  const { items, unread, loading } = useNotifications();
  const [busy, setBusy] = useState(false);

  async function markRead(id: string) {
    try {
      await api("/api/notifications", { body: { id } });
    } catch {
      /* gagal menandai tidak mengganggu navigasi */
    }
  }

  async function markAll() {
    setBusy(true);
    try {
      await api("/api/notifications", { body: { all: true } });
    } catch {
      /* abaikan; daftar tetap tampil */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <h1 className="page-title">Notifikasi</h1>
          <p className="page-lead max-w-2xl">
            Balasan dan komentar untuk confess dan komentarmu muncul di sini.
          </p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => void markAll()}
            disabled={busy}
            className="btn-ghost ml-auto !px-4 !py-2 text-xs"
          >
            Tandai semua dibaca
          </button>
        )}
      </header>

      {loading ? (
        <div className="space-y-3" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !configured || !uid || items.length === 0 ? (
        <EmptyState
          icon="bell"
          title="Belum ada notifikasi"
          description="Kirim confess atau tulis komentar, nanti balasannya muncul di sini. Notifikasi terikat ke browser ini, jadi menghapus data browser akan menghapusnya juga."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={`/confess/${n.confessionId}`}
                onClick={() => {
                  if (!n.read) void markRead(n.id);
                }}
                className={`focus-ring card card-interactive flex items-start gap-3 p-4 ${
                  n.read ? "" : "ring-1 ring-primary/40"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                    n.type === "rejected"
                      ? "bg-danger/10 text-danger"
                      : n.type === "approved"
                        ? "bg-success/10 text-success"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  <Icon name={ICONS[n.type]} className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.read ? "text-ink/80" : "font-semibold text-ink"}`}>
                    {notificationTitle(n)}
                  </span>
                  {n.snippet && (
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.snippet}</span>
                  )}
                  <time className="mt-1 block text-[11px] text-muted" dateTime={new Date(n.createdAt).toISOString()}>
                    {formatRelativeTime(n.createdAt)}
                  </time>
                </span>
                {!n.read && <span aria-label="Belum dibaca" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
