"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { get, ref } from "firebase/database";
import { EmptyState } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";
import { getRtdb, isFirebaseConfigured } from "@/lib/firebase/client";
import { useNotifications } from "@/lib/firebase/useNotifications";
import { getCategory } from "@/lib/categories";
import {
  HISTORY_EVENT,
  clearHistory,
  readHistory,
  removeHistory,
  type HistoryEntry,
} from "@/lib/history";
import { formatNumber, formatRelativeTime } from "@/utils/format";

/** Hanya sebanyak ini riwayat terbaru yang dicek status tayangnya. */
const LIVE_CHECK_LIMIT = 30;

interface Live {
  likes: number;
  comments: number;
}

type ViewStatus = "live" | "pending" | "rejected" | "gone";

const STATUS_UI: Record<ViewStatus, { label: string; cls: string }> = {
  live: { label: "Tayang", cls: "bg-success/10 text-success" },
  pending: { label: "Menunggu moderasi", cls: "bg-warning/10 text-warning" },
  rejected: { label: "Ditolak", cls: "bg-danger/10 text-danger" },
  gone: { label: "Tidak tayang lagi", cls: "bg-ink/5 text-muted" },
};

export function HistoryClient() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [live, setLive] = useState<Record<string, Live | null>>({});
  const { items: notifs } = useNotifications();

  const reload = useCallback(() => setEntries(readHistory()), []);

  useEffect(() => {
    reload();
    window.addEventListener(HISTORY_EVENT, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(HISTORY_EVENT, reload);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  // Cek sekali apakah tiap confess masih tayang (data publik, tanpa login).
  const idsKey = useMemo(
    () => (entries ?? []).slice(0, LIVE_CHECK_LIMIT).map((e) => e.id).join(","),
    [entries]
  );
  useEffect(() => {
    if (!isFirebaseConfigured || !idsKey) return;
    let cancelled = false;
    void Promise.all(
      idsKey.split(",").map(async (id) => {
        try {
          const snap = await get(ref(getRtdb(), `public/confessions/${id}`));
          if (!snap.exists()) return [id, null] as const;
          const v = snap.val() as Record<string, unknown>;
          return [
            id,
            { likes: Number(v.likesCount ?? 0), comments: Number(v.commentsCount ?? 0) },
          ] as const;
        } catch {
          return [id, undefined] as const; // gagal cek: status tidak diketahui
        }
      })
    ).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, Live | null> = {};
      for (const [id, v] of pairs) if (v !== undefined) next[id] = v;
      setLive(next);
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const decided = useMemo(() => {
    const m = new Map<string, "approved" | "rejected">();
    for (const n of notifs) {
      if (n.type === "approved" || n.type === "rejected") m.set(n.confessionId, n.type);
    }
    return m;
  }, [notifs]);

  function statusOf(e: HistoryEntry): ViewStatus {
    if (live[e.id]) return "live";
    if (decided.get(e.id) === "rejected") return "rejected";
    if (e.status === "PUBLISHED" || decided.get(e.id) === "approved") return "gone";
    // Belum tayang: masih menunggu, atau ditolak tanpa notifikasi tersisa.
    return "pending";
  }

  function onClear() {
    if (window.confirm("Hapus semua riwayat di perangkat ini? Confess yang sudah tayang tidak ikut terhapus.")) {
      clearHistory();
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <h1 className="page-title">Riwayat confess</h1>
          <p className="page-lead max-w-2xl">Confess yang pernah kamu kirim dari browser atau HP ini.</p>
        </div>
        {entries && entries.length > 0 && (
          <button type="button" onClick={onClear} className="btn-ghost ml-auto !px-4 !py-2 text-xs">
            Hapus semua
          </button>
        )}
      </header>

      <p className="flex items-start gap-2 rounded-xl border border-hairline bg-surface/60 p-3.5 text-xs leading-relaxed text-muted">
        <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Riwayat disimpan <b className="text-ink">hanya di perangkat ini</b>, tidak di server. Tidak ikut pindah ke HP
          lain dan hilang kalau data browser dihapus. Siapa pun yang memakai HP ini bisa melihatnya, jadi hapus kalau
          perlu.
        </span>
      </p>

      {entries === null ? null : entries.length === 0 ? (
        <EmptyState
          icon="clock"
          title="Belum ada riwayat"
          description="Confess yang kamu kirim mulai sekarang akan tercatat di sini. Confess yang dikirim sebelumnya tidak ikut tercatat."
          action={
            <Link href="/confess" className="btn-primary">
              Tulis confess
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => {
            const st = statusOf(e);
            const ui = STATUS_UI[st];
            const stats = live[e.id];
            const cat = getCategory(e.category);
            return (
              <li key={e.id} className="card space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`rounded-full px-2.5 py-1 font-semibold ${ui.cls}`}>{ui.label}</span>
                  <span className="badge">
                    <Icon name={cat.icon} className="inline h-3 w-3 align-[-2px]" /> {cat.label}
                  </span>
                  <time className="text-muted" dateTime={new Date(e.createdAt).toISOString()}>
                    {formatRelativeTime(e.createdAt)}
                  </time>
                </div>
                {e.toName && (
                  <p className="text-xs text-muted">
                    Untuk <span className="font-semibold text-ink">{e.toName}</span>
                  </p>
                )}
                <p className="line-clamp-5 whitespace-pre-line text-sm leading-relaxed text-ink/90">{e.message}</p>
                {e.song && (
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <Icon name="music" className="h-3.5 w-3.5" />
                    <span className="truncate">
                      {e.song.title} — {e.song.artist}
                    </span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-3 text-xs text-muted">
                  {stats && (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="heart" className="h-3.5 w-3.5" /> {formatNumber(stats.likes)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="message" className="h-3.5 w-3.5" /> {formatNumber(stats.comments)}
                      </span>
                    </>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    {st === "live" && (
                      <Link href={`/confess/${e.id}`} className="btn-ghost !px-3 !py-1.5 text-xs">
                        Buka
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => removeHistory(e.id)}
                      className="focus-ring rounded-lg px-3 py-1.5 text-xs font-semibold text-muted hover:text-danger"
                    >
                      Hapus dari riwayat
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
