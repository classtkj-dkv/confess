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
type ElId = "title" | "to" | "from" | "message" | "song" | "lyric";
type SongStyle = "vinyl" | "cover" | "pill" | "card" | "cassette" | "text";
type BgMode = "gen" | "custom" | "image";

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

/** g = nama keluarga Google Fonts (dimuat saat studio dibuka); css = fallback bila offline. */
const FONTS: { id: string; label: string; css: string; g?: string }[] = [
  { id: "dancing", label: "Dancing Script", css: '"Dancing Script","Segoe Script",cursive', g: "Dancing+Script:wght@400;700" },
  { id: "vibes", label: "Great Vibes", css: '"Great Vibes","Snell Roundhand",cursive', g: "Great+Vibes" },
  { id: "pacifico", label: "Pacifico", css: "Pacifico,cursive", g: "Pacifico" },
  { id: "caveat", label: "Caveat", css: "Caveat,cursive", g: "Caveat:wght@400;700" },
  { id: "marker", label: "Marker", css: '"Permanent Marker",cursive', g: "Permanent+Marker" },
  { id: "playfair", label: "Playfair", css: '"Playfair Display",Georgia,serif', g: "Playfair+Display:wght@400;700" },
  { id: "serif", label: "Serif", css: 'Georgia,"Times New Roman",serif' },
  { id: "montserrat", label: "Montserrat", css: "Montserrat,system-ui,sans-serif", g: "Montserrat:wght@400;700" },
  { id: "poppins", label: "Poppins", css: "Poppins,system-ui,sans-serif", g: "Poppins:wght@400;700" },
  { id: "bebas", label: "Bebas Neue", css: '"Bebas Neue",Impact,sans-serif', g: "Bebas+Neue" },
  { id: "script", label: "Script (sistem)", css: '"Segoe Script","Snell Roundhand","Brush Script MT",cursive' },
  { id: "sans", label: "Sans (sistem)", css: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif' },
  { id: "mono", label: "Mono (sistem)", css: 'ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace' },
];
const FONT_IDS = FONTS.map((f) => f.id);

const SWATCHES = [
  "#ffffff", "#000000", "#0b3d91", "#2f80ff", "#06b6d4", "#10b981", "#84cc16", "#facc15",
  "#f97316", "#ef4444", "#ec4899", "#a855f7", "#6366f1", "#78350f", "#9ca3af", "#fde68a",
];

const SONG_STYLES: { id: SongStyle; label: string }[] = [
  { id: "vinyl", label: "Piringan" },
  { id: "cover", label: "Cover" },
  { id: "pill", label: "Pil" },
  { id: "card", label: "Kartu" },
  { id: "cassette", label: "Kaset" },
  { id: "text", label: "Teks" },
];

/** Pengaturan satu elemen. Posisi & lebar = pecahan lebar/tinggi kanvas. "" pada warna = otomatis. */
interface El {
  visible: boolean;
  x: number;
  y: number;
  w: number;
  size: number;
  rotation: number;
  opacity: number;
  align: Align;
  font: string;
  bold: boolean;
  italic: boolean;
  upper: boolean;
  spacing: number;
  color: string;
  labelColor: string;
  showLabel: boolean;
  label: string;
  strokeW: number;
  strokeColor: string;
  shadowBlur: number;
  shadowColor: string;
  songStyle: SongStyle;
  /** Indikator musik (equalizer) di atas cover. */
  songEq: boolean;
  fill: string;
  /** Regang vertikal (tinggi). */
  stretch: number;
  /** Ukuran teks di dalam elemen lagu. */
  songText: number;
  /** Ukuran cover/kaset di dalam elemen lagu. */
  songCover: number;
  /** Ukuran teks label. */
  labelSize: number;
}

/** Semua pengaturan tampilan = isi template (tanpa isi pesan). */
interface Design {
  ratio: Ratio;
  bgMode: BgMode;
  palette: number;
  seed: number;
  bgA: string;
  bgB: string;
  bgAngle: number;
  bgDeco: boolean;
  overlay: number;
  overlayColor: string;
  font: string;
  color: string;
  title: string;
  /** Urutan lapisan: yang terakhir paling atas. */
  order: ElId[];
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

interface TemplateFile {
  app: "confess-template";
  v: 1;
  name: string;
  design: Design;
  bg: string | null;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  sy: number;
}
type Boxes = Partial<Record<ElId, Box>>;

type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "rot";
interface Pt {
  x: number;
  y: number;
}
interface Gesture {
  id: ElId;
  handle: Handle;
  dx: number;
  dy: number;
  el0: El;
  c0: Pt;
  bw0: number;
  h0: number;
  sy0: number;
}
const HANDLE_DIR: Record<string, [number, number]> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
};

function toLocal(p: Pt, c: Pt, rot: number): Pt {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const cs = Math.cos(-rot);
  const sn = Math.sin(-rot);
  return { x: dx * cs - dy * sn, y: dx * sn + dy * cs };
}
function toWorld(l: Pt, c: Pt, rot: number): Pt {
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  return { x: c.x + l.x * cs - l.y * sn, y: c.y + l.x * sn + l.y * cs };
}
function boxCenter(b: Box): Pt {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}
/** Titik pegangan (koordinat lokal terhadap pusat kotak). */
function handleLocals(b: Box, unit: number): [Handle, Pt][] {
  const a = b.w / 2;
  const v = (b.h * b.sy) / 2;
  return [
    ["rot", { x: 0, y: -v - 34 * unit }],
    ["nw", { x: -a, y: -v }],
    ["ne", { x: a, y: -v }],
    ["se", { x: a, y: v }],
    ["sw", { x: -a, y: v }],
    ["n", { x: 0, y: -v }],
    ["s", { x: 0, y: v }],
    ["e", { x: a, y: 0 }],
    ["w", { x: -a, y: 0 }],
  ];
}
function findHandle(b: Box, p: Pt, unit: number): Handle | null {
  const c = boxCenter(b);
  for (const [h, l] of handleLocals(b, unit)) {
    const w = toWorld(l, c, b.rot);
    if (Math.hypot(p.x - w.x, p.y - w.y) <= 20 * unit) return h;
  }
  return null;
}

/* ───────────── util ───────────── */

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const normDeg = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;

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
  if (!HEX.test(hex)) return false;
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
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

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px.toFixed(1)}px`;
  }
}

function ensureFontLinks() {
  for (const f of FONTS) {
    if (!f.g || document.getElementById(`gf-${f.id}`)) continue;
    const l = document.createElement("link");
    l.id = `gf-${f.id}`;
    l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?family=${f.g}&display=swap`;
    document.head.appendChild(l);
  }
}

function averageColor(img: HTMLImageElement): string {
  try {
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 8;
    const ctx = c.getContext("2d");
    if (!ctx) return "#a9b04a";
    ctx.drawImage(img, 0, 0, 8, 8);
    const d = ctx.getImageData(0, 0, 8, 8).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
    }
    const n = d.length / 4;
    const h = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
  } catch {
    return "#a9b04a";
  }
}

function drawDeco(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number) {
  const rand = rng(seed * 7919 + 13);
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

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, d: Design, bg: HTMLImageElement | null) {
  if (d.bgMode === "image" && bg) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const k = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
    const dw = bg.naturalWidth * k;
    const dh = bg.naturalHeight * k;
    ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    if (d.overlay > 0) {
      ctx.save();
      ctx.globalAlpha = d.overlay;
      ctx.fillStyle = d.overlayColor || (isLight(d.color) ? "#000000" : "#ffffff");
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    return;
  }
  if (d.bgMode === "custom") {
    const a = (d.bgAngle * Math.PI) / 180;
    const r = Math.hypot(W, H) / 2;
    const cx = W / 2;
    const cy = H / 2;
    const g = ctx.createLinearGradient(
      cx - Math.cos(a) * r,
      cy - Math.sin(a) * r,
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r
    );
    g.addColorStop(0, d.bgA);
    g.addColorStop(1, d.bgB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (d.bgDeco) drawDeco(ctx, W, H, d.seed);
    return;
  }
  const p = PALETTES[d.palette] ?? PALETTES[0];
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, p.stops[0]);
  g.addColorStop(0.55, p.stops[1]);
  g.addColorStop(1, p.stops[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawDeco(ctx, W, H, d.seed);
}

const imgIds = new WeakMap<HTMLImageElement, number>();
let imgSeq = 0;
let bgCache: { key: string; canvas: HTMLCanvasElement } | null = null;

/** Latar jarang berubah, jadi digambar sekali lalu disalin (animasi tetap ringan). */
function drawBackgroundCached(ctx: CanvasRenderingContext2D, W: number, H: number, d: Design, bg: HTMLImageElement | null) {
  let id = 0;
  if (bg) {
    id = imgIds.get(bg) ?? ++imgSeq;
    imgIds.set(bg, id);
  }
  const key = [W, H, d.bgMode, d.palette, d.seed, d.bgA, d.bgB, d.bgAngle, d.bgDeco, d.overlay, d.overlayColor, d.bgMode === "image" ? d.color : "", id].join("|");
  if (!bgCache || bgCache.key !== key) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const cx = c.getContext("2d");
    if (!cx) {
      drawBackground(ctx, W, H, d, bg);
      return;
    }
    drawBackground(cx, W, H, d, bg);
    bgCache = { key, canvas: c };
  }
  ctx.drawImage(bgCache.canvas, 0, 0);
}

/* ───────────── menggambar elemen ───────────── */

interface Lay {
  ls: string[];
  mw: number;
  px: number;
  bold: boolean;
}

/** Mengukur/menggambar satu elemen tanpa rotasi. dry=true hanya mengukur. */
function paint(
  ctx: CanvasRenderingContext2D,
  id: ElId,
  d: Design,
  c: Content,
  cover: HTMLImageElement | null,
  accent: string,
  W: number,
  H: number,
  dry: boolean,
  yOverride: number | undefined,
  k: number,
  phase = 0
): { x: number; y: number; w: number; h: number } | null {
  const el = d.els[id];
  const fam = (FONTS.find((f) => f.id === (el.font || d.font)) ?? FONTS[0]).css;
  const bx = el.x * W;
  const by = yOverride ?? el.y * H;
  const bw = el.w * W;
  const sz = el.size * k;
  const color = el.color || d.color;
  const ax = el.align === "left" ? bx : el.align === "center" ? bx + bw / 2 : bx + bw;
  const fnt = (px: number, o?: { bold?: boolean }) =>
    `${el.italic ? "italic " : ""}${(o?.bold ?? el.bold) ? "700 " : ""}${Math.max(8, Math.round(px))}px ${fam}`;
  const T = (s: string) => (el.upper ? s.toUpperCase() : s);

  ctx.textAlign = el.align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  setSpacing(ctx, el.spacing * sz);

  let y = by;
  const put = (text: string, py: number, px = ax) => {
    if (dry) return;
    if (el.strokeW > 0) {
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineWidth = el.strokeW * sz * 2;
      ctx.strokeStyle = el.strokeColor;
      ctx.shadowBlur = 0;
      ctx.strokeText(text, px, py);
      ctx.restore();
    }
    ctx.fillText(text, px, py);
  };
  const lay = (str: string, px: number, maxw: number, bold = el.bold): Lay => {
    ctx.font = fnt(px, { bold });
    const ls = wrap(ctx, T(str), maxw);
    let mw = 0;
    for (const l of ls) mw = Math.max(mw, ctx.measureText(l).width);
    return { ls, mw, px, bold };
  };
  const hLay = (L: Lay, lh = 1.3) => L.ls.length * L.px * lh;
  const drawLay = (L: Lay, x: number, y0: number, lh = 1.3) => {
    ctx.font = fnt(L.px, { bold: L.bold });
    let yy = y0;
    for (const l of L.ls) {
      yy += L.px * lh;
      put(l, yy, x);
    }
    return yy;
  };
  const label = () => {
    if (!HAS_LABEL[id] || !el.showLabel || !el.label.trim()) return;
    const lp = 56 * sz * el.labelSize;
    ctx.font = fnt(lp);
    y += lp * 1.1;
    ctx.fillStyle = el.labelColor || color;
    put(T(el.label.trim()), y);
    ctx.fillStyle = color;
    y += lp * 0.2;
  };
  const place = (cw: number) =>
    el.align === "left" ? bx : el.align === "center" ? bx + bw / 2 - cw / 2 : bx + bw - cw;

  if (id === "title") {
    const text = d.title.trim();
    if (!text) return null;
    const L = lay(text, 150 * sz, bw);
    for (const l of L.ls) {
      y += L.px * 0.95;
      put(l, y);
      y += L.px * 0.12;
    }
  } else if (id === "to" || id === "from" || id === "message") {
    const text = c[id].trim();
    if (!text) return null;
    label();
    y = drawLay(lay(text, 52 * sz, bw), ax, y, 1.35);
  } else if (id === "lyric") {
    const text = c.lyric.trim();
    if (!c.song || !text) return null;
    y = drawLay(lay(`“${text}”`, 46 * sz, bw), ax, y, 1.4);
  } else {
    const song = c.song;
    if (!song) return null;
    label();
    y += 10 * sz;
    const style = el.songStyle;
    const tp = 54 * sz * el.songText;
    const ap = 42 * sz * el.songText;
    const sc = sz * el.songCover;
    const cardFill = el.fill || "#ffffff";
    const onCard = el.color || (isLight(cardFill) ? "#111111" : "#ffffff");

    const coverAt = (cx: number, cy: number, s: number, r: number) => {
      if (dry) return;
      ctx.save();
      roundRect(ctx, cx, cy, s, s, r);
      if (cover) {
        ctx.clip();
        ctx.drawImage(cover, cx, cy, s, s);
      } else {
        ctx.fillStyle = "rgba(128,128,128,0.35)";
        ctx.fill();
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.font = fnt(s * 0.45);
        ctx.fillText("♪", cx + s / 2, cy + s * 0.65);
      }
      ctx.restore();
    };
    /** Indikator musik ala IG: kotak abu-abu dengan batang yang naik-turun. */
    const eqAt = (ex: number, ey: number, es: number) => {
      if (dry || !el.songEq) return;
      ctx.save();
      roundRect(ctx, ex, ey, es, es, es * 0.18);
      ctx.fillStyle = "rgba(190,190,190,0.9)";
      ctx.fill();
      const freq = [3, 5, 4, 2];
      const off = [0, 0.25, 0.5, 0.75];
      const bwid = es * 0.11;
      const gap = es * 0.09;
      let bxx = ex + (es - (freq.length * bwid + (freq.length - 1) * gap)) / 2;
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < freq.length; i++) {
        const hh = es * (0.2 + 0.55 * Math.abs(Math.sin(Math.PI * (freq[i] * phase + off[i]))));
        roundRect(ctx, bxx, ey + (es - hh) / 2, bwid, hh, bwid / 2);
        ctx.fill();
        bxx += bwid + gap;
      }
      ctx.restore();
    };
    const cardAt = (cx: number, cy: number, cw: number, ch: number, r: number) => {
      if (dry) return;
      ctx.save();
      roundRect(ctx, cx, cy, cw, ch, r);
      ctx.fillStyle = cardFill;
      ctx.fill();
      ctx.restore();
    };

    if (style === "vinyl") {
      const dv = Math.min(440 * sc, bw * 0.98);
      const vx = place(dv);
      if (!dry) {
        const R = dv / 2;
        const vcx = vx + R;
        const vcy = y + R;
        ctx.save();
        const g = ctx.createRadialGradient(vcx, vcy, R * 0.2, vcx, vcy, R);
        g.addColorStop(0, "#1a1a1a");
        g.addColorStop(0.6, "#0b0b0b");
        g.addColorStop(1, "#2b2b2b");
        ctx.beginPath();
        ctx.arc(vcx, vcy, R, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = Math.max(1, R * 0.006);
        for (let r = R * 0.42, n = 0; r < R * 0.97; r += R * 0.035, n++) {
          ctx.beginPath();
          ctx.arc(vcx, vcy, r, 0, Math.PI * 2);
          ctx.strokeStyle = n % 2 ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.025)";
          ctx.stroke();
        }
        if (typeof ctx.createConicGradient === "function") {
          const cg = ctx.createConicGradient(-Math.PI * 0.3, vcx, vcy);
          cg.addColorStop(0, "rgba(255,255,255,0)");
          cg.addColorStop(0.08, "rgba(255,255,255,0.22)");
          cg.addColorStop(0.16, "rgba(255,255,255,0)");
          cg.addColorStop(0.5, "rgba(255,255,255,0)");
          cg.addColorStop(0.58, "rgba(255,255,255,0.22)");
          cg.addColorStop(0.66, "rgba(255,255,255,0)");
          cg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.beginPath();
          ctx.arc(vcx, vcy, R * 0.97, 0, Math.PI * 2);
          ctx.arc(vcx, vcy, R * 0.42, 0, Math.PI * 2, true);
          ctx.fillStyle = cg;
          ctx.fill("evenodd");
        }
        // label + cover berputar
        const lr = R * 0.55;
        ctx.translate(vcx, vcy);
        ctx.rotate(phase * Math.PI * 2);
        ctx.beginPath();
        ctx.arc(0, 0, lr, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.clip();
        if (cover) ctx.drawImage(cover, -lr, -lr, lr * 2, lr * 2);
        else {
          ctx.fillStyle = accent;
          ctx.fillRect(-lr, -lr, lr * 2, lr * 2);
        }
        ctx.restore();
        ctx.beginPath();
        ctx.arc(vcx, vcy, R * 0.035, 0, Math.PI * 2);
        ctx.fillStyle = "#0b0b0b";
        ctx.fill();
        ctx.lineWidth = Math.max(1, R * 0.008);
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.stroke();
      }
      y += dv + 24 * sz;
      y = drawLay(lay(song.title, tp, bw, true), ax, y);
      if (song.artist) y = drawLay(lay(song.artist, ap, bw, true), ax, y + 4 * sz);
    } else if (style === "text") {
      const T1 = lay(song.title, tp * 1.1, bw, true);
      const A1 = lay(song.artist || "", ap * 1.1, bw, true);
      y = drawLay(T1, ax, y);
      if (song.artist) y = drawLay(A1, ax, y + 4 * sz);
    } else if (style === "cover") {
      const cs = Math.min(300 * sc, bw * 0.95);
      coverAt(place(cs), y, cs, cs * 0.02);
      eqAt(place(cs) + cs * 0.04, y + cs - cs * 0.26, cs * 0.22);
      y += cs + 22 * sz;
      y = drawLay(lay(song.title, tp, bw, true), ax, y);
      if (song.artist) y = drawLay(lay(song.artist, ap, bw, true), ax, y + 4 * sz);
    } else if (style === "card") {
      const cs = Math.min(240 * sc, bw * 0.85);
      const pad = cs * 0.07;
      const cw = cs + pad * 2;
      const T1 = lay(song.title, tp * 0.9, cs, true);
      const A1 = lay(song.artist || "", ap * 0.9, cs, true);
      const ch = pad + cs + 18 * sz + hLay(T1) + (song.artist ? hLay(A1) : 0) + pad * 1.4;
      const cx = place(cw);
      cardAt(cx, y, cw, ch, pad * 2.2);
      coverAt(cx + pad, y + pad, cs, cs * 0.07);
      eqAt(cx + pad + cs * 0.04, y + pad + cs - cs * 0.24, cs * 0.2);
      if (!dry) {
        ctx.fillStyle = onCard;
        ctx.textAlign = "center";
      }
      let ty = drawLay(T1, cx + cw / 2, y + pad + cs + 18 * sz);
      if (song.artist) ty = drawLay(A1, cx + cw / 2, ty);
      if (!dry) {
        ctx.fillStyle = color;
        ctx.textAlign = el.align;
      }
      y += ch;
    } else if (style === "pill") {
      const ps = 110 * sc;
      const pad = ps * 0.11;
      const maxText = Math.max(120 * sz, Math.min(bw, 760 * sz) - ps - pad * 3);
      const T1 = lay(song.title, tp * 0.8, maxText, true);
      const A1 = lay(song.artist || "", ap * 0.8, maxText, true);
      const tw = Math.max(T1.mw, song.artist ? A1.mw : 0);
      const cw = Math.min(bw, pad * 3 + ps + tw + pad * 0.5);
      const th = hLay(T1) + (song.artist ? hLay(A1) : 0);
      const ch = Math.max(ps, th) + pad * 2;
      const cx = place(cw);
      cardAt(cx, y, cw, ch, pad * 1.8);
      coverAt(cx + pad, y + (ch - ps) / 2, ps, ps * 0.12);
      eqAt(cx + pad + ps * 0.05, y + (ch - ps) / 2 + ps - ps * 0.5, ps * 0.45);
      if (!dry) {
        ctx.fillStyle = onCard;
        ctx.textAlign = "left";
      }
      const tx = cx + pad * 2 + ps;
      const ty0 = y + (ch - th) / 2;
      const ty = drawLay(T1, tx, ty0);
      if (song.artist) drawLay(A1, tx, ty);
      if (!dry) {
        ctx.fillStyle = color;
        ctx.textAlign = el.align;
      }
      y += ch;
    } else {
      // kaset
      const cw = Math.min(520 * sc, bw * 0.95);
      const ch = cw * 0.62;
      const cx = place(cw);
      if (!dry) {
        const band = el.fill || accent;
        const m = cw * 0.035;
        const lx = cx + m;
        const ly = y + m;
        const lw = cw - m * 2;
        const lh = ch * 0.8;
        const bandH = lh * 0.4;
        const topH = lh - bandH;
        ctx.save();
        roundRect(ctx, cx, y, cw, ch, ch * 0.1);
        ctx.fillStyle = "#0b0b0b";
        ctx.fill();
        roundRect(ctx, lx, ly, lw, lh, ch * 0.07);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.save();
        roundRect(ctx, lx, ly, lw, lh, ch * 0.07);
        ctx.clip();
        ctx.fillStyle = band;
        ctx.fillRect(lx, ly + topH, lw, bandH);
        ctx.restore();
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = Math.max(1.5, cw * 0.004);
        for (let i = 0; i < 5; i++) {
          const yy = ly + topH * 0.12 + i * (topH * 0.2);
          ctx.beginPath();
          ctx.moveTo(lx + m, yy);
          ctx.lineTo(lx + lw - m, yy);
          ctx.stroke();
        }
        const cs = topH * 0.78;
        coverAt(cx + cw / 2 - cs / 2, ly + (topH - cs) / 2, cs, cs * 0.12);
        ctx.font = `${Math.round(cs * 0.62)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#111111";
        ctx.fillStyle = band;
        ctx.strokeText("♫", lx + lw * 0.14, ly + topH * 0.62);
        ctx.fillText("♫", lx + lw * 0.14, ly + topH * 0.62);
        ctx.strokeText("♪", lx + lw * 0.86, ly + topH * 0.62);
        ctx.fillText("♪", lx + lw * 0.86, ly + topH * 0.62);
        const pw = lw * 0.5;
        const ph = bandH * 0.66;
        const py = ly + topH + (bandH - ph) / 2;
        roundRect(ctx, cx + cw / 2 - pw / 2, py, pw, ph, ph / 2);
        ctx.fillStyle = "#0b0b0b";
        ctx.fill();
        for (const rx of [cx + cw / 2 - pw * 0.28, cx + cw / 2 + pw * 0.28]) {
          ctx.beginPath();
          ctx.arc(rx, py + ph / 2, ph * 0.36, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.fillStyle = "#0b0b0b";
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3 + phase * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(rx + Math.cos(a) * ph * 0.24, py + ph / 2 + Math.sin(a) * ph * 0.24, ph * 0.05, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
      y += ch + 24 * sz;
      y = drawLay(lay(song.title, tp, bw, true), ax, y);
      if (song.artist) y = drawLay(lay(song.artist, ap, bw, true), ax, y + 4 * sz);
    }
  }

  setSpacing(ctx, 0);
  return { x: bx, y: by, w: bw, h: Math.max(8, y - by) };
}

/** Pembungkus: ukur dulu, lalu gambar dengan rotasi, transparansi, dan bayangan. */
function drawEl(
  ctx: CanvasRenderingContext2D,
  id: ElId,
  d: Design,
  c: Content,
  cover: HTMLImageElement | null,
  accent: string,
  W: number,
  H: number,
  dry: boolean,
  yOverride?: number,
  k = 1,
  phase = 0
): Box | null {
  const m = paint(ctx, id, d, c, cover, accent, W, H, true, yOverride, k, phase);
  if (!m) return null;
  const el = d.els[id];
  const rot = (el.rotation * Math.PI) / 180;
  if (!dry) {
    ctx.save();
    ctx.globalAlpha = el.opacity;
    if (rot || el.stretch !== 1) {
      const cx = m.x + m.w / 2;
      const cy = m.y + m.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      if (el.stretch !== 1) ctx.scale(1, el.stretch);
      ctx.translate(-cx, -cy);
    }
    if (el.shadowBlur > 0) {
      ctx.shadowColor = el.shadowColor;
      ctx.shadowBlur = el.shadowBlur * el.size * k;
      ctx.shadowOffsetY = el.shadowBlur * 0.25 * el.size * k;
    }
    paint(ctx, id, d, c, cover, accent, W, H, false, yOverride, k, phase);
    ctx.restore();
  }
  return { ...m, rot, sy: el.stretch };
}

function renderCard(
  canvas: HTMLCanvasElement,
  d: Design,
  c: Content,
  bg: HTMLImageElement | null,
  cover: HTMLImageElement | null,
  accent: string,
  guides: { selected: ElId | null; snapX: boolean; snapY: boolean; unit: number } | null,
  phase = 0
): Boxes {
  const { w: W, h: H } = SIZES[d.ratio];
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return {};
  drawBackgroundCached(ctx, W, H, d, bg);
  const boxes: Boxes = {};
  for (const id of d.order) {
    if (!d.els[id].visible) continue;
    const b = drawEl(ctx, id, d, c, cover, accent, W, H, false, undefined, 1, phase);
    if (b) boxes[id] = b;
  }
  if (guides) {
    const u = guides.unit;
    ctx.save();
    ctx.lineWidth = 2 * u;
    ctx.setLineDash([8 * u, 6 * u]);
    ctx.strokeStyle = "rgba(255,0,110,0.9)";
    if (guides.snapX) {
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
    }
    if (guides.snapY) {
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
    }
    const sel = guides.selected ? boxes[guides.selected] : undefined;
    if (sel) {
      const c0 = boxCenter(sel);
      ctx.translate(c0.x, c0.y);
      ctx.rotate(sel.rot);
      const a = sel.w / 2;
      const v = (sel.h * sel.sy) / 2;
      ctx.strokeStyle = "#2f80ff";
      ctx.strokeRect(-a, -v, sel.w, v * 2);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, -v);
      ctx.lineTo(0, -v - 34 * u);
      ctx.stroke();
      for (const [h, l] of handleLocals(sel, u)) {
        ctx.beginPath();
        if (h === "n" || h === "s" || h === "e" || h === "w") {
          // pegangan sisi: kapsul kecil
          ctx.arc(l.x, l.y, 7 * u, 0, Math.PI * 2);
        } else {
          ctx.arc(l.x, l.y, (h === "rot" ? 9 : 8) * u, 0, Math.PI * 2);
        }
        ctx.fillStyle = h === "rot" ? "#2f80ff" : "#ffffff";
        ctx.fill();
        ctx.lineWidth = 2.5 * u;
        ctx.strokeStyle = "#2f80ff";
        ctx.stroke();
      }
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
      EL_IDS.map((id) => [id, { ...d.els[id], x: 0.09, w: 0.82, rotation: 0, stretch: 1 }])
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
      const b = drawEl(ctx, id, norm, c, null, "#a9b04a", W, H, true, 0, k);
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

function baseEl(): El {
  return {
    visible: true,
    x: 0.09,
    y: 0.1,
    w: 0.82,
    size: 1,
    rotation: 0,
    opacity: 1,
    align: "left",
    font: "",
    bold: false,
    italic: false,
    upper: false,
    spacing: 0,
    color: "",
    labelColor: "",
    showLabel: true,
    label: "",
    strokeW: 0,
    strokeColor: "#000000",
    shadowBlur: 0,
    shadowColor: "#000000",
    songStyle: "vinyl",
    songEq: true,
    fill: "",
    stretch: 1,
    songText: 1,
    songCover: 1,
    labelSize: 1,
  };
}

function defaultDesign(content: Content, hasLyric: boolean): Design {
  const base = baseEl();
  const d: Design = {
    ratio: "story",
    bgMode: "gen",
    palette: 0,
    seed: 1,
    bgA: "#a9dcea",
    bgB: "#6db3d8",
    bgAngle: 135,
    bgDeco: true,
    overlay: 0.15,
    overlayColor: "",
    font: "dancing",
    color: PALETTES[0].text,
    title: content.song ? "Menfess Songs" : "Menfess",
    order: [...EL_IDS],
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

/* ── validasi (template dari file/HP lain TIDAK dipercaya) ── */

const num = (v: unknown, min: number, max: number, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? clamp(v, min, max) : def;
const colReq = (v: unknown, def: string) => (typeof v === "string" && HEX.test(v) ? v : def);
const colAuto = (v: unknown, def: string) =>
  typeof v === "string" && (v === "" || HEX.test(v)) ? v : def;
const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
const text = (v: unknown, max: number, def: string) =>
  typeof v === "string" ? Array.from(v).slice(0, max).join("") : def;
function pick<T extends string>(v: unknown, list: readonly T[], def: T): T {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : def;
}

function sanitizeEl(raw: unknown, def: El): El {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    visible: bool(r.visible, def.visible),
    x: num(r.x, -1, 2, def.x),
    y: num(r.y, -1, 2, def.y),
    w: num(r.w, 0.1, 1.2, def.w),
    size: num(r.size, 0.2, 4, def.size),
    rotation: num(r.rotation, -180, 180, def.rotation),
    opacity: num(r.opacity, 0.05, 1, def.opacity),
    align: pick(r.align, ["left", "center", "right"] as const, def.align),
    font: typeof r.font === "string" && (r.font === "" || FONT_IDS.includes(r.font)) ? r.font : def.font,
    bold: bool(r.bold, def.bold),
    italic: bool(r.italic, def.italic),
    upper: bool(r.upper, def.upper),
    spacing: num(r.spacing, 0, 40, def.spacing),
    color: colAuto(r.color, def.color),
    labelColor: colAuto(r.labelColor, def.labelColor),
    showLabel: bool(r.showLabel, def.showLabel),
    label: text(r.label, 20, def.label),
    strokeW: num(r.strokeW, 0, 24, def.strokeW),
    strokeColor: colReq(r.strokeColor, def.strokeColor),
    shadowBlur: num(r.shadowBlur, 0, 60, def.shadowBlur),
    shadowColor: colReq(r.shadowColor, def.shadowColor),
    songStyle: pick(r.songStyle, ["vinyl", "cover", "pill", "card", "cassette", "text"] as const, def.songStyle),
    songEq: bool(r.songEq, def.songEq),
    fill: colAuto(r.fill, def.fill),
    stretch: num(r.stretch, 0.2, 4, def.stretch),
    songText: num(r.songText, 0.2, 2, def.songText),
    songCover: num(r.songCover, 0.2, 2, def.songCover),
    labelSize: num(r.labelSize, 0.3, 2, def.labelSize),
  };
}

function sanitizeDesign(raw: unknown, fb: Design): Design {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const els = (r.els && typeof r.els === "object" ? r.els : {}) as Record<string, unknown>;
  return {
    ratio: pick(r.ratio, ["story", "post", "square"] as const, fb.ratio),
    bgMode: pick(r.bgMode, ["gen", "custom", "image"] as const, fb.bgMode),
    palette: Math.round(num(r.palette, 0, PALETTES.length - 1, fb.palette)),
    seed: Math.round(num(r.seed, 0, 100000, fb.seed)),
    bgA: colReq(r.bgA, fb.bgA),
    bgB: colReq(r.bgB, fb.bgB),
    bgAngle: num(r.bgAngle, 0, 360, fb.bgAngle),
    bgDeco: bool(r.bgDeco, fb.bgDeco),
    overlay: num(r.overlay, 0, 0.9, fb.overlay),
    overlayColor: colAuto(r.overlayColor, fb.overlayColor),
    font: pick(r.font, FONT_IDS, fb.font),
    color: colReq(r.color, fb.color),
    title: text(r.title, 40, fb.title),
    order:
      Array.isArray(r.order) &&
      r.order.length === EL_IDS.length &&
      EL_IDS.every((id) => (r.order as unknown[]).includes(id))
        ? (r.order as ElId[])
        : fb.order,
    els: Object.fromEntries(EL_IDS.map((id) => [id, sanitizeEl(els[id], fb.els[id])])) as Record<ElId, El>,
  };
}

/* ───────────── file template & penyimpanan ───────────── */

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function dataUrlToBlob(url: string): Blob | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] });
  } catch {
    return null;
  }
}

async function shrinkImage(blob: Blob, maxEdge: number, quality: number): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImg(url);
    const k = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", quality));
    return out ?? blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const DB_NAME = "confess-studio";
const STORE = "templates";
const LAST_KEY = "studio:lastTemplate";
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

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

async function dbRun<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
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

/* ───────────── encoder GIF (tanpa library) ───────────── */

class Bytes {
  private buf = new Uint8Array(1 << 20);
  n = 0;
  private grow(extra: number) {
    if (this.n + extra <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.n + extra) size *= 2;
    const nb = new Uint8Array(size);
    nb.set(this.buf.subarray(0, this.n));
    this.buf = nb;
  }
  byte(b: number) {
    this.grow(1);
    this.buf[this.n++] = b & 255;
  }
  u16(v: number) {
    this.byte(v & 255);
    this.byte(v >> 8);
  }
  str(t: string) {
    for (let i = 0; i < t.length; i++) this.byte(t.charCodeAt(i));
  }
  bytes(a: Uint8Array, len = a.length) {
    this.grow(len);
    this.buf.set(a.subarray(0, len), this.n);
    this.n += len;
  }
  done(): ArrayBuffer {
    return this.buf.slice(0, this.n).buffer as ArrayBuffer;
  }
}

/** Median cut: palet 256 warna dari sampel piksel (r<<16|g<<8|b). */
function medianCut(px: Uint32Array, nColors: number): Uint8Array {
  interface B {
    s: number;
    e: number;
    sh: number;
    range: number;
  }
  const rangeOf = (s: number, e: number): { sh: number; range: number } => {
    let rmin = 255;
    let rmax = 0;
    let gmin = 255;
    let gmax = 0;
    let bmin = 255;
    let bmax = 0;
    for (let i = s; i < e; i++) {
      const v = px[i];
      const r = (v >> 16) & 255;
      const g = (v >> 8) & 255;
      const b = v & 255;
      if (r < rmin) rmin = r;
      if (r > rmax) rmax = r;
      if (g < gmin) gmin = g;
      if (g > gmax) gmax = g;
      if (b < bmin) bmin = b;
      if (b > bmax) bmax = b;
    }
    const rr = rmax - rmin;
    const gr = gmax - gmin;
    const br = bmax - bmin;
    if (rr >= gr && rr >= br) return { sh: 16, range: rr };
    if (gr >= br) return { sh: 8, range: gr };
    return { sh: 0, range: br };
  };
  const boxes: B[] = [{ s: 0, e: px.length, ...rangeOf(0, px.length) }];
  while (boxes.length < nColors) {
    let bi = -1;
    let best = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (b.e - b.s > 1 && b.range > best) {
        best = b.range;
        bi = i;
      }
    }
    if (bi < 0) break;
    const b = boxes[bi];
    const sh = b.sh;
    px.subarray(b.s, b.e).sort((x, y) => ((x >> sh) & 255) - ((y >> sh) & 255));
    const mid = (b.s + b.e) >> 1;
    boxes.splice(
      bi,
      1,
      { s: b.s, e: mid, ...rangeOf(b.s, mid) },
      { s: mid, e: b.e, ...rangeOf(mid, b.e) }
    );
  }
  const pal = new Uint8Array(256 * 3);
  boxes.forEach((b, i) => {
    let r = 0;
    let g = 0;
    let bl = 0;
    const n = Math.max(1, b.e - b.s);
    for (let j = b.s; j < b.e; j++) {
      const v = px[j];
      r += (v >> 16) & 255;
      g += (v >> 8) & 255;
      bl += v & 255;
    }
    pal[i * 3] = Math.round(r / n);
    pal[i * 3 + 1] = Math.round(g / n);
    pal[i * 3 + 2] = Math.round(bl / n);
  });
  return pal;
}

/** Tabel 5-5-5 bit → indeks warna palet terdekat (pemetaan piksel jadi cepat). */
function buildLut(pal: Uint8Array): Uint8Array {
  const lut = new Uint8Array(32768);
  for (let c = 0; c < 32768; c++) {
    const r = ((c >> 10) & 31) * 8 + 4;
    const g = ((c >> 5) & 31) * 8 + 4;
    const b = (c & 31) * 8 + 4;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < 256; i++) {
      const dr = r - pal[i * 3];
      const dg = g - pal[i * 3 + 1];
      const db = b - pal[i * 3 + 2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    lut[c] = best;
  }
  return lut;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** RGBA → indeks palet, dengan dithering terurut agar gradasi tidak bergaris. */
function quantize(rgba: Uint8ClampedArray, w: number, h: number, lut: Uint8Array): Uint8Array {
  const out = new Uint8Array(w * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++, o++) {
      const t = (BAYER[((y & 3) << 2) | (x & 3)] - 7.5) * 1.6;
      const i = o * 4;
      const r = clamp(rgba[i] + t, 0, 255) >> 3;
      const g = clamp(rgba[i + 1] + t, 0, 255) >> 3;
      const b = clamp(rgba[i + 2] + t, 0, 255) >> 3;
      out[o] = lut[(r << 10) | (g << 5) | b];
    }
  }
  return out;
}

let lzwStamp: Int32Array | null = null;
let lzwVal: Int32Array | null = null;
let lzwGen = 0;

function lzwEncode(idx: Uint8Array, out: Bytes) {
  if (!lzwStamp || !lzwVal) {
    lzwStamp = new Int32Array(1 << 20);
    lzwVal = new Int32Array(1 << 20);
  }
  const stamp = lzwStamp;
  const val = lzwVal;
  const CLEAR = 256;
  const EOI = 257;
  out.byte(8);
  const block = new Uint8Array(255);
  let bl = 0;
  const putByte = (b: number) => {
    block[bl++] = b;
    if (bl === 255) {
      out.byte(255);
      out.bytes(block, 255);
      bl = 0;
    }
  };
  let cur = 0;
  let shift = 0;
  let size = 9;
  let next = 258;
  const emit = (code: number) => {
    cur |= code << shift;
    shift += size;
    while (shift >= 8) {
      putByte(cur & 255);
      cur >>>= 8;
      shift -= 8;
    }
  };
  lzwGen++;
  emit(CLEAR);
  let prefix = idx[0];
  for (let i = 1; i < idx.length; i++) {
    const k = idx[i];
    const key = (prefix << 8) | k;
    if (stamp[key] === lzwGen) {
      prefix = val[key];
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(CLEAR);
      lzwGen++;
      next = 258;
      size = 9;
    } else {
      if (next >= 1 << size) size++;
      stamp[key] = lzwGen;
      val[key] = next++;
    }
    prefix = k;
  }
  emit(prefix);
  emit(EOI);
  if (shift > 0) putByte(cur & 255);
  if (bl > 0) {
    out.byte(bl);
    out.bytes(block, bl);
  }
  out.byte(0);
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
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="block text-xs text-muted">
      <span className="flex justify-between">
        <span>{label}</span>
        <span>
          {Math.round(value * 100) / 100}
          {suffix}
        </span>
      </span>
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`focus-ring rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
        checked ? "border-primary bg-primary/15 text-primary" : "border-hairline text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function ColorField({
  label,
  value,
  onChange,
  fallback,
  auto = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  fallback: string;
  auto?: boolean;
}) {
  const shown = HEX.test(value) ? value : fallback;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        {auto && value && (
          <button type="button" onClick={() => onChange("")} className="text-[11px] font-semibold text-primary">
            Otomatis
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} ${c}`}
            onClick={() => onChange(c)}
            style={{ background: c }}
            className={`h-6 w-6 rounded-full ${
              HEX.test(value) && shown.toLowerCase() === c ? "border-2 border-primary" : "border border-hairline"
            }`}
          />
        ))}
        <input
          type="color"
          aria-label={`${label} kustom`}
          value={shown}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-hairline bg-transparent"
        />
      </div>
    </div>
  );
}

function Group({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="rounded-lg border border-hairline">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-ink">{title}</summary>
      <div className="space-y-3 px-3 pb-3 pt-1">{children}</div>
    </details>
  );
}

/* ───────────── studio ───────────── */

function CardStudio({ data, onClose }: { data: StudioData; onClose: () => void }) {
  const initialContent: Content = {
    to: data.toName ?? "",
    from: data.fromName || "Anonim",
    message: data.message,
    lyric: data.songLyric ?? "",
    song: data.song ?? null,
  };
  const [content, setContent] = useState<Content>(initialContent);
  const [design, setDesign] = useState<Design>(() => defaultDesign(initialContent, Boolean(data.songLyric)));
  const [selected, setSelected] = useState<ElId | null>("message");
  const [snap, setSnap] = useState({ x: false, y: false });
  const [fontTick, setFontTick] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [histTick, setHistTick] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [gifW, setGifW] = useState(480);
  const [gifMsg, setGifMsg] = useState("");
  const phaseRef = useRef(0);
  const gifBusyRef = useRef(false);
  const renderRef = useRef<() => void>(() => undefined);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxesRef = useRef<Boxes>({});
  const designRef = useRef(design);
  designRef.current = design;
  const gestureRef = useRef<Gesture | null>(null);
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hist = useRef({ past: [] as string[], future: [] as string[], last: "", skip: false });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ id: ElId; d0: number; a0: number; size0: number; rot0: number } | null>(null);
  const touched = useRef(false);
  const bgUrlRef = useRef<string | null>(null);

  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [bgBlob, setBgBlob] = useState<Blob | null>(null);
  const [cover, setCover] = useState<HTMLImageElement | null>(null);
  const [accent, setAccent] = useState("#a9b04a");
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [canShare, setCanShare] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplBusy, setTplBusy] = useState(false);

  const song = content.song;
  const songEl = design.els.song;
  const isAnimated =
    Boolean(song) &&
    songEl.visible &&
    (songEl.songStyle === "vinyl" ||
      songEl.songStyle === "cassette" ||
      (songEl.songEq && (songEl.songStyle === "cover" || songEl.songStyle === "pill" || songEl.songStyle === "card")));

  const setD = (patch: Partial<Design>) => setDesign((p) => ({ ...p, ...patch }));
  const setEl = (id: ElId, patch: Partial<El>) =>
    setDesign((p) => ({ ...p, els: { ...p.els, [id]: { ...p.els[id], ...patch } } }));
  const setC = (patch: Partial<Content>) => setContent((p) => ({ ...p, ...patch }));
  const relayoutIfFresh = (next: Design) => (touched.current ? next : autoLayout(next, content));

  /* font Google: muat saat dibuka, gambar ulang setelah siap */
  useEffect(() => {
    ensureFontLinks();
    const bump = () => setFontTick((n) => n + 1);
    document.fonts?.addEventListener("loadingdone", bump);
    window.addEventListener("resize", bump);
    return () => {
      document.fonts?.removeEventListener("loadingdone", bump);
      window.removeEventListener("resize", bump);
    };
  }, []);

  const usedFonts = [design.font, ...EL_IDS.map((id) => design.els[id].font)].filter(Boolean).join("|");
  useEffect(() => {
    for (const id of new Set(usedFonts.split("|"))) {
      const f = FONTS.find((x) => x.id === id);
      if (!f?.g) continue;
      void document.fonts?.load(`40px ${f.css}`).catch(() => undefined);
      void document.fonts?.load(`700 40px ${f.css}`).catch(() => undefined);
    }
  }, [usedFonts]);

  /* cover lewat route kita sendiri agar kanvas bisa diekspor */
  useEffect(() => {
    if (!song?.id) {
      setCover(null);
      return;
    }
    let cancelled = false;
    loadImg(`/api/songs/cover?id=${encodeURIComponent(song.id)}`)
      .then((img) => {
        if (cancelled) return;
        setCover(img);
        setAccent(averageColor(img));
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
      const f = new File([new Blob(["x"])], "a.json", { type: "application/json" });
      setCanShare(Boolean(navigator.canShare?.({ files: [f] })));
    } catch {
      setCanShare(false);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
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

  /* gambar ulang: dipakai efek perubahan dan loop animasi */
  renderRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const unit = rect.width > 0 ? SIZES[design.ratio].w / rect.width : 3;
    boxesRef.current = renderCard(
      canvas,
      design,
      content,
      bgImg,
      cover,
      accent,
      { selected, snapX: snap.x, snapY: snap.y, unit },
      phaseRef.current
    );
  };
  useEffect(() => {
    renderRef.current();
  }, [design, content, bgImg, cover, accent, selected, snap, zoom, fontTick]);

  /* animasi pratinjau (piringan berputar, equalizer): ~30 fps, berhenti bila tidak ada yang bergerak */
  useEffect(() => {
    if (!playing || !isAnimated) return;
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      if (!gifBusyRef.current && now - last >= 33) {
        last = now;
        phaseRef.current = (now / 3000) % 1;
        renderRef.current();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, isAnimated]);

  /* riwayat undo/redo: perubahan beruntun digabung (jeda 350 ms) */
  useEffect(() => {
    const h = hist.current;
    const snapshot = JSON.stringify(design);
    if (!h.last) {
      h.last = snapshot;
      return;
    }
    if (h.skip) {
      h.skip = false;
      h.last = snapshot;
      return;
    }
    if (snapshot === h.last) return;
    const t = setTimeout(() => {
      h.past.push(h.last);
      if (h.past.length > 60) h.past.shift();
      h.future = [];
      h.last = snapshot;
      setHistTick((n) => n + 1);
    }, 350);
    return () => clearTimeout(t);
  }, [design]);

  function undo() {
    const h = hist.current;
    const cur = JSON.stringify(designRef.current);
    let target: string | undefined;
    if (cur !== h.last) {
      target = h.last; // perubahan terakhir belum tercatat: kembalikan ke catatan terakhir
    } else {
      target = h.past.pop();
    }
    if (target === undefined) return;
    h.future.push(cur);
    h.skip = true;
    h.last = target;
    setDesign(JSON.parse(target) as Design);
    setHistTick((n) => n + 1);
  }

  function redo() {
    const h = hist.current;
    const target = h.future.pop();
    if (target === undefined) return;
    h.past.push(h.last);
    h.skip = true;
    h.last = target;
    setDesign(JSON.parse(target) as Design);
    setHistTick((n) => n + 1);
  }

  function moveLayer(id: ElId, dir: 1 | -1) {
    setDesign((p) => {
      const o = [...p.order];
      const i = o.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= o.length) return p;
      [o[i], o[j]] = [o[j], o[i]];
      return { ...p, order: o };
    });
  }

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

  /* ── latar foto ── */
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
      const blob = await shrinkImage(file, 2200, 0.9);
      await setBackground(blob);
      setD({ bgMode: "image" });
    } catch {
      setError("Gambar tidak bisa dibaca.");
    }
  }

  async function setBackground(blob: Blob | null) {
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
      await setBackground(t.bg);
      const base = defaultDesign(initialContent, Boolean(data.songLyric));
      const merged = sanitizeDesign(t.design, base);
      setDesign({ ...merged, bgMode: merged.bgMode === "image" && !t.bg ? "gen" : merged.bgMode });
      touched.current = true; // tata letak template dihormati
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

  function makeThumb(d: Design, bg: HTMLImageElement | null): string {
    try {
      const full = document.createElement("canvas");
      renderCard(full, d, content, bg, cover, accent, null);
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
    setInfo("");
    setTplBusy(true);
    try {
      const existing = !asNew ? templates.find((t) => t.id === activeId) : undefined;
      const id = existing?.id ?? `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const d = JSON.parse(JSON.stringify(designRef.current)) as Design;
      const t: Template = {
        id,
        name: existing?.name ?? (tplName.trim().slice(0, 30) || `Template ${templates.length + 1}`),
        updatedAt: Date.now(),
        design: d,
        bg: bgBlob,
        thumb: makeThumb(d, bgImg),
      };
      await dbRun("readwrite", (s) => s.put(t));
      setTemplates(await listTemplates());
      setActiveId(id);
      setTplName("");
      setInfo("Template tersimpan di HP ini.");
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

  async function shareTemplate(t: Template) {
    setError("");
    setInfo("");
    try {
      const bg = t.bg ? await blobToDataUrl(await shrinkImage(t.bg, 1600, 0.85)) : null;
      const payload: TemplateFile = { app: "confess-template", v: 1, name: t.name, design: t.design, bg };
      const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "template";
      const file = new File([JSON.stringify(payload)], `${slug}.confesstpl.json`, { type: "application/json" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: t.name });
          return;
        } catch (e) {
          if ((e as { name?: string }).name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setInfo("File template diunduh. Kirim file itu ke HP lain, lalu pakai Impor.");
    } catch {
      setError("Template tidak bisa dibagikan.");
    }
  }

  async function importTemplate(file: File) {
    setError("");
    setInfo("");
    if (file.size > MAX_IMPORT_BYTES) {
      setError("File template terlalu besar.");
      return;
    }
    try {
      const obj = JSON.parse(await file.text()) as Partial<TemplateFile>;
      if (obj?.app !== "confess-template" || obj.v !== 1) throw new Error("format");
      const base = defaultDesign(initialContent, Boolean(data.songLyric));
      const design = sanitizeDesign(obj.design, base);
      let bg: Blob | null = null;
      if (typeof obj.bg === "string" && obj.bg.length <= MAX_IMPORT_BYTES * 1.4) bg = dataUrlToBlob(obj.bg);
      if (design.bgMode === "image" && !bg) design.bgMode = "gen";
      let thumb = "";
      if (bg) {
        const url = URL.createObjectURL(bg);
        try {
          thumb = makeThumb(design, await loadImg(url));
        } finally {
          URL.revokeObjectURL(url);
        }
      } else {
        thumb = makeThumb(design, null);
      }
      const t: Template = {
        id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: text(obj.name, 30, "Template impor").trim() || "Template impor",
        updatedAt: Date.now(),
        design,
        bg,
        thumb,
      };
      await dbRun("readwrite", (s) => s.put(t));
      setTemplates(await listTemplates());
      await applyTemplate(t);
      setInfo(`Template "${t.name}" berhasil diimpor.`);
    } catch {
      setError("File template tidak valid.");
    }
  }

  /* ── ekspor gambar ── */
  function toBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      try {
        const c = document.createElement("canvas");
        renderCard(c, designRef.current, content, bgImg, cover, accent, null, phaseRef.current);
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

  async function shareImage() {
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

  /* ── GIF animasi (satu putaran penuh = satu loop, jadi mulus) ── */
  async function makeGif(): Promise<Blob | null> {
    const d = designRef.current;
    const { w: W, h: H } = SIZES[d.ratio];
    const outW = gifW;
    const outH = Math.max(2, Math.round((outW * H) / W));
    const N = 40;
    const full = document.createElement("canvas");
    const small = document.createElement("canvas");
    small.width = outW;
    small.height = outH;
    const sctx = small.getContext("2d", { willReadFrequently: true });
    if (!sctx) return null;
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    const grab = (i: number) => {
      renderCard(full, d, content, bgImg, cover, accent, null, i / N);
      sctx.drawImage(full, 0, 0, outW, outH);
      return sctx.getImageData(0, 0, outW, outH).data;
    };
    gifBusyRef.current = true;
    try {
      // 1) palet global dari beberapa frame contoh
      const stride = Math.max(1, Math.floor((outW * outH) / 9000));
      const samples: number[] = [];
      for (const i of [0, 7, 14, 21, 28, 35]) {
        const px = grab(i);
        for (let q = 0; q < outW * outH; q += stride) {
          const o = q * 4;
          samples.push((px[o] << 16) | (px[o + 1] << 8) | px[o + 2]);
        }
      }
      const palette = medianCut(Uint32Array.from(samples), 256);
      const lut = buildLut(palette);

      // 2) tulis tiap frame langsung (hemat memori)
      const out = new Bytes();
      out.str("GIF89a");
      out.u16(outW);
      out.u16(outH);
      out.byte(0xf7);
      out.byte(0);
      out.byte(0);
      out.bytes(palette);
      out.byte(0x21);
      out.byte(0xff);
      out.byte(11);
      out.str("NETSCAPE2.0");
      out.byte(3);
      out.byte(1);
      out.u16(0);
      out.byte(0);
      for (let i = 0; i < N; i++) {
        setGifMsg(`Membuat GIF… ${i + 1}/${N}`);
        await new Promise((r) => setTimeout(r, 0));
        const idx = quantize(grab(i), outW, outH, lut);
        out.byte(0x21);
        out.byte(0xf9);
        out.byte(4);
        out.byte(0x04);
        out.u16(8);
        out.byte(0);
        out.byte(0);
        out.byte(0x2c);
        out.u16(0);
        out.u16(0);
        out.u16(outW);
        out.u16(outH);
        out.byte(0);
        lzwEncode(idx, out);
      }
      out.byte(0x3b);
      return new Blob([out.done()], { type: "image/gif" });
    } finally {
      gifBusyRef.current = false;
    }
  }

  async function saveGif(share: boolean) {
    if (gifMsg) return;
    setError("");
    setInfo(isAnimated ? "" : "Pilih gaya Piringan atau Kaset, atau aktifkan indikator musik, supaya GIF bergerak.");
    try {
      setGifMsg("Menyiapkan GIF…");
      const blob = await makeGif();
      if (!blob) throw new Error("gif");
      const file = new File([blob], `menfess-${Date.now()}.gif`, { type: "image/gif" });
      if (share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (e) {
          if ((e as { name?: string }).name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setInfo(`GIF tersimpan (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
    } catch {
      setError("GIF gagal dibuat. Coba ukuran yang lebih kecil.");
    } finally {
      setGifMsg("");
    }
  }

  /* ── transformasi elemen: geser, 8 titik ubah ukuran, putar, cubit ── */
  function toCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): Pt {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  /** Piksel kanvas per piksel layar. */
  function pointerUnit(canvas: HTMLCanvasElement) {
    const r = canvas.getBoundingClientRect();
    return r.width > 0 ? canvas.width / r.width : 3;
  }

  function inBox(b: Box, p: Pt) {
    const l = toLocal(p, boxCenter(b), b.rot);
    return Math.abs(l.x) <= b.w / 2 + 20 && Math.abs(l.y) <= (b.h * b.sy) / 2 + 20;
  }

  function startGesture(id: ElId, handle: Handle, p: Pt, b: Box) {
    gestureRef.current = {
      id,
      handle,
      dx: p.x - b.x,
      dy: p.y - b.y,
      el0: { ...designRef.current.els[id] },
      c0: boxCenter(b),
      bw0: b.w,
      h0: b.h,
      sy0: b.sy,
    };
    setSelected(id);
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const p = toCanvasPoint(e);
    pointers.current.set(e.pointerId, p);
    canvas.setPointerCapture(e.pointerId);

    if (pointers.current.size === 2) {
      const target = selected;
      if (target) {
        const [a, b] = Array.from(pointers.current.values());
        const el = designRef.current.els[target];
        pinchRef.current = {
          id: target,
          d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          a0: Math.atan2(b.y - a.y, b.x - a.x),
          size0: el.size,
          rot0: el.rotation,
        };
        gestureRef.current = null;
        panRef.current = null;
      }
      return;
    }

    const unit = pointerUnit(canvas);
    const d = designRef.current;
    // 1) pegangan elemen yang sedang dipilih
    if (selected && d.els[selected].visible) {
      const sb = boxesRef.current[selected];
      if (sb) {
        const h = findHandle(sb, p, unit);
        if (h) {
          startGesture(selected, h, p, sb);
          return;
        }
      }
    }
    // 2) badan elemen (lapisan teratas dulu)
    const hit = [...d.order].reverse().find((id) => {
      const b = boxesRef.current[id];
      return b && inBox(b, p);
    });
    if (hit) {
      startGesture(hit, "move", p, boxesRef.current[hit] as Box);
      return;
    }
    // 3) area kosong: batalkan pilihan; bila di-zoom, geser tampilan
    setSelected(null);
    const sc = scrollRef.current;
    if (sc && zoom > 1) panRef.current = { x: e.clientX, y: e.clientY, sl: sc.scrollLeft, st: sc.scrollTop };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    const p = toCanvasPoint(e);
    pointers.current.set(e.pointerId, p);

    const pr = pinchRef.current;
    if (pr && pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      let rot = normDeg(pr.rot0 + ((ang - pr.a0) * 180) / Math.PI);
      if (Math.abs(rot) < 3) rot = 0;
      touched.current = true;
      setEl(pr.id, { size: clamp((pr.size0 * dist) / pr.d0, 0.3, 3), rotation: Math.round(rot) });
      return;
    }

    const pan = panRef.current;
    if (pan && scrollRef.current) {
      scrollRef.current.scrollLeft = pan.sl - (e.clientX - pan.x);
      scrollRef.current.scrollTop = pan.st - (e.clientY - pan.y);
      return;
    }

    const g = gestureRef.current;
    if (!g) return;
    const { w: W, h: H } = SIZES[designRef.current.ratio];
    const { el0, c0, bw0, h0, sy0 } = g;
    const rot = (el0.rotation * Math.PI) / 180;
    touched.current = true;

    if (g.handle === "move") {
      let nx = (p.x - g.dx) / W;
      let ny = (p.y - g.dy) / H;
      const sx = Math.abs(nx + el0.w / 2 - 0.5) < 0.012;
      const sy = Math.abs(ny + h0 / 2 / H - 0.5) < 0.012;
      if (sx) nx = 0.5 - el0.w / 2;
      if (sy) ny = 0.5 - h0 / 2 / H;
      setSnap({ x: sx, y: sy });
      setEl(g.id, { x: clamp(nx, -el0.w / 2, 1 - el0.w / 2), y: clamp(ny, -0.3, 1) });
      return;
    }

    if (g.handle === "rot") {
      let deg = normDeg((Math.atan2(p.y - c0.y, p.x - c0.x) * 180) / Math.PI + 90);
      for (const t of [0, 45, 90, 135, 180, -45, -90, -135, -180]) {
        if (Math.abs(deg - t) < 3) deg = t;
      }
      setEl(g.id, { rotation: Math.round(deg) });
      return;
    }

    const lp = toLocal(p, c0, rot);
    const a0 = bw0 / 2;
    const v0 = (h0 * sy0) / 2;
    const dir = HANDLE_DIR[g.handle];

    if (g.handle === "e" || g.handle === "w") {
      // lebar kotak: sisi seberang tetap
      const sgn = dir[0];
      const nbw = clamp(sgn * lp.x + a0, 0.1 * W, 1.2 * W);
      const nc = toWorld({ x: (sgn * (nbw - bw0)) / 2, y: 0 }, c0, rot);
      setEl(g.id, { w: nbw / W, x: (nc.x - nbw / 2) / W, y: (nc.y - h0 / 2) / H });
      return;
    }

    if (g.handle === "n" || g.handle === "s") {
      // tinggi: regang vertikal, sisi seberang tetap
      const sgn = dir[1];
      const nsy = clamp((sgn * lp.y + v0) / h0, 0.2, 4);
      const nc = toWorld({ x: 0, y: (sgn * (nsy * h0 - h0 * sy0)) / 2 }, c0, rot);
      setEl(g.id, { stretch: nsy, x: (nc.x - bw0 / 2) / W, y: (nc.y - h0 / 2) / H });
      return;
    }

    // sudut: skala seragam dari sudut yang berseberangan
    const hv = { x: dir[0] * a0, y: dir[1] * v0 };
    const an = { x: -hv.x, y: -hv.y };
    const vx = hv.x - an.x;
    const vy = hv.y - an.y;
    let f = ((lp.x - an.x) * vx + (lp.y - an.y) * vy) / (vx * vx + vy * vy);
    f = clamp(f, 0.1, 6);
    f = clamp(el0.size * f, 0.3, 3) / el0.size;
    f = clamp(el0.w * f, 0.1, 1.2) / el0.w;
    const nc = toWorld({ x: an.x * (1 - f), y: an.y * (1 - f) }, c0, rot);
    setEl(g.id, {
      size: el0.size * f,
      w: el0.w * f,
      x: (nc.x - (bw0 * f) / 2) / W,
      y: (nc.y - (h0 * f) / 2) / H,
    });
  }

  function onPointerEnd(e: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    if (pointers.current.size === 0) {
      gestureRef.current = null;
      panRef.current = null;
      setSnap({ x: false, y: false });
    }
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
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrag(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void loadFile(f);
    },
  };

  const available = (id: ElId) => (id === "song" || id === "lyric" ? Boolean(song) : true);
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
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={undo}
                disabled={!(hist.current.past.length > 0 || JSON.stringify(design) !== hist.current.last)}
                aria-label="Urungkan"
                title="Urungkan (Ctrl+Z)"
                className="btn-ghost px-2.5 py-1 text-sm disabled:opacity-40"
                data-tick={histTick}
              >
                ↶
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={hist.current.future.length === 0}
                aria-label="Ulangi"
                title="Ulangi (Ctrl+Shift+Z)"
                className="btn-ghost px-2.5 py-1 text-sm disabled:opacity-40"
              >
                ↷
              </button>
              <span className="mx-1 h-5 w-px bg-hairline" aria-hidden />
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(Math.round((z - 0.25) * 4) / 4, 1, 4))}
                aria-label="Perkecil tampilan"
                className="btn-ghost px-2.5 py-1 text-sm"
              >
                −
              </button>
              <input
                type="range"
                min={1}
                max={4}
                step={0.25}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-label="Zoom tampilan"
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={() => setZoom((z) => clamp(Math.round((z + 0.25) * 4) / 4, 1, 4))}
                aria-label="Perbesar tampilan"
                className="btn-ghost px-2.5 py-1 text-sm"
              >
                +
              </button>
              <button type="button" onClick={() => setZoom(1)} className="btn-ghost px-2 py-1 text-xs">
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setPlaying((v) => !v)}
                aria-pressed={playing}
                aria-label={playing ? "Jeda animasi" : "Putar animasi"}
                title={playing ? "Jeda animasi" : "Putar animasi"}
                className="btn-ghost px-2.5 py-1 text-sm"
              >
                {playing ? "⏸" : "▶"}
              </button>
            </div>
            <div
              ref={scrollRef}
              className={`relative max-h-[64vh] overflow-auto rounded-xl p-1 ${drag ? "ring-2 ring-primary" : ""}`}
            >
              {drag && (
                <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl bg-primary/20 text-sm font-semibold text-ink">
                  Lepas foto di sini
                </div>
              )}
              <canvas
                ref={canvasRef}
                tabIndex={0}
                aria-label="Pratinjau kartu. Geser teks untuk memindahkan."
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onKeyDown={onKeyDown}
                className="mx-auto block rounded-lg shadow-lift outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{
                  width: `calc(min(100%, ${((62 * SIZES[design.ratio].w) / SIZES[design.ratio].h).toFixed(3)}vh) * ${zoom})`,
                  height: "auto",
                  maxWidth: "none",
                  touchAction: "none",
                  cursor: "grab",
                }}
              />
            </div>
            <p className="text-center text-[11px] text-muted">
              Pilih elemen, lalu tarik titik di sudut dan sisi untuk mengubah ukuran, titik atas untuk memutar. Cubit
              dua jari untuk skala dan putar cepat. Zoom lalu geser area kosong untuk menggeser tampilan.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void download()} className="btn-primary flex-1">
                Unduh PNG
              </button>
              {canShare && (
                <button type="button" onClick={() => void shareImage()} className="btn-ghost flex-1">
                  Bagikan
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={gifW}
                onChange={(e) => setGifW(Number(e.target.value))}
                aria-label="Ukuran GIF"
                disabled={Boolean(gifMsg)}
                className="input w-auto py-1.5 text-xs"
              >
                <option value={360}>GIF kecil</option>
                <option value={480}>GIF sedang</option>
                <option value={640}>GIF besar</option>
              </select>
              <button
                type="button"
                onClick={() => void saveGif(false)}
                disabled={Boolean(gifMsg)}
                className="btn-ghost flex-1 disabled:opacity-60"
              >
                {gifMsg || "Unduh GIF"}
              </button>
              {canShare && (
                <button
                  type="button"
                  onClick={() => void saveGif(true)}
                  disabled={Boolean(gifMsg)}
                  className="btn-ghost disabled:opacity-60"
                >
                  Bagikan
                </button>
              )}
            </div>
            {error && <p className="text-xs text-warning">{error}</p>}
            {info && <p className="text-xs text-success">{info}</p>}
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
                          <span className="grid h-28 place-items-center text-xs text-muted">{t.name}</span>
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
              <div className="flex flex-wrap gap-2">
                {active && (
                  <button
                    type="button"
                    onClick={() => void shareTemplate(active)}
                    className="btn-ghost px-3 py-1.5 text-xs"
                  >
                    Bagikan template
                  </button>
                )}
                <label className="btn-ghost cursor-pointer px-3 py-1.5 text-xs">
                  Impor template
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void importTemplate(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted">
                Menyimpan latar foto, posisi, ukuran, gaya, dan warna. Tersimpan di perangkat ini saja. Untuk
                HP lain: Bagikan template, kirim filenya, lalu Impor di sana.
              </p>
            </section>

            <section className="space-y-2">
              <p className="label">Latar</p>
              <Seg
                label="Jenis latar"
                value={design.bgMode}
                onChange={(v) => setD({ bgMode: v })}
                options={[
                  { id: "gen", label: "Tema" },
                  { id: "custom", label: "Warna" },
                  { id: "image", label: "Foto" },
                ]}
              />
              <div className="space-y-2">
                <label
                  {...dropHandlers}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-3 text-xs text-muted ${
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
                  {bgImg && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bgImg.src}
                      alt="Foto latar"
                      className="h-14 w-10 shrink-0 rounded-md border border-hairline object-cover"
                    />
                  )}
                  <span className="flex-1 text-center">
                    {bgImg
                      ? "Foto tersimpan di kartu ini dan ikut tersimpan di template. Seret atau ketuk untuk ganti."
                      : "Seret foto ke sini atau ketuk untuk pilih. Foto ikut tersimpan di template."}
                  </span>
                </label>
                {bgImg && (
                  <button
                    type="button"
                    onClick={() => {
                      void setBackground(null);
                      setD({ bgMode: "gen" });
                    }}
                    className="text-xs font-semibold text-primary"
                  >
                    Hapus foto
                  </button>
                )}
              </div>
              {design.bgMode === "gen" && (
                <div className="flex flex-wrap items-center gap-2">
                  {PALETTES.map((p, i) => (
                    <button
                      key={p.name}
                      type="button"
                      title={p.name}
                      aria-label={`Tema ${p.name}`}
                      aria-pressed={design.palette === i}
                      onClick={() => setD({ palette: i, color: p.text })}
                      style={{
                        background: `linear-gradient(135deg, ${p.stops[0]}, ${p.stops[1]}, ${p.stops[2]})`,
                      }}
                      className={`focus-ring h-9 w-9 rounded-full border-2 ${
                        design.palette === i ? "border-primary" : "border-hairline"
                      }`}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setD({ seed: design.seed + 1 })}
                    className="btn-ghost px-3 py-1.5 text-xs"
                  >
                    Acak
                  </button>
                </div>
              )}
              {design.bgMode === "custom" && (
                <div className="space-y-3">
                  <ColorField label="Warna awal" value={design.bgA} fallback="#a9dcea" onChange={(v) => setD({ bgA: v })} />
                  <ColorField label="Warna akhir" value={design.bgB} fallback="#6db3d8" onChange={(v) => setD({ bgB: v })} />
                  <Range label="Arah gradasi" value={design.bgAngle} min={0} max={360} step={5} suffix="°" onChange={(v) => setD({ bgAngle: v })} />
                  <div className="flex items-center gap-2">
                    <Toggle label="Gelembung" checked={design.bgDeco} onChange={(v) => setD({ bgDeco: v })} />
                    <button type="button" onClick={() => setD({ seed: design.seed + 1 })} className="btn-ghost px-3 py-1.5 text-xs">
                      Acak
                    </button>
                  </div>
                </div>
              )}
              {design.bgMode === "image" && (
                <div className="space-y-3">
                  <Range label="Kekuatan penutup" value={design.overlay} min={0} max={0.9} step={0.05} onChange={(v) => setD({ overlay: v })} />
                  <ColorField label="Warna penutup" value={design.overlayColor} fallback="#000000" auto onChange={(v) => setD({ overlayColor: v })} />
                </div>
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
                {[...design.order]
                  .reverse()
                  .filter(available)
                  .map((id) => (
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
                      <button
                        type="button"
                        onClick={() => moveLayer(id, 1)}
                        aria-label={`Naikkan lapisan ${EL_NAMES[id]}`}
                        className="focus-ring rounded px-1.5 text-xs text-muted hover:text-ink"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLayer(id, -1)}
                        aria-label={`Turunkan lapisan ${EL_NAMES[id]}`}
                        className="focus-ring rounded px-1.5 text-xs text-muted hover:text-ink"
                      >
                        ▼
                      </button>
                    </li>
                  ))}
              </ul>

              {selected && sel && (
                <div className="space-y-2 rounded-xl border border-hairline bg-surface p-3">
                  <p className="text-xs font-semibold text-ink">Atur: {EL_NAMES[selected]}</p>

                  {selected === "song" && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted">Gaya preview lagu</p>
                      <Seg
                        label="Gaya preview lagu"
                        value={sel.songStyle}
                        onChange={(v) => setEl(selected, { songStyle: v })}
                        options={SONG_STYLES}
                      />
                      <Range label="Ukuran teks lagu" value={sel.songText} min={0.2} max={2} step={0.05} onChange={(v) => setEl(selected, { songText: v })} />
                      <Range label="Ukuran cover / kaset" value={sel.songCover} min={0.2} max={2} step={0.05} onChange={(v) => setEl(selected, { songCover: v })} />
                      {(sel.songStyle === "cover" || sel.songStyle === "pill" || sel.songStyle === "card") && (
                        <Toggle label="Indikator musik (equalizer)" checked={sel.songEq} onChange={(v) => setEl(selected, { songEq: v })} />
                      )}
                    </div>
                  )}

                  <Group title="Posisi & ukuran" open>
                    <Range label="Ukuran" value={sel.size} min={0.3} max={3} step={0.05} onChange={(v) => setEl(selected, { size: v })} />
                    <Range label="Lebar kotak" value={sel.w} min={0.2} max={1.2} step={0.02} onChange={(v) => setEl(selected, { w: v })} />
                    <Range label="Putar" value={sel.rotation} min={-180} max={180} step={1} suffix="°" onChange={(v) => setEl(selected, { rotation: v })} />
                    <Range label="Tinggi (regang)" value={sel.stretch} min={0.2} max={4} step={0.05} onChange={(v) => setEl(selected, { stretch: v })} />
                    <Range label="Posisi X" value={sel.x} min={-0.5} max={1.5} step={0.005} onChange={(v) => { touched.current = true; setEl(selected, { x: v }); }} />
                    <Range label="Posisi Y" value={sel.y} min={-0.3} max={1.2} step={0.005} onChange={(v) => { touched.current = true; setEl(selected, { y: v }); }} />
                    <Range label="Transparansi" value={sel.opacity} min={0.1} max={1} step={0.05} onChange={(v) => setEl(selected, { opacity: v })} />
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
                    <button
                      type="button"
                      onClick={() => setEl(selected, { rotation: 0 })}
                      className="text-xs font-semibold text-primary"
                    >
                      Luruskan (0°)
                    </button>
                  </Group>

                  <Group title="Gaya teks">
                    <label className="block text-xs text-muted">
                      Font
                      <select
                        value={sel.font}
                        onChange={(e) => setEl(selected, { font: e.target.value })}
                        className="input mt-1 py-1.5 text-sm"
                      >
                        <option value="">Ikuti font utama</option>
                        {FONTS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <Toggle label="Tebal" checked={sel.bold} onChange={(v) => setEl(selected, { bold: v })} />
                      <Toggle label="Miring" checked={sel.italic} onChange={(v) => setEl(selected, { italic: v })} />
                      <Toggle label="HURUF BESAR" checked={sel.upper} onChange={(v) => setEl(selected, { upper: v })} />
                    </div>
                    <Range label="Jarak huruf" value={sel.spacing} min={0} max={30} step={1} suffix="px" onChange={(v) => setEl(selected, { spacing: v })} />
                    {HAS_LABEL[selected] && (
                      <Range label="Ukuran label" value={sel.labelSize} min={0.3} max={2} step={0.05} onChange={(v) => setEl(selected, { labelSize: v })} />
                    )}
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
                  </Group>

                  <Group title="Warna & efek">
                    <ColorField label="Warna teks" value={sel.color} fallback={design.color} auto onChange={(v) => setEl(selected, { color: v })} />
                    {HAS_LABEL[selected] && (
                      <ColorField label="Warna label" value={sel.labelColor} fallback={sel.color || design.color} auto onChange={(v) => setEl(selected, { labelColor: v })} />
                    )}
                    {selected === "song" && (
                      <ColorField
                        label={sel.songStyle === "cassette" ? "Warna aksen kaset" : "Warna kartu"}
                        value={sel.fill}
                        fallback={sel.songStyle === "cassette" ? accent : "#ffffff"}
                        auto
                        onChange={(v) => setEl(selected, { fill: v })}
                      />
                    )}
                    <Range label="Garis tepi teks" value={sel.strokeW} min={0} max={20} step={1} suffix="px" onChange={(v) => setEl(selected, { strokeW: v })} />
                    {sel.strokeW > 0 && (
                      <ColorField label="Warna garis tepi" value={sel.strokeColor} fallback="#000000" onChange={(v) => setEl(selected, { strokeColor: v })} />
                    )}
                    <Range label="Bayangan" value={sel.shadowBlur} min={0} max={40} step={1} onChange={(v) => setEl(selected, { shadowBlur: v })} />
                    {sel.shadowBlur > 0 && (
                      <ColorField label="Warna bayangan" value={sel.shadowColor} fallback="#000000" onChange={(v) => setEl(selected, { shadowColor: v })} />
                    )}
                  </Group>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <p className="label">Tampilan umum</p>
              <Seg
                label="Ukuran kartu"
                value={design.ratio}
                onChange={(v) => setDesign((p) => relayoutIfFresh({ ...p, ratio: v }))}
                options={(Object.keys(SIZES) as Ratio[]).map((id) => ({ id, label: SIZES[id].label }))}
              />
              <label className="block text-xs text-muted">
                Font utama
                <select
                  value={design.font}
                  onChange={(e) => setDesign((p) => relayoutIfFresh({ ...p, font: e.target.value }))}
                  className="input mt-1 py-1.5 text-sm"
                >
                  {FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <ColorField label="Warna utama teks" value={design.color} fallback="#0b3d91" onChange={(v) => setD({ color: v })} />
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
