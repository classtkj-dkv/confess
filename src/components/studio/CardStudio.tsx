"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Song } from "@/types";

export interface StudioData {
  fromName?: string;
  toName?: string;
  message: string;
  song?: Song | null;
  songLyric?: string;
}

type Align = "left" | "center";
type Ratio = "story" | "post" | "square";
type FontId = "script" | "serif" | "sans" | "mono";

const SIZES: Record<Ratio, { w: number; h: number; label: string }> = {
  story: { w: 1080, h: 1920, label: "Story 9:16" },
  post: { w: 1080, h: 1350, label: "Post 4:5" },
  square: { w: 1080, h: 1080, label: "Kotak 1:1" },
};

const PALETTES = [
  { name: "Laut", stops: ["#e3f6fa", "#a9dcea", "#6db3d8"], text: "#0b3d91" },
  { name: "Senja", stops: ["#ffe0b5", "#ff9fb2", "#b78cf2"], text: "#3b1f4a" },
  { name: "Lavender", stops: ["#f1e8ff", "#d3c2f7", "#a99be6"], text: "#2d1b69" },
  { name: "Mint", stops: ["#e6fbf0", "#b5ead0", "#7cc9b0"], text: "#0f4d3a" },
  { name: "Krem", stops: ["#fff8ee", "#f6e3c8", "#e9c9a0"], text: "#5a3410" },
  { name: "Malam", stops: ["#0f172a", "#312e81", "#6d28d9"], text: "#ffffff" },
];

const FONTS: { id: FontId; label: string; css: string; italic: boolean }[] = [
  {
    id: "script",
    label: "Script",
    css: '"Segoe Script","Snell Roundhand","Brush Script MT","Lucida Handwriting",cursive',
    italic: false,
  },
  { id: "serif", label: "Serif", css: 'Georgia,"Times New Roman",serif', italic: true },
  {
    id: "sans",
    label: "Sans",
    css: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
    italic: false,
  },
  {
    id: "mono",
    label: "Mono",
    css: 'ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace',
    italic: false,
  },
];

interface Labels {
  to: string;
  from: string;
  message: string;
  song: string;
}

interface Opts {
  bgMode: "gen" | "image";
  palette: number;
  seed: number;
  overlay: number;
  title: string;
  labels: Labels;
  to: string;
  from: string;
  message: string;
  showSong: boolean;
  showLyric: boolean;
  lyric: string;
  font: FontId;
  color: string;
  scale: number;
  align: Align;
  ratio: Ratio;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width <= maxW) {
        line = test;
        continue;
      }
      if (line) out.push(line);
      if (ctx.measureText(w).width > maxW) {
        let chunk = "";
        for (const ch of Array.from(w)) {
          if (chunk && ctx.measureText(chunk + ch).width > maxW) {
            out.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
      } else {
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  o: Opts,
  bg: HTMLImageElement | null
) {
  if (o.bgMode === "image" && bg) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const k = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
    const dw = bg.naturalWidth * k;
    const dh = bg.naturalHeight * k;
    ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    if (o.overlay > 0) {
      ctx.fillStyle = `rgba(${isLight(o.color) ? "0,0,0" : "255,255,255"},${o.overlay})`;
      ctx.fillRect(0, 0, W, H);
    }
    return;
  }
  const p = PALETTES[o.palette] ?? PALETTES[0];
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, p.stops[0]);
  g.addColorStop(0.55, p.stops[1]);
  g.addColorStop(1, p.stops[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const rand = rng(o.seed * 7919 + 13);
  for (let i = 0; i < 4; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = (0.25 + rand() * 0.35) * W;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, "rgba(255,255,255,0.28)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
  for (let i = 0; i < 16; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 24 + rand() * 120;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.06 + rand() * 0.14})`;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255,255,255,${0.12 + rand() * 0.18})`;
    ctx.stroke();
  }
}

/** Menata dan menggambar teks. dry=true hanya mengukur. Mengembalikan tinggi konten. */
function layout(
  ctx: CanvasRenderingContext2D,
  o: Opts,
  song: Song | null,
  cover: HTMLImageElement | null,
  W: number,
  s: number,
  y0: number,
  dry: boolean
): number {
  const font = FONTS.find((f) => f.id === o.font) ?? FONTS[0];
  const pad = W * 0.09;
  const maxW = W - pad * 2;
  const center = o.align === "center";
  const x = center ? W / 2 : pad;
  const fnt = (px: number, italic = false) =>
    `${italic ? "italic " : ""}${Math.round(px)}px ${font.css}`;

  ctx.textAlign = o.align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = o.color;

  let y = y0;
  const put = (str: string, py: number, px = x) => {
    if (!dry) ctx.fillText(str, px, py);
  };

  if (o.title.trim()) {
    const size = 150 * s;
    ctx.font = fnt(size, font.italic);
    for (const line of wrap(ctx, o.title.trim(), maxW)) {
      y += size * 0.95;
      put(line, y);
      y += size * 0.12;
    }
    y += 70 * s;
  }

  const label = (text: string) => {
    if (!text.trim()) return;
    const size = 62 * s;
    ctx.font = fnt(size, true);
    y += size * 1.1;
    put(text.trim(), y);
    y += size * 0.25;
  };

  const block = (lab: string, value: string) => {
    label(lab);
    const size = 52 * s;
    ctx.font = fnt(size);
    for (const line of wrap(ctx, value, maxW)) {
      y += size * 1.35;
      put(line, y);
    }
    y += 56 * s;
  };

  if (o.to.trim()) block(o.labels.to, o.to);
  if (o.from.trim()) block(o.labels.from, o.from);
  if (o.message.trim()) block(o.labels.message, o.message);

  if (o.showSong && song) {
    label(o.labels.song);
    y += 12 * s;
    const cs = 260 * s;
    const tp = 52 * s;
    const ap = 42 * s;
    const drawCover = (cx: number, cy: number) => {
      if (dry) return;
      ctx.save();
      roundRect(ctx, cx, cy, cs, cs, cs * 0.1);
      if (cover) {
        ctx.clip();
        ctx.drawImage(cover, cx, cy, cs, cs);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fill();
        ctx.fillStyle = o.color;
        ctx.textAlign = "center";
        ctx.font = fnt(cs * 0.45);
        ctx.fillText("♪", cx + cs / 2, cy + cs * 0.65);
      }
      ctx.restore();
      ctx.fillStyle = o.color;
      ctx.textAlign = o.align;
    };

    if (center) {
      drawCover(x - cs / 2, y);
      y += cs + 30 * s;
      ctx.font = fnt(tp);
      for (const line of wrap(ctx, song.title, maxW)) {
        y += tp * 1.3;
        put(line, y);
      }
      if (song.artist) {
        ctx.font = fnt(ap);
        for (const line of wrap(ctx, song.artist, maxW)) {
          y += ap * 1.35;
          put(line, y);
        }
      }
    } else {
      const gap = 36 * s;
      const tx = x + cs + gap;
      const tw = Math.max(200, maxW - cs - gap);
      ctx.font = fnt(tp);
      const titleLines = wrap(ctx, song.title, tw);
      ctx.font = fnt(ap);
      const artistLines = song.artist ? wrap(ctx, song.artist, tw) : [];
      const th = titleLines.length * tp * 1.3 + artistLines.length * ap * 1.35;
      drawCover(x, y);
      let ty = y + Math.max(0, (cs - th) / 2);
      ctx.font = fnt(tp);
      for (const line of titleLines) {
        ty += tp * 1.3;
        put(line, ty, tx);
      }
      ctx.font = fnt(ap);
      for (const line of artistLines) {
        ty += ap * 1.35;
        put(line, ty, tx);
      }
      y += Math.max(cs, th);
    }

    if (o.showLyric && o.lyric.trim()) {
      y += 34 * s;
      const size = 46 * s;
      ctx.font = fnt(size, true);
      for (const line of wrap(ctx, `“${o.lyric.trim()}”`, maxW)) {
        y += size * 1.4;
        put(line, y);
      }
    }
    y += 30 * s;
  }

  return y - y0;
}

function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          aria-pressed={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={`focus-ring rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
            value === opt.id
              ? "border-primary bg-primary/15 text-primary"
              : "border-hairline text-muted hover:text-ink"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CardStudio({ data, onClose }: { data: StudioData; onClose: () => void }) {
  const song = data.song ?? null;
  const [o, setO] = useState<Opts>({
    bgMode: "gen",
    palette: 0,
    seed: 1,
    overlay: 0.15,
    title: "Menfess Songs",
    labels: { to: "To:", from: "From:", message: "Message:", song: "Songs:" },
    to: data.toName ?? "",
    from: data.fromName || "Anonim",
    message: data.message,
    showSong: Boolean(song),
    showLyric: Boolean(data.songLyric),
    lyric: data.songLyric ?? "",
    font: "script",
    color: PALETTES[0].text,
    scale: 1,
    align: "left",
    ratio: "story",
  });
  const set = (patch: Partial<Opts>) => setO((p) => ({ ...p, ...patch }));
  const setLabel = (patch: Partial<Labels>) =>
    setO((p) => ({ ...p, labels: { ...p.labels, ...patch } }));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgUrlRef = useRef<string | null>(null);
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [cover, setCover] = useState<HTMLImageElement | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [canShare, setCanShare] = useState(false);

  // Cover lewat route kita sendiri supaya kanvas tidak "tercemar" (bisa diunduh).
  useEffect(() => {
    if (!song?.id) {
      setCover(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setCover(img);
    };
    img.onerror = () => {
      if (!cancelled) setCover(null);
    };
    img.src = `/api/songs/cover?id=${encodeURIComponent(song.id)}`;
    return () => {
      cancelled = true;
    };
  }, [song?.id]);

  useEffect(() => {
    try {
      const f = new File([new Blob(["x"])], "a.png", { type: "image/png" });
      setCanShare(Boolean(navigator.canShare?.({ files: [f] })));
    } catch {
      setCanShare(false);
    }
  }, []);

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
      if (bgUrlRef.current) URL.revokeObjectURL(bgUrlRef.current);
    };
  }, [onClose]);

  // Gambar ulang setiap ada perubahan.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w: W, h: H } = SIZES[o.ratio];
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawBackground(ctx, W, H, o, bgImg);
    let s = o.scale;
    let h = layout(ctx, o, song, cover, W, s, 0, true);
    while (h > H * 0.86 && s > 0.35) {
      s -= 0.05;
      h = layout(ctx, o, song, cover, W, s, 0, true);
    }
    const y0 = Math.max(H * 0.07, (H - h) / 2);
    layout(ctx, o, song, cover, W, s, y0, false);
  }, [o, bgImg, cover, song]);

  function loadFile(file: File) {
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Gambar terlalu besar (maks 12 MB).");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (bgUrlRef.current) URL.revokeObjectURL(bgUrlRef.current);
      bgUrlRef.current = url;
      setBgImg(img);
      set({ bgMode: "image" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Gambar tidak bisa dibaca.");
    };
    img.src = url;
  }

  function toBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const c = canvasRef.current;
      if (!c) return resolve(null);
      try {
        c.toBlob((b) => resolve(b), "image/png");
      } catch {
        resolve(null);
      }
    });
  }

  async function download() {
    const blob = await toBlob();
    if (!blob) {
      setError("Gagal membuat gambar.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `menfess-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function share() {
    const blob = await toBlob();
    if (!blob) {
      setError("Gagal membuat gambar.");
      return;
    }
    try {
      await navigator.share({
        files: [new File([blob], "menfess.png", { type: "image/png" })],
      });
    } catch {
      /* dibatalkan */
    }
  }

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(true);
    },
    onDragLeave: () => setDrag(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files?.[0];
      if (f) loadFile(f);
    },
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Kartu pesan"
        className="glass-panel mx-auto my-4 w-full max-w-4xl rounded-2xl border border-hairline p-4 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Kartu pesan</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="focus-ring rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3 self-start md:sticky md:top-4" {...dropHandlers}>
            <div
              className={`rounded-xl p-1 ${drag ? "ring-2 ring-primary" : ""}`}
              title="Seret foto ke sini untuk jadi latar"
            >
              <canvas
                ref={canvasRef}
                className="mx-auto block rounded-lg shadow-lift"
                style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "60vh" }}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={download} className="btn-primary flex-1">
                Unduh PNG
              </button>
              {canShare && (
                <button type="button" onClick={share} className="btn-ghost flex-1">
                  Bagikan
                </button>
              )}
            </div>
            {error && <p className="text-xs text-warning">{error}</p>}
          </div>

          <div className="space-y-5">
            <section className="space-y-2">
              <p className="label">Latar</p>
              <div className="flex flex-wrap items-center gap-2">
                {PALETTES.map((p, i) => (
                  <button
                    key={p.name}
                    type="button"
                    title={p.name}
                    aria-label={`Latar ${p.name}`}
                    aria-pressed={o.bgMode === "gen" && o.palette === i}
                    onClick={() => set({ bgMode: "gen", palette: i, color: p.text })}
                    style={{
                      background: `linear-gradient(135deg, ${p.stops[0]}, ${p.stops[1]}, ${p.stops[2]})`,
                    }}
                    className={`focus-ring h-9 w-9 rounded-full border-2 ${
                      o.bgMode === "gen" && o.palette === i ? "border-primary" : "border-hairline"
                    }`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => set({ bgMode: "gen", seed: o.seed + 1 })}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  Acak
                </button>
              </div>
              <label
                className={`flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed p-4 text-center text-xs text-muted ${
                  drag ? "border-primary bg-primary/10" : "border-hairline"
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadFile(f);
                    e.target.value = "";
                  }}
                />
                {bgImg && o.bgMode === "image"
                  ? "Ganti foto (seret atau ketuk)"
                  : "Seret foto ke sini atau ketuk untuk pilih"}
              </label>
              {bgImg && o.bgMode === "gen" && (
                <button
                  type="button"
                  onClick={() => set({ bgMode: "image" })}
                  className="text-xs font-semibold text-primary"
                >
                  Pakai foto tadi
                </button>
              )}
              {o.bgMode === "image" && (
                <label className="block text-xs text-muted">
                  Penutup latar
                  <input
                    type="range"
                    min={0}
                    max={0.8}
                    step={0.05}
                    value={o.overlay}
                    onChange={(e) => set({ overlay: Number(e.target.value) })}
                    className="mt-1 w-full"
                  />
                </label>
              )}
            </section>

            <section className="space-y-2">
              <p className="label">Teks</p>
              <input
                value={o.title}
                onChange={(e) => set({ title: e.target.value })}
                maxLength={40}
                placeholder="Judul kartu"
                aria-label="Judul kartu"
                className="input"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={o.labels.to}
                  onChange={(e) => setLabel({ to: e.target.value })}
                  maxLength={20}
                  aria-label="Label untuk"
                  className="input text-xs"
                />
                <input
                  value={o.to}
                  onChange={(e) => set({ to: e.target.value })}
                  maxLength={40}
                  placeholder="Untuk siapa"
                  aria-label="Untuk siapa"
                  className="input"
                />
                <input
                  value={o.labels.from}
                  onChange={(e) => setLabel({ from: e.target.value })}
                  maxLength={20}
                  aria-label="Label dari"
                  className="input text-xs"
                />
                <input
                  value={o.from}
                  onChange={(e) => set({ from: e.target.value })}
                  maxLength={40}
                  placeholder="Dari"
                  aria-label="Dari"
                  className="input"
                />
                <input
                  value={o.labels.message}
                  onChange={(e) => setLabel({ message: e.target.value })}
                  maxLength={20}
                  aria-label="Label pesan"
                  className="input text-xs"
                />
                <span />
              </div>
              <textarea
                value={o.message}
                onChange={(e) => set({ message: e.target.value })}
                maxLength={1000}
                rows={3}
                aria-label="Pesan"
                className="input resize-y"
              />
            </section>

            {song && (
              <section className="space-y-2">
                <p className="label">Lagu</p>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={o.showSong}
                    onChange={(e) => set({ showSong: e.target.checked })}
                  />
                  Tampilkan lagu
                </label>
                {o.showSong && (
                  <>
                    <input
                      value={o.labels.song}
                      onChange={(e) => setLabel({ song: e.target.value })}
                      maxLength={20}
                      aria-label="Label lagu"
                      className="input text-xs"
                    />
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={o.showLyric}
                        onChange={(e) => set({ showLyric: e.target.checked })}
                      />
                      Tampilkan kutipan lirik
                    </label>
                    {o.showLyric && (
                      <textarea
                        value={o.lyric}
                        onChange={(e) => set({ lyric: e.target.value })}
                        maxLength={200}
                        rows={2}
                        placeholder="Kutipan lirik"
                        aria-label="Kutipan lirik"
                        className="input resize-y"
                      />
                    )}
                  </>
                )}
              </section>
            )}

            <section className="space-y-3">
              <p className="label">Tampilan</p>
              <Seg
                label="Ukuran"
                value={o.ratio}
                onChange={(v) => set({ ratio: v })}
                options={(Object.keys(SIZES) as Ratio[]).map((id) => ({
                  id,
                  label: SIZES[id].label,
                }))}
              />
              <Seg
                label="Font"
                value={o.font}
                onChange={(v) => set({ font: v })}
                options={FONTS.map((f) => ({ id: f.id, label: f.label }))}
              />
              <Seg
                label="Rata teks"
                value={o.align}
                onChange={(v) => set({ align: v })}
                options={[
                  { id: "left", label: "Kiri" },
                  { id: "center", label: "Tengah" },
                ]}
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted">
                  Warna teks
                  <input
                    type="color"
                    value={o.color}
                    onChange={(e) => set({ color: e.target.value })}
                    className="h-8 w-10 cursor-pointer rounded border border-hairline bg-transparent"
                  />
                </label>
                <label className="flex-1 text-xs text-muted">
                  Ukuran teks
                  <input
                    type="range"
                    min={0.6}
                    max={1.4}
                    step={0.05}
                    value={o.scale}
                    onChange={(e) => set({ scale: Number(e.target.value) })}
                    className="mt-1 w-full"
                  />
                </label>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Tombol pembuka studio kartu. */
export function CardStudioButton({
  data,
  className,
  children,
}: {
  data: StudioData;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "focus-ring rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
        }
      >
        {children ?? "Kartu"}
      </button>
      {open && <CardStudio data={data} onClose={() => setOpen(false)} />}
    </>
  );
}
