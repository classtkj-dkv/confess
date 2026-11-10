"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import type { Song } from "@/types";

export function SongCover({ song, size = 48 }: { song: Song; size?: number }) {
  const style = { width: size, height: size };
  if (!song.cover) {
    return (
      <span
        aria-hidden
        style={style}
        className="grid shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"
      >
        <Icon name="music" className="h-1/2 w-1/2" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={song.cover}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      style={style}
      className="shrink-0 rounded-lg bg-surface object-cover"
    />
  );
}

/** Baris lagu ringkas; ketuk untuk membuka modal preview. */
export function SongCard({ song, lyric }: { song: Song; lyric?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring flex w-full items-center gap-3 rounded-xl border border-hairline bg-surface p-2.5 text-left transition-colors hover:bg-ink/5"
        aria-label={`Putar preview ${song.title}`}
      >
        <SongCover song={song} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{song.title}</span>
          <span className="block truncate text-xs text-muted">{song.artist}</span>
        </span>
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs text-white"
        >
          <Icon name="play" className="h-3.5 w-3.5" />
        </span>
      </button>
      {open && <SongModal song={song} lyric={lyric} onClose={() => setOpen(false)} />}
    </>
  );
}

function SongModal({
  song,
  lyric,
  onClose,
}: {
  song: Song;
  lyric?: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [preview, setPreview] = useState("");

  // URL preview Deezer kedaluwarsa, jadi diambil segar setiap modal dibuka.
  useEffect(() => {
    let cancelled = false;
    api(`/api/songs/track?id=${encodeURIComponent(song.id)}`, { method: "GET", auth: false })
      .then((d) => {
        if (cancelled) return;
        setPreview(String(d.preview ?? ""));
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [song.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${song.title} — ${song.artist}`}
        className="glass-panel w-full max-w-sm rounded-2xl border border-hairline p-5 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center">
          <SongCover song={song} size={200} />
        </div>
        <p className="mt-4 text-center text-base font-semibold text-ink">{song.title}</p>
        <p className="text-center text-sm text-muted">{song.artist}</p>

        <div className="mt-4">
          {state === "loading" && <p className="text-center text-xs text-muted">Memuat…</p>}
          {state === "error" && (
            <p className="text-center text-xs text-muted">Preview tidak bisa dimuat.</p>
          )}
          {state === "ready" &&
            (preview ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio controls autoPlay src={preview} className="w-full" />
            ) : (
              <p className="text-center text-xs text-muted">Preview tidak tersedia.</p>
            ))}
        </div>

        {lyric && (
          <blockquote className="mt-4 max-h-40 overflow-y-auto whitespace-pre-line rounded-xl bg-surface p-3 text-center text-sm italic text-ink/90">
            {lyric}
          </blockquote>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="btn-primary flex-1">
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
