"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { alignPreview, monoMixdown } from "@/lib/songs/align";
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
  const [ctx, setCtx] = useState<AudioContext | null>(null);

  // AudioContext dibuat langsung di dalam ketukan pengguna supaya tidak diblokir
  // browser HP (iOS/Chrome) dan analyser gelombang bisa membaca musik.
  function openPlayer() {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      setCtx(AC ? new AC() : null);
    } catch {
      setCtx(null);
    }
    setOpen(true);
  }

  function closePlayer() {
    setOpen(false);
    setCtx((c) => {
      void c?.close().catch(() => {});
      return null;
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openPlayer}
        className="focus-ring group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-hairline bg-surface p-2.5 text-left transition-colors duration-200 hover:border-primary/40 hover:bg-ink/[0.03]"
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
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white transition-transform duration-200 group-hover:scale-105"
        >
          <Icon name="play" className="h-3.5 w-3.5" />
        </span>
      </button>
      {open && (
        <SongModal song={song} lyric={lyric} ctx={ctx} onClose={closePlayer} />
      )}
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
    <span aria-hidden className={className.includes("flex") ? className : `flex items-end gap-[3px] ${className}`}>
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

/** Judul panjang bergeser pelan bolak-balik; judul pendek tetap diam di tengah. */
function MarqueeText({ text, className = "" }: { text: string; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const txtRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  useEffect(() => {
    const measure = () => {
      const box = boxRef.current;
      const t = txtRef.current;
      if (!box || !t) return;
      const over = t.scrollWidth - box.clientWidth;
      setShift(over > 4 ? over + 24 : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text]);
  return (
    <div ref={boxRef} className={`overflow-hidden whitespace-nowrap ${shift ? "" : "text-center"} ${className}`}>
      <span
        ref={txtRef}
        className={shift ? "song-marquee inline-block" : "inline-block"}
        style={
          shift
            ? { ["--shift" as string]: `-${shift}px`, animationDuration: `${Math.max(9, shift / 16)}s` }
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface SyncedLine {
  t: number;
  text: string;
  /** Jeda musik / instrumental: tampil sebagai ikon nada. */
  music?: boolean;
}

const BARS = 24;
const sources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

function readSynced(v: unknown): SyncedLine[] {
  if (!Array.isArray(v)) return [];
  const out: SyncedLine[] = [];
  for (const r of v) {
    const o = r as { t?: unknown; text?: unknown };
    if (typeof o?.t !== "number") continue;
    const music = (r as { music?: unknown }).music === true;
    if (music) out.push({ t: o.t, text: "", music: true });
    else if (typeof o.text === "string" && o.text) out.push({ t: o.t, text: o.text });
  }
  return out;
}

const normText = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/**
 * Perkiraan awal: Deezer tidak memberi tahu preview mulai dari detik berapa.
 * Preview 30 dtk umumnya diambil dari tengah lagu, jadi kalau kutipan pengirim
 * muncul berkali-kali (reff), dipilih kemunculan yang paling dekat ke area itu.
 */
function guessOffset(lines: SyncedLine[], quote?: string): number {
  const real = lines.filter((l) => !l.music);
  if (real.length === 0) return 0;
  const end = real[real.length - 1].t;
  const expected = end * 0.33 + 12; // perkiraan titik tengah preview di lagu penuh
  const q = quote ? normText(quote).slice(0, 24) : "";
  if (q.length >= 6) {
    const hits = real.filter((l) => normText(l.text).includes(q));
    if (hits.length > 0) {
      const best = hits.reduce((a, b) => (Math.abs(b.t - expected) < Math.abs(a.t - expected) ? b : a));
      return Math.max(0, best.t - 6);
    }
  }
  return end * 0.33;
}

/** Ikon nada (pengganti emoji 🎵) — berdenyut halus saat bagian musik sedang jalan. */
function MusicNote({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`mx-auto transition-all duration-300 ${
        active ? "h-6 w-6 scale-110 animate-pulse text-white" : "h-4 w-4 text-white/30"
      }`}
      fill="currentColor"
    >
      <path d="M9 3.5v11.1A3.5 3.5 0 1 0 11 17.75V8.2l8-1.6v6.4A3.5 3.5 0 1 0 21 16.2V2.5L9 3.5Z" />
    </svg>
  );
}

const offsetKey = (id: string) => `confess:lyric-offset:${id}`;
const alignKey = (id: string) => `confess:lyric-align:${id}`;

function savedOffset(id: string): number | null {
  try {
    const raw = localStorage.getItem(offsetKey(id));
    if (raw !== null && Number.isFinite(Number(raw))) return Number(raw);
  } catch {
    /* abaikan */
  }
  return null;
}

function savedAlign(id: string): number | null {
  try {
    const raw = localStorage.getItem(alignKey(id));
    if (raw !== null && Number.isFinite(Number(raw))) return Number(raw);
  } catch {
    /* abaikan */
  }
  return null;
}

function storeAlign(id: string, offset: number): void {
  try {
    localStorage.setItem(alignKey(id), String(offset));
  } catch {
    /* abaikan */
  }
}

export function SongModal({
  song,
  lyric,
  ctx,
  onClose,
  aiOffset,
  aiSynced,
}: {
  song: Song;
  lyric?: string;
  ctx: AudioContext | null;
  onClose: () => void;
  /** Estimasi titik mulai preview dari AI; dipakai bila perangkat ini belum pernah dikalibrasi. */
  aiOffset?: number | null;
  /** Lirik yang sudah dirapikan AI (pengganti hasil LRCLIB mentah). */
  aiSynced?: SyncedLine[];
}) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const [muted, setMuted] = useState(false);
  const [synced, setSynced] = useState<SyncedLine[]>([]);
  const [offset, setOffset] = useState(0);
  const [calibrated, setCalibrated] = useState(false);
  const [active, setActive] = useState(-1);
  const [aligning, setAligning] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lyricBoxRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const touchedAt = useRef(0);
  /** Dibesarkan saat pengguna kalibrasi/geser sendiri → hasil auto-align tak menimpanya. */
  const userAdjusted = useRef(false);
  const live = useRef({ playing: false, offset: 0, synced: [] as SyncedLine[] });
  live.current = { playing, offset, synced };

  // Lirik ber-timestamp + offset tersimpan (kalau pernah disesuaikan di perangkat ini).
  useEffect(() => {
    let cancelled = false;
    const autoAlign = (id: string, lines: SyncedLine[], prior: number | null) => {
      if (userAdjusted.current) return;
      setAligning(true);
      void (async () => {
        let decoded: AudioBuffer | null = null;
        try {
          const res = await fetch(`/api/songs/preview?id=${encodeURIComponent(id)}`);
          if (!res.ok) return;
          const bytes = await res.arrayBuffer();
          // decodeAudioData tetap jalan di ctx suspended; bila ctx belum ada
          // (buka modal tanpa putar), buat context sementara untuk decode.
          const dec = ctx ?? new AudioContext();
          decoded = await dec.decodeAudioData(bytes);
          if (!ctx) void dec.close().catch(() => {});
        } catch {
          return; // analisa gagal → taksiran kasar dipakai
        }
        if (!decoded || cancelled) return;
        const mono = monoMixdown(decoded);
        const result = alignPreview(lines, mono, decoded.sampleRate, prior ?? undefined);
        if (cancelled) return;
        // Keyakinan rendah (banyak kemiripan) → taksiran awal lebih aman.
        if (result.confidence >= 0.45 && !userAdjusted.current) {
          setOffset(result.offset);
          storeAlign(id, result.offset);
        }
        setAligning(false);
      })();
    };
    const applyOffset = (lines: SyncedLine[]) => {
      const saved = savedOffset(song.id);
      setCalibrated(saved !== null);
      setOffset(saved ?? savedAlign(song.id) ?? (aiOffset ?? guessOffset(lines, lyric)));
      // Tanpa kalibrasi manual & tanpa cache → analisa audio sekali per lagu.
      if (!saved && lines.length >= 4 && savedAlign(song.id) === null) {
        autoAlign(song.id, lines, aiOffset ?? null);
      }
    };
    if (aiSynced && aiSynced.length >= 2) {
      // Lirik versi AI sudah disiapkan di form — tidak perlu fetch lagi.
      setSynced(aiSynced);
      applyOffset(aiSynced);
      return;
    }
    api(`/api/songs/lyrics?id=${encodeURIComponent(song.id)}`, { method: "GET", auth: false })
      .then((d) => {
        if (cancelled) return;
        const lines = readSynced(d.synced);
        setSynced(lines);
        if (lines.length >= 2) applyOffset(lines);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Sambungkan audio -> analyser -> (gain) -> speaker.
  useEffect(() => {
    const a = audioRef.current;
    if (!ctx || !a) return;
    try {
      let src = sources.get(a);
      if (!src) {
        src = ctx.createMediaElementSource(a);
        sources.set(a, src);
      }
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      an.smoothingTimeConstant = 0.8;
      const gain = ctx.createGain();
      src.connect(an);
      an.connect(gain);
      gain.connect(ctx.destination);
      analyserRef.current = an;
      gainRef.current = gain;
      return () => {
        try {
          src.disconnect();
          an.disconnect();
          gain.disconnect();
        } catch {
          /* abaikan */
        }
        analyserRef.current = null;
        gainRef.current = null;
      };
    } catch {
      analyserRef.current = null;
      gainRef.current = null;
    }
  }, [ctx]);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = muted ? 0 : 1;
    else if (audioRef.current) audioRef.current.muted = muted;
  }, [muted, ctx]);

  // Satu loop animasi: gelombang (DOM langsung), posisi lagu, dan baris lirik aktif.
  useEffect(() => {
    const levels = new Array(BARS).fill(0.08);
    const edges: number[] = [];
    for (let i = 0; i <= BARS; i++) {
      const e = Math.round(Math.pow(150, i / BARS)); // skala log: bass kiri, nada tinggi kanan
      edges.push(i === 0 ? 1 : Math.max(edges[i - 1] + 1, e));
    }
    const data = new Uint8Array(256);
    let peak = 60;
    let silentFrames = 0;
    let last = 0;
    let lastActive = -2;
    let lastTime = -1;
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; // ~30 fps, cukup halus dan tidak ngebut
      last = now;
      const a = audioRef.current;
      const { playing: isPlaying, offset: off, synced: lines } = live.current;

      const an = analyserRef.current;
      let real = false;
      if (an && isPlaying) {
        an.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < 160; i++) sum += data[i];
        silentFrames = sum > 0 ? 0 : silentFrames + 1;
        real = silentFrames < 30;
      }
      let frameMax = 0;
      const targets = new Array(BARS).fill(0.08);
      if (isPlaying) {
        for (let i = 0; i < BARS; i++) {
          if (real) {
            let acc = 0;
            const from = edges[i];
            const to = Math.max(from + 1, edges[i + 1]);
            for (let k = from; k < to; k++) acc += data[k];
            const v = (acc / (to - from)) * (1 + (i / BARS) * 0.9); // nada tinggi biasanya lebih lemah
            targets[i] = v;
            if (v > frameMax) frameMax = v;
          } else {
            // cadangan lembut kalau audio tidak bisa dibaca
            targets[i] = 0.2 + 0.35 * Math.abs(Math.sin(now / 520 + i * 0.55));
          }
        }
        if (real) {
          peak = Math.max(60, peak * 0.996, frameMax);
          for (let i = 0; i < BARS; i++) targets[i] = Math.max(0.08, Math.pow(targets[i] / peak, 1.25));
        }
      }
      for (let i = 0; i < BARS; i++) {
        const k = targets[i] > levels[i] ? 0.4 : 0.09; // naik cepat, turun pelan
        levels[i] += (targets[i] - levels[i]) * k;
        const el = barRefs.current[i];
        if (el) el.style.transform = `scaleY(${Math.min(1, levels[i]).toFixed(3)})`;
      }

      if (a) {
        const t = a.currentTime;
        if (Math.abs(t - lastTime) >= 0.1) {
          lastTime = t;
          setTime(t);
        }
        if (lines.length > 0) {
          const pos = t + off + 0.15;
          let idx = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].t <= pos) idx = i;
            else break;
          }
          if (idx !== lastActive) {
            lastActive = idx;
            setActive(idx);
          }
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Gulirkan lirik aktif ke tengah kotak (tanpa menggeser halaman).
  useEffect(() => {
    const box = lyricBoxRef.current;
    const el = lineRefs.current[active];
    if (!box || !el || Date.now() - touchedAt.current < 2500) return;
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: "smooth" });
  }, [active]);

  const resume = useCallback(() => {
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
  }, [ctx]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    resume();
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [resume]);

  function seek(v: number) {
    const a = audioRef.current;
    if (!a) return;
    userAdjusted.current = true;
    a.currentTime = v;
    setTime(v);
  }

  // Ketuk baris yang sedang dinyanyikan -> offset lirik disesuaikan & diingat.
  function syncTo(i: number) {
    const a = audioRef.current;
    if (!a || !synced[i]) return;
    userAdjusted.current = true;
    const next = synced[i].t - a.currentTime;
    setOffset(next);
    setCalibrated(true);
    setActive(i);
    touchedAt.current = 0;
    try {
      localStorage.setItem(offsetKey(song.id), String(next));
    } catch {
      /* abaikan */
    }
  }

  function resetSync() {
    try {
      localStorage.removeItem(offsetKey(song.id));
    } catch {
      /* abaikan */
    }
    userAdjusted.current = false;
    setCalibrated(false);
    setOffset(savedAlign(song.id) ?? (aiOffset ?? guessOffset(synced, lyric)));
  }

  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  const hasSynced = synced.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
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
          className="pointer-events-none absolute inset-0 h-full w-full song-drift object-cover opacity-55 blur-3xl"
        />
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/65" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${song.title} — ${song.artist}`}
        className="song-sheet relative mx-auto max-h-[100dvh] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-t-[28px] border border-white/10 bg-[#0b0f1d]/90 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-white shadow-2xl backdrop-blur-2xl sm:max-h-[92dvh] sm:rounded-[28px] sm:p-6 [@media(max-height:500px)]:max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Aktifkan suara" : "Bisukan"}
        aria-pressed={muted}
        className="focus-ring absolute left-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 sm:left-4 sm:top-4"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
          {muted ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
        </svg>
      </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="focus-ring absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 sm:right-4 sm:top-4 text-white/80 transition-colors hover:bg-white/20"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="[@media(max-height:500px)]:grid [@media(max-height:500px)]:grid-cols-2 [@media(max-height:500px)]:items-center [@media(max-height:500px)]:gap-6">
        <div>
        <p className="song-in flex items-center justify-center gap-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
          <Equalizer bars={4} playing={playing} className="h-3 text-primary" />
          {playing ? "Sedang diputar" : "Preview lagu"}
        </p>

        {/* sampul album; piringan hitam keluar dari sampul saat lagu diputar */}
        <div
          className="song-in relative mx-auto mt-4 [animation-delay:60ms]"
          style={{
            ["--s" as string]: "clamp(8rem, min(46vw, 27dvh), 13rem)",
            width: "calc(var(--s) * 1.4)",
            height: "var(--s)",
          }}
        >
          <div
            aria-hidden
            className={`absolute inset-x-[6%] -bottom-3 top-4 rounded-full bg-gradient-to-br from-primary to-secondary blur-3xl transition-opacity duration-700 ${
              playing ? "opacity-50" : "opacity-20"
            }`}
          />
          {playing &&
            [0, 1].map((i) => (
              <span
                key={i}
                aria-hidden
                className="song-ring pointer-events-none absolute inset-[6%] rounded-full border border-white/20"
                style={{ animationDelay: `${i * 1600}ms` }}
              />
            ))}
          <div
            className="absolute top-0 transition-[left] duration-700 ease-out"
            style={{
              left: playing ? "calc(var(--s) * 0.4)" : "calc(var(--s) * 0.12)",
              width: "var(--s)",
              height: "var(--s)",
            }}
          >
            <div
              className="vinyl-disc relative h-full w-full rounded-full shadow-[0_0_0_1.5px_rgba(255,255,255,0.2),0_18px_44px_rgba(0,0,0,0.55),0_0_44px_rgba(124,92,255,0.4)]"
              style={{ animationPlayState: playing ? "running" : "paused" }}
            >
              <div className="absolute inset-0 rounded-full bg-[repeating-radial-gradient(circle_at_center,#16161f_0,#16161f_2px,#2e2e40_3px,#16161f_4px)]" />
              <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_30deg,transparent_0deg,rgba(255,255,255,0.3)_40deg,transparent_90deg,transparent_180deg,rgba(255,255,255,0.22)_220deg,transparent_270deg)]" />
              <div className="absolute inset-[34%] overflow-hidden rounded-full ring-[3px] ring-white/30 [&>*]:!h-full [&>*]:!w-full [&>*]:!rounded-none">
                <SongCover song={song} size={120} />
              </div>
              <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0b0f1d] ring-2 ring-white/25" />
            </div>
          </div>
          <div
            className="song-breathe absolute left-0 top-0 overflow-hidden rounded-2xl shadow-[0_18px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/15 [&>*]:!h-full [&>*]:!w-full [&>*]:!rounded-none"
            style={{ width: "var(--s)", height: "var(--s)", animationPlayState: playing ? "running" : "paused" }}
          >
            <SongCover song={song} size={320} />
          </div>
        </div>

        <MarqueeText text={song.title} className="song-in mt-5 text-xl font-bold tracking-tight [animation-delay:140ms] sm:text-2xl" />
        <p className="song-in truncate text-center text-sm text-white/60 [animation-delay:200ms]">{song.artist}</p>

        {/* gelombang: tinggi tiap batang dari frekuensi musik yang sedang diputar */}
        <div aria-hidden className="song-in mx-auto mt-3 flex h-9 w-full items-end justify-center gap-[3px] text-primary [animation-delay:240ms] [filter:drop-shadow(0_0_6px_rgba(79,107,255,0.55))]">
          {Array.from({ length: BARS }).map((_, i) => (
            <span
              key={i}
              ref={(el) => {
                barRefs.current[i] = el;
              }}
              className="h-full w-[3px] origin-bottom rounded-full bg-gradient-to-t from-primary to-sky-300"
              style={{ transform: "scaleY(0.08)" }}
            />
          ))}
        </div>

        </div>
        <div>
        <div className="song-in mt-3 [animation-delay:300ms]">
          {failed ? (
            <p className="text-center text-xs text-white/50">Preview tidak bisa dimuat.</p>
          ) : (
            <>
              {!ready && <p className="mb-1 text-center text-xs text-white/50">Memuat…</p>}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                ref={audioRef}
                src={`/api/songs/preview?id=${encodeURIComponent(song.id)}`}
                preload="auto"
                autoPlay
                onCanPlay={() => setReady(true)}
                onError={() => setFailed(true)}
                onPlay={() => {
                  resume();
                  setPlaying(true);
                }}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                  setPlaying(false);
                  setTime(0);
                }}
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
                value={Math.min(time, duration)}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Posisi lagu"
                className="song-range w-full"
                style={{ ["--pct" as string]: `${pct}%` }}
              />
              <div className="mt-1 flex justify-between text-[11px] tabular-nums text-white/50">
                <span>{fmt(time)}</span>
                <span>{fmt(duration)}</span>
              </div>
              <div className="mt-3 flex items-center justify-center gap-4 sm:gap-6">
                <button
                  type="button"
                  onClick={() => seek(Math.max(0, time - 5))}
                  aria-label="Mundur 5 detik"
                  className="focus-ring grid h-11 w-11 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                    <path d="M11 6v12l-8.5-6L11 6Zm10 0v12l-8.5-6L21 6Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={playing ? "Jeda" : "Putar"}
                  className="focus-ring grid h-16 w-16 place-items-center rounded-full bg-white ring-8 ring-white/10 text-[#0c1020] shadow-[0_10px_30px_rgba(79,107,255,0.55)] transition-transform duration-200 hover:scale-105 active:scale-95"
                >
                  {playing ? (
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
                      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6" fill="currentColor" aria-hidden>
                      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => seek(Math.min(duration, time + 5))}
                  aria-label="Maju 5 detik"
                  className="focus-ring grid h-11 w-11 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                    <path d="M13 6v12l8.5-6L13 6ZM3 6v12l8.5-6L3 6Z" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>

        {hasSynced ? (
          <div className="song-in mt-4 [animation-delay:380ms]">
            <div
              ref={lyricBoxRef}
              onTouchStart={() => (touchedAt.current = Date.now())}
              onWheel={() => (touchedAt.current = Date.now())}
              aria-label="Lirik"
              className="relative h-[clamp(7rem,18dvh,10rem)] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-white/5 px-3 py-12 text-center [mask-image:linear-gradient(to_bottom,transparent,black_28%,black_72%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {synced.map((l, i) => (
                <button
                  key={`${l.t}-${i}`}
                  ref={(el) => {
                    lineRefs.current[i] = el;
                  }}
                  type="button"
                  onClick={() => syncTo(i)}
                  aria-label={l.music ? "Bagian musik" : undefined}
                  className={`block w-full px-1 text-center leading-snug transition-all duration-300 ${
                    l.music ? "py-2" : "py-1"
                  } ${
                    l.music
                      ? ""
                      : i === active
                        ? "text-base font-bold text-white [text-shadow:0_0_18px_rgba(124,92,255,0.65)]"
                        : "text-sm font-medium text-white/35 hover:text-white/60"
                  }`}
                >
                  {l.music ? <MusicNote active={i === active} /> : l.text}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-center text-[11px] text-white/40">
              {aligning
                ? "Menyelaraskan lirik dengan musik otomatis…"
                : calibrated
                  ? "Lirik sudah disesuaikan. Ketuk baris lain untuk mengatur ulang."
                  : "Lirik belum pas? Ketuk baris yang sedang dinyanyikan."}
              {calibrated && (
                <>
                  {" "}
                  <button type="button" onClick={resetSync} className="underline underline-offset-2 hover:text-white/70">
                    Reset
                  </button>
                </>
              )}
            </p>
          </div>
        ) : (
          lyric && (
            <blockquote className="mt-4 max-h-28 overflow-y-auto whitespace-pre-line rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-sm font-medium italic leading-relaxed text-white/90">
              {lyric}
            </blockquote>
          )
        )}
        </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
