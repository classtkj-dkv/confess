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

type Align = "left" | "center" | "right";
type Ratio = "story" | "post" | "square";
type FontId = "script" | "serif" | "sans" | "mono";
type ElId = "title" | "to" | "from" | "message" | "song" | "lyric";

const EL_IDS: ElId[] = ["title", "to", "from", "message", "song", "lyric"];
const EL_NAMES: Record<ElId, string> = {
  title: "Judul",
  to: "Untuk",
  from: "Dari",
  message: "Pesan",
  song: "Lagu",
  lyric: "Lirik",
};
const HAS_LABEL: Record<ElId, boolean> = {
  title: false,
  to: true,
  from: true,
  message: true,
  song: true,
  lyric: false,
};

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

/** Pengaturan satu elemen di kartu. Posisi & lebar dalam pecahan lebar/tinggi kanvas. */
interface El {
  visible: boolean;
  x: number;
  y: number;
  w: number;
  size: number;
  align: Align;
  /** Kosong = ikut warna utama. */
  color: string;
  showLabel: boolean;
  label: string;
}

/** Semua pengaturan tampilan. Inilah yang disimpan sebagai template (tanpa isi pesan). */
interface Design {
  ratio: Ratio;
  bgMode: "gen" | "image";
  palette: number;
  seed: number;
  overlay: number;
  font: FontId;
  color: string;
  title: string;
  els: Record<ElId, El>;
}

interface Content {
  to: string;
  from: string;
  message: string;
  lyric: string;
  song: Song | null;
}

interface Template {
  id: string;
  name: string;
  updatedAt: number;
  design: Design;
  bg: Blob | null;
  thumb: string;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Boxes = Partial<Record<ElId, Box>>;

/* ───────────── util kanvas ───────────── */

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

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img"));
    img.src = src;
  });
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  d: Design,
  bg: HTMLImageElement | null
) {
  if (d.bgMode === "image" && bg) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const k = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
    const dw = bg.naturalWidth * k;
    const dh = bg.naturalHeight * k;
    ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    if (d.overlay > 0) {
      ctx.fillStyle = `rgba(${isLight(d.color) ? "0,0,0" : "255,255,255"},${d.overlay})`;
      ctx.fillRect(0, 0, W, H);
    }
    return;
  }
  const p = PALETTES[d.palette] ?? PALETTES[0];
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, p.stops[0]);
  g.addColorStop(0.55, p.stops[1]);
  g.addColorStop(1, p.stops[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const rand = rng(d.seed * 7919 + 13);
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

/**
 * Menggambar satu elemen di posisinya sendiri (atau di yOverride).
 * dry=true hanya mengukur. Mengembalikan kotak elemen, atau null bila tidak ada isi.
 */
function drawEl(
  ctx: CanvasRenderingContext2D,
  id: ElId,
  d: Design,
  c: Content,
  cover: HTMLImageElement | null,
  W: number,
  H: number,
  dry: boolean,
  yOverride?: number,
  k = 1
): Box | null {
  const el = d.els[id];
  const font = FONTS.find((f) => f.id === d.font) ?? FONTS[0];
  const bx = el.x * W;
  const by = yOverride ?? el.y * H;
  const bw = el.w * W;
  const sz = el.size * k;
  const color = el.color || d.color;
  const ax = el.align === "left" ? bx : el.align === "center" ? bx + bw / 2 : bx + bw;
  const fnt = (px: number, italic = false) =>
    `${italic ? "italic " : ""}${Math.max(8, Math.round(px))}px ${font.css}`;

  ctx.textAlign = el.align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;

  let y = by;
  const put = (text: string, py: number, px = ax) => {
    if (!dry) ctx.fillText(text, px, py);
  };
  const label = () => {
    if (!HAS_LABEL[id] || !el.showLabel || !el.label.trim()) return;
    const lp = 58 * sz;
    ctx.font = fnt(lp, true);
    y += lp * 1.1;
    put(el.label.trim(), y);
    y += lp * 0.2;
  };
  const value = (text: string) => {
    const vp = 52 * sz;
    ctx.font = fnt(vp);
    for (const line of wrap(ctx, text, bw)) {
      y += vp * 1.35;
      put(line, y);
    }
  };

  if (id === "title") {
    const text = d.title.trim();
    if (!text) return null;
    const px = 150 * sz;
    ctx.font = fnt(px, font.italic);
    for (const line of wrap(ctx, text, bw)) {
      y += px * 0.95;
      put(line, y);
      y += px * 0.12;
    }
  } else if (id === "to" || id === "from" || id === "message") {
    const text = c[id].trim();
    if (!text) return null;
    label();
    value(text);
  } else if (id === "song") {
    const song = c.song;
    if (!song) return null;
    label();
    y += 10 * sz;
    const stacked = el.align === "center";
    const cs = Math.min(260 * sz, bw * (stacked ? 0.7 : 0.38));
    const tp = 52 * sz;
    const ap = 42 * sz;
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
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.font = fnt(cs * 0.45);
        ctx.fillText("♪", cx + cs / 2, cy + cs * 0.65);
      }
      ctx.restore();
    };

    if (stacked) {
      drawCover(bx + bw / 2 - cs / 2, y);
      y += cs + 28 * sz;
      ctx.font = fnt(tp);
      for (const line of wrap(ctx, song.title, bw)) {
        y += tp * 1.3;
        put(line, y);
      }
      if (song.artist) {
        ctx.font = fnt(ap);
        for (const line of wrap(ctx, song.artist, bw)) {
          y += ap * 1.35;
          put(line, y);
        }
      }
    } else {
      const gap = 32 * sz;
      const tw = Math.max(120, bw - cs - gap);
      const left = el.align === "left";
      const coverX = left ? bx : bx + bw - cs;
      const textX = left ? bx + cs + gap : bx + bw - cs - gap;
      ctx.font = fnt(tp);
      const titleLines = wrap(ctx, song.title, tw);
      ctx.font = fnt(ap);
      const artistLines = song.artist ? wrap(ctx, song.artist, tw) : [];
      const th = titleLines.length * tp * 1.3 + artistLines.length * ap * 1.35;
      drawCover(coverX, y);
      let ty = y + Math.max(0, (cs - th) / 2);
      ctx.font = fnt(tp);
      for (const line of titleLines) {
        ty += tp * 1.3;
        put(line, ty, textX);
      }
      ctx.font = fnt(ap);
      for (const line of artistLines) {
        ty += ap * 1.35;
        put(line, ty, textX);
      }
      y += Math.max(cs, th);
    }
  } else {
    // lyric
    const text = c.lyric.trim();
    if (!c.song || !text) return null;
    const px = 46 * sz;
    ctx.font = fnt(px, true);
    for (const line of wrap(ctx, `“${text}”`, bw)) {
      y += px * 1.4;
      put(line, y);
    }
  }

  return { x: bx, y: by, w: bw, h: Math.max(8, y - by) };
}

function renderCard(
  canvas: HTMLCanvasElement,
  d: Design,
  c: Content,
  bg: HTMLImageElement | null,
  cover: HTMLImageElement | null,
  guides: { selected: ElId | null; snapX: boolean } | null
): Boxes {
  const { w: W, h: H } = SIZES[d.ratio];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return {};
  drawBackground(ctx, W, H, d, bg);
  const boxes: Boxes = {};
  for (const id of EL_IDS) {
    if (!d.els[id].visible) continue;
    const b = drawEl(ctx, id, d, c, cover, W, H, false);
    if (b) boxes[id] = b;
  }
  if (guides) {
    ctx.save();
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 10]);
    if (guides.snapX) {
      ctx.strokeStyle = "rgba(255,0,110,0.9)";
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
    }
    const sel = guides.selected ? boxes[guides.selected] : undefined;
    if (sel) {
      ctx.strokeStyle = "#2f80ff";
      ctx.strokeRect(sel.x - 12, sel.y - 12, sel.w + 24, sel.h + 24);
    }
    ctx.restore();
  }
  return boxes;
}

/** Menyusun elemen yang tampil dari atas ke bawah, di tengah, dan muat di kartu. */
function autoLayout(d: Design, c: Content): Design {
  const { w: W, h: H } = SIZES[d.ratio];
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return d;
  const norm: Design = {
    ...d,
    els: Object.fromEntries(
      EL_IDS.map((id) => [id, { ...d.els[id], x: 0.09, w: 0.82 }])
    ) as Record<ElId, El>,
  };
  const gap = 56;
  let k = 1;
  let heights: Partial<Record<ElId, number>> = {};
  let total = 0;
  for (let i = 0; i < 12; i++) {
    heights = {};
    total = 0;
    for (const id of EL_IDS) {
      if (!norm.els[id].visible) continue;
      const b = drawEl(ctx, id, norm, c, null, W, H, true, 0, k);
      if (b) {
        heights[id] = b.h;
        total += b.h + gap;
      }
    }
    total = Math.max(0, total - gap);
    if (total <= H * 0.86 || k <= 0.4) break;
    k *= 0.92;
  }
  let y = Math.max(H * 0.07, (H - total) / 2);
  const els = { ...norm.els };
  for (const id of EL_IDS) {
    const h = heights[id];
    const base = norm.els[id];
    if (h !== undefined) {
      els[id] = { ...base, size: base.size * k, y: y / H };
      y += h + gap;
    } else {
      els[id] = { ...base, y: Math.min(0.9, y / H) };
    }
  }
  return { ...norm, els };
}

function defaultDesign(content: Content, hasLyric: boolean): Design {
  const base: El = {
    visible: true,
    x: 0.09,
    y: 0.1,
    w: 0.82,
    size: 1,
    align: "left",
    color: "",
    showLabel: true,
    label: "",
  };
  const d: Design = {
    ratio: "story",
    bgMode: "gen",
    palette: 0,
    seed: 1,
    overlay: 0.15,
    font: "script",
    color: PALETTES[0].text,
    title: content.song ? "Menfess Songs" : "Menfess",
    els: {
      title: { ...base, showLabel: false },
      to: { ...base, label: "To:" },
      from: { ...base, label: "From:" },
      message: { ...base, label: "Message:" },
      song: { ...base, label: "Songs:", visible: Boolean(content.song) },
      lyric: { ...base, showLabel: false, visible: hasLyric },
    },
  };
  return autoLayout(d, content);
}

/** Gabungkan template lama/baru dengan nilai bawaan supaya tidak ada field yang hilang. */
function mergeDesign(saved: Design, fallback: Design): Design {
  return {
    ...fallback,
    ...saved,
    els: Object.fromEntries(
      EL_IDS.map((id) => [id, { ...fallback.els[id], ...(saved.els?.[id] ?? {}) }])
    ) as Record<ElId, El>,
  };
}

/* ───────────── penyimpanan template (IndexedDB, hanya di perangkat ini) ───────────── */

const DB_NAME = "confess-studio";
const STORE = "templates";
const LAST_KEY = "studio:lastTemplate";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbRun<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    const fail = () => {
      db.close();
      reject(tx.error);
    };
    tx.onerror = fail;
    tx.onabort = fail;
  });
}

async function listTemplates(): Promise<Template[]> {
  const all = await dbRun<Template[]>("readonly", (s) => s.getAll() as IDBRequest<Template[]>);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/* ───────────── komponen kecil ───────────── */

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

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
      />
    </label>
  );
}

/* ───────────── studio ───────────── */

function CardStudio({ data, onClose }: { data: StudioData; onClose: () => void }) {
  const [content, setContent] = useState<Content>(() => ({
    to: data.toName ?? "",
    from: data.fromName || "Anonim",
    message: data.message,
    lyric: data.songLyric ?? "",
    song: data.song ?? null,
  }));
  const [design, setDesign] = useState<Design>(() =>
    defaultDesign(
      {
        to: data.toName ?? "",
        from: data.fromName || "Anonim",
        message: data.message,
        lyric: data.songLyric ?? "",
        song: data.song ?? null,
      },
      Boolean(data.songLyric)
    )
  );
  const [selected, setSelected] = useState<ElId | null>("message");
  const [snapX, setSnapX] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxesRef = useRef<Boxes>({});
  const designRef = useRef(design);
  designRef.current = design;
  const dragRef = useRef<{ id: ElId; dx: number; dy: number } | null>(null);
  const touched = useRef(false);
  const bgUrlRef = useRef<string | null>(null);

  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [bgBlob, setBgBlob] = useState<Blob | null>(null);
  const [cover, setCover] = useState<HTMLImageElement | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [canShare, setCanShare] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplBusy, setTplBusy] = useState(false);

  const song = content.song;

  const setD = (patch: Partial<Design>) => setDesign((p) => ({ ...p, ...patch }));
  const setEl = (id: ElId, patch: Partial<El>) =>
    setDesign((p) => ({ ...p, els: { ...p.els, [id]: { ...p.els[id], ...patch } } }));
  const setC = (patch: Partial<Content>) => setContent((p) => ({ ...p, ...patch }));

  /** Susun ulang otomatis hanya bila pengguna belum mengatur posisi manual. */
  function relayoutIfFresh(next: Design, nextContent: Content = content): Design {
    return touched.current ? next : autoLayout(next, nextContent);
  }

  /* cover lewat route kita sendiri agar kanvas bisa diekspor */
  useEffect(() => {
    if (!song?.id) {
      setCover(null);
      return;
    }
    let cancelled = false;
    loadImg(`/api/songs/cover?id=${encodeURIComponent(song.id)}`)
      .then((img) => {
        if (!cancelled) setCover(img);
      })
      .catch(() => {
        if (!cancelled) setCover(null);
      });
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

  /* gambar ulang setiap ada perubahan */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    boxesRef.current = renderCard(canvas, design, content, bgImg, cover, { selected, snapX });
  }, [design, content, bgImg, cover, selected, snapX]);

  /* template tersimpan: muat daftar, lalu pakai template terakhir */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listTemplates();
        if (cancelled) return;
        setTemplates(list);
        let lastId: string | null = null;
        try {
          lastId = localStorage.getItem(LAST_KEY);
        } catch {
          /* abaikan */
        }
        const last = list.find((t) => t.id === lastId);
        if (last) await applyTemplate(last, true);
      } catch {
        /* IndexedDB tidak tersedia: studio tetap jalan tanpa template */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── latar ── */
  async function loadFile(file: File) {
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Gambar terlalu besar (maks 20 MB).");
      return;
    }
    try {
      // Perkecil dulu (maks 2200px) agar ringan dan hemat penyimpanan template.
      const srcUrl = URL.createObjectURL(file);
      const raw = await loadImg(srcUrl);
      const k = Math.min(1, 2200 / Math.max(raw.naturalWidth, raw.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(raw.naturalWidth * k));
      c.height = Math.max(1, Math.round(raw.naturalHeight * k));
      c.getContext("2d")?.drawImage(raw, 0, 0, c.width, c.height);
      URL.revokeObjectURL(srcUrl);
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.9));
      if (!blob) throw new Error("blob");
      await applyBackground(blob);
      setD({ bgMode: "image" });
    } catch {
      setError("Gambar tidak bisa dibaca.");
    }
  }

  async function applyBackground(blob: Blob | null) {
    if (bgUrlRef.current) {
      URL.revokeObjectURL(bgUrlRef.current);
      bgUrlRef.current = null;
    }
    if (!blob) {
      setBgImg(null);
      setBgBlob(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    const img = await loadImg(url);
    bgUrlRef.current = url;
    setBgImg(img);
    setBgBlob(blob);
  }

  /* ── template ── */
  async function applyTemplate(t: Template, silent = false) {
    try {
      await applyBackground(t.bg);
      const base = defaultDesign(
        {
          to: data.toName ?? "",
          from: data.fromName || "Anonim",
          message: data.message,
          lyric: data.songLyric ?? "",
          song: data.song ?? null,
        },
        Boolean(data.songLyric)
      );
      setDesign(mergeDesign({ ...t.design, bgMode: t.bg ? "image" : t.design.bgMode }, base));
      touched.current = true; // tata letak template dihormati, tidak disusun ulang otomatis
      setActiveId(t.id);
      try {
        localStorage.setItem(LAST_KEY, t.id);
      } catch {
        /* abaikan */
      }
    } catch {
      if (!silent) setError("Template tidak bisa dipakai.");
    }
  }

  function makeThumb(): string {
    try {
      const full = document.createElement("canvas");
      renderCard(full, designRef.current, content, bgImg, cover, null);
      const t = document.createElement("canvas");
      t.width = 160;
      t.height = Math.round((160 * full.height) / full.width);
      t.getContext("2d")?.drawImage(full, 0, 0, t.width, t.height);
      return t.toDataURL("image/jpeg", 0.7);
    } catch {
      return "";
    }
  }

  async function saveTemplate(asNew: boolean) {
    setError("");
    setTplBusy(true);
    try {
      const existing = !asNew ? templates.find((t) => t.id === activeId) : undefined;
      const id = existing?.id ?? `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const t: Template = {
        id,
        name: existing?.name ?? (tplName.trim().slice(0, 30) || `Template ${templates.length + 1}`),
        updatedAt: Date.now(),
        design: JSON.parse(JSON.stringify(designRef.current)) as Design,
        bg: designRef.current.bgMode === "image" ? bgBlob : null,
        thumb: makeThumb(),
      };
      await dbRun("readwrite", (s) => s.put(t));
      setTemplates(await listTemplates());
      setActiveId(id);
      setTplName("");
      try {
        localStorage.setItem(LAST_KEY, id);
      } catch {
        /* abaikan */
      }
    } catch {
      setError("Template tidak bisa disimpan di browser ini.");
    } finally {
      setTplBusy(false);
    }
  }

  async function removeTemplate(t: Template) {
    if (!window.confirm(`Hapus template "${t.name}"?`)) return;
    try {
      await dbRun("readwrite", (s) => s.delete(t.id));
      setTemplates(await listTemplates());
      if (activeId === t.id) {
        setActiveId(null);
        try {
          localStorage.removeItem(LAST_KEY);
        } catch {
          /* abaikan */
        }
      }
    } catch {
      setError("Template tidak bisa dihapus.");
    }
  }

  /* ── ekspor ── */
  function toBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      try {
        const c = document.createElement("canvas");
        renderCard(c, designRef.current, content, bgImg, cover, null);
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
      await navigator.share({ files: [new File([blob], "menfess.png", { type: "image/png" })] });
    } catch {
      /* dibatalkan */
    }
  }

  /* ── geser elemen di kanvas ── */
  function toCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = toCanvasPoint(e);
    const order = [...EL_IDS].reverse(); // yang paling atas dicek lebih dulu
    const hit = order.find((id) => {
      const b = boxesRef.current[id];
      return b && p.x >= b.x - 20 && p.x <= b.x + b.w + 20 && p.y >= b.y - 20 && p.y <= b.y + b.h + 20;
    });
    if (!hit) {
      setSelected(null);
      return;
    }
    const b = boxesRef.current[hit] as Box;
    setSelected(hit);
    dragRef.current = { id: hit, dx: p.x - b.x, dy: p.y - b.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const dr = dragRef.current;
    if (!dr) return;
    const { w: W, h: H } = SIZES[designRef.current.ratio];
    const el = designRef.current.els[dr.id];
    const p = toCanvasPoint(e);
    let nx = (p.x - dr.dx) / W;
    const ny = (p.y - dr.dy) / H;
    const snapped = Math.abs(nx + el.w / 2 - 0.5) < 0.015;
    if (snapped) nx = 0.5 - el.w / 2;
    setSnapX(snapped);
    touched.current = true;
    setEl(dr.id, {
      x: Math.min(1 - el.w / 2, Math.max(-el.w / 2, nx)),
      y: Math.min(0.98, Math.max(-0.02, ny)),
    });
  }

  function endDrag() {
    dragRef.current = null;
    setSnapX(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    if (!selected) return;
    const step = e.shiftKey ? 0.02 : 0.004;
    const el = designRef.current.els[selected];
    const move: Record<string, Partial<El>> = {
      ArrowLeft: { x: el.x - step },
      ArrowRight: { x: el.x + step },
      ArrowUp: { y: el.y - step },
      ArrowDown: { y: el.y + step },
    };
    const patch = move[e.key];
    if (!patch) return;
    e.preventDefault();
    touched.current = true;
    setEl(selected, patch);
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
      if (f) void loadFile(f);
    },
  };

  const available = (id: ElId) => id !== "song" && id !== "lyric" ? true : Boolean(song);
  const sel = selected && available(selected) ? design.els[selected] : null;
  const active = templates.find((t) => t.id === activeId) ?? null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Kartu pesan"
        className="glass-panel mx-auto my-4 w-full max-w-5xl rounded-2xl border border-hairline p-4 shadow-lift"
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

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* ── pratinjau ── */}
          <div className="space-y-3 self-start md:sticky md:top-4" {...dropHandlers}>
            <div className={`rounded-xl p-1 ${drag ? "ring-2 ring-primary" : ""}`}>
              <canvas
                ref={canvasRef}
                tabIndex={0}
                aria-label="Pratinjau kartu. Geser teks untuk memindahkan."
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onKeyDown}
                className="mx-auto block rounded-lg shadow-lift outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{
                  width: "auto",
                  height: "auto",
                  maxWidth: "100%",
                  maxHeight: "62vh",
                  touchAction: "none",
                  cursor: "grab",
                }}
              />
            </div>
            <p className="text-center text-[11px] text-muted">
              Ketuk lalu geser teks untuk memindahkan. Panah keyboard untuk geser halus.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void download()} className="btn-primary flex-1">
                Unduh PNG
              </button>
              {canShare && (
                <button type="button" onClick={() => void share()} className="btn-ghost flex-1">
                  Bagikan
                </button>
              )}
            </div>
            {error && <p className="text-xs text-warning">{error}</p>}
          </div>

          {/* ── pengaturan ── */}
          <div className="space-y-5">
            <section className="space-y-2">
              <p className="label">Template (tersimpan di HP ini)</p>
              {templates.length > 0 && (
                <ul className="flex gap-2 overflow-x-auto pb-1">
                  {templates.map((t) => (
                    <li key={t.id} className="w-20 shrink-0">
                      <button
                        type="button"
                        onClick={() => void applyTemplate(t)}
                        aria-pressed={activeId === t.id}
                        className={`focus-ring block w-full overflow-hidden rounded-lg border-2 ${
                          activeId === t.id ? "border-primary" : "border-hairline"
                        }`}
                        title={t.name}
                      >
                        {t.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.thumb} alt={t.name} className="block h-28 w-full object-cover" />
                        ) : (
                          <span className="grid h-28 place-items-center text-xs text-muted">
                            {t.name}
                          </span>
                        )}
                      </button>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <span className="truncate text-[11px] text-ink">{t.name}</span>
                        <button
                          type="button"
                          onClick={() => void removeTemplate(t)}
                          aria-label={`Hapus template ${t.name}`}
                          className="focus-ring rounded px-1 text-[11px] text-muted hover:text-ink"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {active && (
                  <button
                    type="button"
                    disabled={tplBusy}
                    onClick={() => void saveTemplate(false)}
                    className="btn-primary px-3 py-1.5 text-xs"
                  >
                    Simpan ke “{active.name}”
                  </button>
                )}
                <input
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  maxLength={30}
                  placeholder="Nama template baru"
                  aria-label="Nama template baru"
                  className="input min-w-0 flex-1 py-1.5 text-xs"
                />
                <button
                  type="button"
                  disabled={tplBusy}
                  onClick={() => void saveTemplate(true)}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  Simpan baru
                </button>
              </div>
              <p className="text-[11px] text-muted">
                Menyimpan latar foto, posisi, ukuran, dan semua pengaturan. Template terakhir
                dipakai otomatis dan hanya ada di perangkat ini.
              </p>
            </section>

            <section className="space-y-2">
              <p className="label">Latar</p>
              <div className="flex flex-wrap items-center gap-2">
                {PALETTES.map((p, i) => (
                  <button
                    key={p.name}
                    type="button"
                    title={p.name}
                    aria-label={`Latar ${p.name}`}
                    aria-pressed={design.bgMode === "gen" && design.palette === i}
                    onClick={() => setD({ bgMode: "gen", palette: i, color: p.text })}
                    style={{
                      background: `linear-gradient(135deg, ${p.stops[0]}, ${p.stops[1]}, ${p.stops[2]})`,
                    }}
                    className={`focus-ring h-9 w-9 rounded-full border-2 ${
                      design.bgMode === "gen" && design.palette === i
                        ? "border-primary"
                        : "border-hairline"
                    }`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setD({ bgMode: "gen", seed: design.seed + 1 })}
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
                    if (f) void loadFile(f);
                    e.target.value = "";
                  }}
                />
                {bgImg && design.bgMode === "image"
                  ? "Ganti foto (seret atau ketuk)"
                  : "Seret foto ke sini atau ketuk untuk pilih"}
              </label>
              {bgImg && design.bgMode === "gen" && (
                <button
                  type="button"
                  onClick={() => setD({ bgMode: "image" })}
                  className="text-xs font-semibold text-primary"
                >
                  Pakai foto tadi
                </button>
              )}
              {design.bgMode === "image" && (
                <Range
                  label="Penutup latar"
                  value={design.overlay}
                  min={0}
                  max={0.8}
                  step={0.05}
                  onChange={(v) => setD({ overlay: v })}
                />
              )}
            </section>

            <section className="space-y-2">
              <p className="label">Isi</p>
              <input
                value={design.title}
                onChange={(e) => setD({ title: e.target.value })}
                maxLength={40}
                placeholder="Judul kartu"
                aria-label="Judul kartu"
                className="input"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={content.to}
                  onChange={(e) => setC({ to: e.target.value })}
                  maxLength={40}
                  placeholder="Untuk siapa"
                  aria-label="Untuk siapa"
                  className="input"
                />
                <input
                  value={content.from}
                  onChange={(e) => setC({ from: e.target.value })}
                  maxLength={40}
                  placeholder="Dari"
                  aria-label="Dari"
                  className="input"
                />
              </div>
              <textarea
                value={content.message}
                onChange={(e) => setC({ message: e.target.value })}
                maxLength={1000}
                rows={3}
                aria-label="Pesan"
                className="input resize-y"
              />
              {song && (
                <textarea
                  value={content.lyric}
                  onChange={(e) => setC({ lyric: e.target.value })}
                  maxLength={200}
                  rows={2}
                  placeholder="Kutipan lirik (opsional)"
                  aria-label="Kutipan lirik"
                  className="input resize-y"
                />
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="label !mb-0">Elemen</p>
                <button
                  type="button"
                  onClick={() => {
                    touched.current = false;
                    setDesign((p) => autoLayout(p, content));
                  }}
                  className="text-xs font-semibold text-primary"
                >
                  Rapikan otomatis
                </button>
              </div>
              <ul className="space-y-1.5">
                {EL_IDS.filter(available).map((id) => (
                  <li
                    key={id}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                      selected === id ? "border-primary bg-primary/10" : "border-hairline"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={design.els[id].visible}
                      aria-label={`Tampilkan ${EL_NAMES[id]}`}
                      onChange={(e) => {
                        const next = {
                          ...design,
                          els: { ...design.els, [id]: { ...design.els[id], visible: e.target.checked } },
                        };
                        setDesign(relayoutIfFresh(next));
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setSelected(id)}
                      className="focus-ring flex-1 rounded text-left text-sm font-semibold text-ink"
                    >
                      {EL_NAMES[id]}
                    </button>
                  </li>
                ))}
              </ul>

              {selected && sel && (
                <div className="space-y-3 rounded-xl border border-hairline bg-surface p-3">
                  <p className="text-xs font-semibold text-ink">Atur: {EL_NAMES[selected]}</p>
                  {HAS_LABEL[selected] && (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={sel.showLabel}
                          onChange={(e) => setEl(selected, { showLabel: e.target.checked })}
                        />
                        Label
                      </label>
                      <input
                        value={sel.label}
                        onChange={(e) => setEl(selected, { label: e.target.value })}
                        maxLength={20}
                        disabled={!sel.showLabel}
                        aria-label="Teks label"
                        className="input min-w-0 flex-1 py-1.5 text-xs"
                      />
                    </div>
                  )}
                  <Range
                    label="Ukuran"
                    value={sel.size}
                    min={0.4}
                    max={2.5}
                    step={0.05}
                    onChange={(v) => setEl(selected, { size: v })}
                  />
                  <Range
                    label="Lebar kotak teks"
                    value={sel.w}
                    min={0.2}
                    max={1}
                    step={0.02}
                    onChange={(v) => setEl(selected, { w: v })}
                  />
                  <Seg
                    label="Rata teks"
                    value={sel.align}
                    onChange={(v) => setEl(selected, { align: v })}
                    options={[
                      { id: "left", label: "Kiri" },
                      { id: "center", label: "Tengah" },
                      { id: "right", label: "Kanan" },
                    ]}
                  />
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-muted">
                      Warna
                      <input
                        type="color"
                        value={sel.color || design.color}
                        onChange={(e) => setEl(selected, { color: e.target.value })}
                        className="h-8 w-10 cursor-pointer rounded border border-hairline bg-transparent"
                      />
                    </label>
                    {sel.color && (
                      <button
                        type="button"
                        onClick={() => setEl(selected, { color: "" })}
                        className="text-xs font-semibold text-primary"
                      >
                        Ikuti warna utama
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <p className="label">Tampilan umum</p>
              <Seg
                label="Ukuran kartu"
                value={design.ratio}
                onChange={(v) => setDesign((p) => relayoutIfFresh({ ...p, ratio: v }))}
                options={(Object.keys(SIZES) as Ratio[]).map((id) => ({
                  id,
                  label: SIZES[id].label,
                }))}
              />
              <Seg
                label="Font"
                value={design.font}
                onChange={(v) => setDesign((p) => relayoutIfFresh({ ...p, font: v }))}
                options={FONTS.map((f) => ({ id: f.id, label: f.label }))}
              />
              <label className="flex items-center gap-2 text-xs text-muted">
                Warna utama
                <input
                  type="color"
                  value={design.color}
                  onChange={(e) => setD({ color: e.target.value })}
                  className="h-8 w-10 cursor-pointer rounded border border-hairline bg-transparent"
                />
              </label>
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
