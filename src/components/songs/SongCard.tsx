"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
        className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-secondary/25 text-primary"
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
      className="shrink-0 rounded-xl bg-surface object-cover shadow-soft"
    />
  );
}

/** Baris lagu ringkas; ketuk untuk membuka pemutar preview. */
export function SongCard({ song, lyric }: { song: Song; lyric?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-hairline bg-gradient-to-r from-primary/10 via-surface to-secondary/10 p-2.5 text-left transition-all duration-200 hover:border-primary/40 hover:shadow-soft"
        aria-label={`Putar preview ${song.title}`}
      >
        <SongCover song={song} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{song.title}</span>
          <span className="block truncate text-xs text-muted">{song.artist}</span>
        </span>
        <Equalizer bars={4} className="hidden h-5 text-primary/60 sm:flex" playing={false} />
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-glow transition-transform duration-200 group-hover:scale-110"
        >
          <Icon name="play" className="h-3.5 w-3.5" />
        </span>
      </button>
      {open && <SongModal song={song} lyric={lyric} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Batang equalizer animasi (murni visual; browser tidak membuka data audio preview). */
function Equalizer({
  bars,
  playing,
  className = "",
}: {
  bars: number;
  playing: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden className={`items-end gap-[3px] ${className || "flex"} ${className.includes("flex") ? "" : "flex"}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="eq-bar w-[3px] rounded-full bg-current"
          style={{
            height: "100%",
            animationDelay: `${(i * 137) % 700}ms`,
            animationDuration: `${620 + ((i * 97) % 480)}ms`,
            animationPlayState: playing ? "running" : "paused",
            transform: playing ? undefined : "scaleY(0.25)",
          }}
        />
      ))}
    </span>
  );
}

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
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
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  }, []);

  function seek(v: number) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = v;
    setTime(v);
  }

  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      {/* latar: sampul diburamkan jadi aurora */}
      {song.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={song.cover}
          alt=""
          aria-hidden
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-3xl"
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${song.title} — ${song.artist}`}
        className="song-sheet relative mx-auto max-h-[94dvh] w-full max-w-sm overflow-y-auto overflow-x-hidden rounded-t-3xl border border-white/10 bg-[#0c1020]/85 p-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:p-6 sm:pb-8 text-white shadow-2xl backdrop-blur-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="focus-ring absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">
          {playing ? "Sedang diputar" : "Preview lagu"}
        </p>

        {/* piringan hitam berputar dengan sampul di tengah */}
        <div className="relative mx-auto mt-5 aspect-square w-[min(15rem,62vw)]">
          <div
            aria-hidden
            className={`absolute -inset-4 rounded-full bg-gradient-to-br from-primary to-secondary blur-2xl transition-opacity duration-700 ${
              playing ? "opacity-60" : "opacity-25"
            }`}
          />
          <div
            className="vinyl-disc relative h-full w-full rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
            style={{ animationPlayState: playing ? "running" : "paused" }}
          >
            <div className="absolute inset-0 rounded-full bg-[repeating-radial-gradient(circle_at_center,#0a0a0f_0,#0a0a0f_2px,#15151d_3px,#0a0a0f_4px)]" />
            <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_30deg,transparent_0deg,rgba(255,255,255,0.12)_40deg,transparent_90deg,transparent_180deg,rgba(255,255,255,0.1)_220deg,transparent_270deg)]" />
            <div className="absolute inset-[27%] overflow-hidden rounded-full ring-4 ring-black/70 [&>*]:!h-full [&>*]:!w-full [&>*]:!rounded-none">
              <SongCover song={song} size={240} />
            </div>
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0c1020] ring-2 ring-white/20" />
          </div>
        </div>

        <p className="mt-6 truncate text-center text-xl font-extrabold tracking-tight">{song.title}</p>
        <p className="truncate text-center text-sm text-white/60">{song.artist}</p>

        <Equalizer
          bars={24}
          playing={playing}
          className="mx-auto mt-4 flex h-8 w-full justify-center gap-[3px] text-primary"
        />

        <div className="mt-4">
          {state === "loading" && <p className="text-center text-xs text-white/50">Memuat…</p>}
          {state === "error" && (
            <p className="text-center text-xs text-white/50">Preview tidak bisa dimuat.</p>
          )}
          {state === "ready" &&
            (preview ? (
              <div>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio
                  ref={audioRef}
                  src={preview}
                  autoPlay
                  muted={muted}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => {
                    setPlaying(false);
                    setTime(0);
                  }}
                  onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    if (Number.isFinite(d) && d > 0) setDuration(d);
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={time}
                  onChange={(e) => seek(Number(e.target.value))}
                  aria-label="Posisi lagu"
                  className="song-range w-full"
                  style={{ ["--pct" as string]: `${pct}%` }}
                />
                <div className="mt-1 flex justify-between text-[11px] tabular-nums text-white/50">
                  <span>{fmt(time)}</span>
                  <span>{fmt(duration)}</span>
                </div>
                <div className="mt-3 flex items-center justify-center gap-5">
                  <button
                    type="button"
                    onClick={() => seek(Math.max(0, time - 5))}
                    aria-label="Mundur 5 detik"
                    className="focus-ring grid h-10 w-10 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                      <path d="M11 6v12l-8.5-6L11 6Zm10 0v12l-8.5-6L21 6Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label={playing ? "Jeda" : "Putar"}
                    className="focus-ring grid h-16 w-16 place-items-center rounded-full bg-white text-[#0c1020] shadow-[0_10px_30px_rgba(79,107,255,0.55)] transition-transform duration-200 hover:scale-105 active:scale-95"
                  >
                    {playing ? (
                      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
                        <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor" aria-hidden>
                        <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? "Aktifkan suara" : "Bisukan"}
                    aria-pressed={muted}
                    className="focus-ring grid h-10 w-10 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
                      {muted ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-xs text-white/50">Preview tidak tersedia.</p>
            ))}
        </div>

        {lyric && (
          <blockquote className="mt-5 max-h-36 overflow-y-auto whitespace-pre-line rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm font-medium italic leading-relaxed text-white/90">
            {lyric}
          </blockquote>
        )}
      </div>
    </div>,
    document.body
  );
}
