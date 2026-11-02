"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiClientError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/lib/auth/ToastProvider";
import { getCategory } from "@/lib/categories";
import { REPORT_REASONS } from "@/lib/categories";
import type { Confession } from "@/types";
import { formatNumber, formatRelativeTime } from "@/utils/format";

function AnonymousAvatar() {
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary"
    >
      A
    </span>
  );
}

function LikeButton({
  confession,
  onDone,
}: {
  confession: Confession;
  onDone?: (liked: boolean) => void;
}) {
  const { configured } = useAuth();
  const { toast } = useToast();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(confession.likesCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!configured || busy) return;
    setBusy(true);
    const optimistic = !liked;
    setLiked(optimistic);
    setCount((c) => c + (optimistic ? 1 : -1));
    try {
      await api("/api/reactions", {
        body: { confessionId: confession.id, type: "like" },
      });
      onDone?.(optimistic);
    } catch (err) {
      // Revert optimistic state
      setLiked(!optimistic);
      setCount((c) => c + (optimistic ? -1 : 1));
      const msg = err instanceof ApiClientError ? err.message : "Gagal menyukai confession.";
      if (err instanceof ApiClientError && err.status === 409) {
        // Race: already reacted server-side; sync to server truth
        setLiked(true);
        setCount((c) => Math.max(1, c));
      } else {
        toast("error", msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      aria-label={liked ? "Batalkan suka" : "Sukai confession"}
      className={`focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        liked
          ? "bg-primary/15 text-primary"
          : "text-muted hover:bg-white/5 hover:text-ink"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M12 21 4.8 13.9a5 5 0 0 1 7.1-7.1l.1.2.1-.1a5 5 0 0 1 7.1 7.1L12 21Z" />
      </svg>
      {formatNumber(count)}
    </button>
  );
}

function CommentLink({ confession }: { confession: Confession }) {
  return (
    <Link
      href={`/confess/${confession.id}`}
      aria-label={`${confession.commentsCount} komentar`}
      className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
      </svg>
      {formatNumber(confession.commentsCount)}
    </Link>
  );
}

function ShareButton({ confession }: { confession: Confession }) {
  const { toast } = useToast();

  async function share() {
    const url = `${window.location.origin}/confess/${confession.id}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "CONFESS", text: "Baca ini di CONFESS", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("success", "Tautan confession disalin.");
    } catch {
      toast("info", "Tautan: " + url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Bagikan confession"
      className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3v13m0-13-4 4m4-4 4 4" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
    </button>
  );
}

function ReportButton({ confession }: { confession: Confession }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { configured } = useAuth();

  async function report(reason: string) {
    if (!configured) {
      toast("error", "Sesi tidak tersedia. Coba lagi nanti.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/reports", {
        body: { confessionId: confession.id, reason },
      });
      toast("info", "Laporan terkirim. Terima kasih, tim moderasi akan mengeceknya.");
      setOpen(false);
    } catch (err) {
      toast("error", err instanceof ApiClientError ? err.message : "Gagal mengirim laporan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Laporkan confession"
        className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-white/5 hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 21V4m0 0 6 2 3.5-2 4.5 3v8l-3 2-3.5-2-6.5-2" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="glass-panel absolute right-0 bottom-10 z-20 w-60 rounded-xl border border-hairline p-2 shadow-lift"
        >
          <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Alasan laporan
          </p>
          {REPORT_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => report(r.id)}
              className="focus-ring block w-full rounded-lg px-2 py-1.5 text-left text-xs text-ink transition-colors hover:bg-white/5"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConfessionCard({
  confession,
  onLikeChange,
  compact = false,
}: {
  confession: Confession;
  onLikeChange?: (liked: boolean) => void;
  compact?: boolean;
}) {
  const category = getCategory(confession.category);
  const href = `/confess/${confession.id}`;

  return (
    <article className={`card transition-shadow duration-200 hover:shadow-lift ${compact ? "p-4" : "p-5"}`}>
      <header className="flex items-center gap-3">
        <AnonymousAvatar />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-ink">Anonim</p>
          <time dateTime={new Date(confession.createdAt).toISOString()} className="text-[11px] text-muted">
            {formatRelativeTime(confession.createdAt)}
          </time>
        </div>
        <Link href={href} className="badge hover:text-ink" title={category.label}>
          <span aria-hidden>{category.emoji}</span>
          {category.label}
        </Link>
      </header>

      <div className={`mt-3 ${compact ? "" : "space-y-3"}`}>
        <p className={`text-sm whitespace-pre-line text-ink/90 ${compact ? "line-clamp-4" : ""}`}>
          {confession.message}
        </p>
        {!compact && (
          <ReadMore message={confession.message} href={href} />
        )}
      </div>

      <footer className="mt-4 flex items-center gap-1 border-t border-hairline pt-3">
        <LikeButton confession={confession} onDone={onLikeChange} />
        <CommentLink confession={confession} />
        <div className="ml-auto flex items-center">
          <ShareButton confession={confession} />
          <ReportButton confession={confession} />
        </div>
      </footer>
    </article>
  );
}

function ReadMore({ message, href }: { message: string; href: string }) {
  if (Array.from(message).length <= 280) return null;
  return (
    <Link
      href={href}
      className="focus-ring inline-block rounded-md text-xs font-semibold text-primary"
    >
      Baca selengkapnya →
    </Link>
  );
}
