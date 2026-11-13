/**
 * Penyelarasan lirik dengan preview 30 dtk Deezer — otomatis, di browser
 * (murni analisa buffer audio; tidak ada biaya AI, tidak ada kalibrasi manual).
 *
 * Prinsipnya: energi band vokal (200 Hz–3,6 kHz) dibagi energi penuh supaya
 * bass/drum tidak mengganggu, lalu dihaluskan. Baris lirik yang dinyanyikan
 * harus jatuh di bagian "hidup vokal", penanda musik/instrumental di bagian
 * tenang. Offset kandidat dengan skor terbaik dipilih → lirik pas walau
 * Deezer tidak memberi tahu di detik berapa preview dimulai di lagu penuh.
 */

export interface AlignRow {
  t: number;
  text: string;
  music?: boolean;
}

export interface AlignResult {
  offset: number;
  /** 0–1; < ~0.45 berarti hasil kurang dipercaya → pemutar pakai fallback. */
  confidence: number;
}

const HOP_MS = 50;
const WIN = 2048; // resolusi frekuensi ≈ 23 Hz @ 48 kHz
const VOCAL_LO = 200;
const VOCAL_HI = 3600;

/** FFT Cooley–Tukey iteratif (panjang data harus kelipatan 2). */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const ar = re[a];
        const ai = im[a];
        const br = re[b] * cr - im[b] * ci;
        const bi = re[b] * ci + im[b] * cr;
        re[a] = ar + br;
        im[a] = ai + bi;
        re[b] = ar - br;
        im[b] = ai - bi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/**
 * Envelope "keterdengaran vokal": tiap 50 ms hitung energi band 200–3600 Hz
 * dibagi energi seluruh spektrum (menghapus pengaruh bass/kick), lalu rata-rata
 * bergerak 3 frame supaya drum sesaat tidak tampil sebagai vokal.
 */
function vocalEnvelope(mono: Float32Array, sampleRate: number): { env: Float32Array; dt: number } {
  const step = Math.max(1, Math.round((HOP_MS / 1000) * sampleRate));
  const frames = Math.max(0, Math.floor((mono.length - WIN) / step) + 1);
  const raw = new Float32Array(frames);
  const re = new Float32Array(WIN);
  const im = new Float32Array(WIN);
  for (let f = 0; f < frames; f++) {
    const base = f * step;
    for (let k = 0; k < WIN; k++) {
      re[k] = mono[base + k] ?? 0;
    }
    im.fill(0);
    fft(re, im);
    let mid = 0;
    let all = 1e-9;
    for (let k = 1; k < WIN / 2; k++) {
      const hz = (k * sampleRate) / WIN;
      const p = re[k] * re[k] + im[k] * im[k];
      all += p;
      if (hz >= VOCAL_LO && hz <= VOCAL_HI) mid += p;
    }
    raw[f] = Math.sqrt(mid / all);
  }
  const env = new Float32Array(frames);
  for (let k = 0; k < frames; k++) {
    const a = raw[Math.max(0, k - 1)];
    const c = raw[k];
    const b = raw[Math.min(frames - 1, k + 1)];
    env[k] = (a + c + b) / 3;
  }
  return { env, dt: step / sampleRate };
}

function quantile(values: Float32Array, q: number): number {
  const copy = Array.from(values).sort((a, b) => a - b);
  if (copy.length === 0) return 0;
  return copy[Math.min(copy.length - 1, Math.max(0, Math.floor(q * copy.length)))];
}

/** Gabungkan kanal jadi satu (mono) untuk analisa. */
export function monoMixdown(buffer: AudioBuffer): Float32Array {
  const len = buffer.length;
  const out = new Float32Array(len);
  const ch = buffer.numberOfChannels;
  for (let c = 0; c < ch; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) out[i] += data[i] / ch;
  }
  return out;
}

/** Titik tengah tiap baris dinyanyikan (di dalam rentang preview yang dinilai). */
function lineCenters(rows: AlignRow[]): number[] {
  const sung = rows.filter((r) => !r.music);
  return sung.map((r, i) => {
    const next = sung[i + 1];
    const maxLen = next ? Math.min(3.5, (next.t - r.t) / 2) : 2;
    return r.t + Math.max(1, maxLen);
  });
}

/**
 * Cari offset terbaik:
 * - skor = rata-rata envelope di titik tengah baris dinyanyikan,
 *   dikurangi envelope di penanda musik (×0,8, sanksi bila "ramai vokal").
 * - Dengan taksiran awal (`priorSec`: estimasi AI) pencarian dibatasi ±25 dtk
 *   supaya pola reff yang berulang tidak menipu ke posisi salah boreh-boreh;
 *   tanpa prior, kandidat 0 .. (akhir lirik − 4 dtk) langkah 0,25 dtk, lalu
 *   kandidat terbaik diasah teliti ±0,3 dtk langkah 0,05 dtk.
 */
const PRIOR_WINDOW = 25;

export function alignPreview(
  rows: AlignRow[],
  mono: Float32Array,
  sampleRate: number,
  priorSec?: number
): AlignResult {
  if (rows.length < 4 || mono.length < sampleRate * 3) return { offset: 0, confidence: 0 };
  const previewDur = Math.max(8, mono.length / sampleRate - WIN / sampleRate);
  const { env, dt } = vocalEnvelope(mono, sampleRate);
  if (env.length === 0) return { offset: 0, confidence: 0 };

  // Normalisasi: 95 persentil jadi 1 (tahan lagu yang keras/lembut).
  const norm = quantile(env, 0.95) || 1;
  for (let i = 0; i < env.length; i++) env[i] = Math.min(1.4, env[i] / norm);

  const centers = lineCenters(rows);
  const musicPos = rows.filter((r) => r.music).map((r) => r.t + 1);
  const last = rows.filter((r) => !r.music).at(-1)?.t ?? previewDur;
  // Offset = posisi preview di lagu PENUH, jadi batasnya ikut durasi lagu,
  // bukan durasi preview. Kandidat yang salah otomatis skip (baris di luar audio).
  const maxOff = Math.max(0, last - 4);
  // Tanpa prior (tanpa AI): cari penuh — jarang alias, dan skor siang/siang di
  // cek rata. Dengan prior (estimasi AI): batasi ±25 dtk supaya pola reff yang
  // berulang tidak menipu ke posisi salah boreh-boreh.
  const windowLo = Math.max(0, (priorSec ?? 0) - PRIOR_WINDOW);
  const windowHi = Math.min(maxOff, (priorSec ?? maxOff) + PRIOR_WINDOW);

  const envAt = (sec: number): number => {
    const i = Math.round(sec / dt);
    return i < 0 || i >= env.length ? 0 : env[i];
  };

  const scores: { off: number; s: number; abs: number }[] = [];
  for (let off = windowLo; off <= windowHi + 0.001; off += 0.25) {
    let s = 0;
    let n = 0;
    let abs = 0;
    for (const c of centers) {
      const pos = c - off;
      if (pos < 0.3 || pos > previewDur - 0.5) continue; // baris harus jatuh di dalam audio
      const v = envAt(pos);
      s += v;
      abs += v;
      n++;
    }
    if (n < 3) continue; // terlalu sedikit data → taksiran tidak berarti
    for (const m of musicPos) {
      const pos = m - off;
      if (pos < 0.3 || pos > previewDur - 0.5) continue;
      s -= envAt(pos) * 0.8;
      n++;
    }
    scores.push({ off, s: s / n, abs: abs / Math.max(1, n) });
  }
  if (scores.length === 0) return { offset: 0, confidence: 0 };

  scores.sort((a, b) => b.s - a.s);
  const best = scores[0];
  // Kandidat kembar (dua puncak lain hampir sama tingginya) = kurang yakin.
  const competitors = scores.filter((x) => Math.abs(x.off - best.off) >= 2);
  let spread = 0;
  if (competitors.length > 0) {
    const top2 = competitors[0].s;
    spread = Math.max(0, best.s - top2);
  }
  const mean = scores.reduce((acc, x) => acc + x.s, 0) / scores.length;

  // keyakinan: berapa banyak best unggul di atas rata-rata + seberapa hidup
  // vokal di titik lirik + seberapa jelas pemenangnya.
  const confLead = Math.min(1, spread * 1.2);
  const confGap = Math.min(1, (best.s - mean) * 10);
  const confAbs = Math.min(1, best.abs * 1.7);
  let confidence = 0.45 * confAbs + 0.3 * confGap + 0.25 * confLead;

  // Diasah ±0,3 dtk: tepatkan bila terpotong sedikit melenceng.
  let refined = best.off;
  let refScore = best.s;
  const lo = Math.max(0, best.off - 0.3);
  const hi = Math.min(maxOff, best.off + 0.3);
  for (let off = lo; off <= hi + 0.001; off += 0.05) {
    let s = 0;
    let n = 0;
    for (const c of centers) {
      const pos = c - off;
      if (pos < 0.3 || pos > previewDur - 0.5) continue;
      s += envAt(pos);
      n++;
    }
    if (n < 3) continue;
    for (const m of musicPos) {
      const pos = m - off;
      if (pos < 0.3 || pos > previewDur - 0.5) continue;
      s -= envAt(pos) * 0.8;
      n++;
    }
    s /= n;
    if (s > refScore) {
      refScore = s;
      refined = off;
    }
  }

  // Skor setelah asah bisa sedikit berubah → kunci keyakinan rentang aman.
  confidence = Math.max(0, Math.min(1, confidence * (0.8 + 0.4 * Math.min(1, refScore / (best.s || 1)))));
  return { offset: Math.round(refined * 10) / 10, confidence };
}
