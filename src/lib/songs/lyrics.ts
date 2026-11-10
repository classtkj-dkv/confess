/**
 * Pencari lirik otomatis (server only) lewat LRCLIB — layanan lirik komunitas
 * gratis tanpa API key. Hasilnya hanya dipakai untuk menyarankan baris yang
 * bisa dipilih pengirim sebagai kutipan singkat (maks. 200 karakter).
 */
const API = "https://lrclib.net/api";
const UA = "CONFESS-school-app (https://github.com/)";

export interface SyncedLine {
  /** Detik posisi baris di lagu penuh. */
  t: number;
  /** Teks lirik; kosong kalau ini jeda musik. */
  text: string;
  /** true = bagian musik/instrumental (ditampilkan sebagai ikon nada, bukan teks). */
  music?: boolean;
}

export interface LyricSuggestion {
  lines: string[];
  suggestion: string;
  /** Lirik ber-timestamp (kosong kalau LRCLIB tidak punya versi synced). */
  synced: SyncedLine[];
}

async function getJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function plainOf(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  const o = v as Record<string, unknown>;
  if (typeof o.plainLyrics === "string" && o.plainLyrics.trim()) return o.plainLyrics;
  // Fallback: buang penanda waktu dari lirik ber-timestamp.
  if (typeof o.syncedLyrics === "string") return o.syncedLyrics.replace(/^\[[^\]]*\]\s*/gm, "");
  return "";
}

function clean(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of raw.split(/\r?\n/)) {
    const line = l.replace(/\s+/g, " ").trim();
    if (line.length < 8 || line.length > 120) continue;
    if (/^[\[(].*[\])]$/.test(line)) continue; // [Chorus], (Verse 1)
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= 80) break;
  }
  return out;
}

/** Baris yang paling sering diulang (biasanya reff); kalau tidak ada, baris pertama. */
function pickSuggestion(raw: string, lines: string[]): string {
  const count = new Map<string, number>();
  for (const l of raw.split(/\r?\n/)) {
    const k = l.replace(/\s+/g, " ").trim().toLowerCase();
    if (k.length >= 8) count.set(k, (count.get(k) ?? 0) + 1);
  }
  let best = "";
  let bestN = 1;
  for (const l of lines) {
    const n = count.get(l.toLowerCase()) ?? 1;
    if (n > bestN) {
      best = l;
      bestN = n;
    }
  }
  return best || lines[0] || "";
}

/** Penanda instrumental yang sering ditulis kontributor LRCLIB. */
const MUSIC_TAG = /^[\s♪♫🎵🎶*#~\-–—_.…]*(?:[\[(]?\s*(?:instrumental|instru|music|musik|intro|outro|interlude|solo|bridge)\s*[\])]?)?[\s♪♫🎵🎶*#~\-–—_.…]*$/i;

function isMusicText(text: string): boolean {
  return !text || MUSIC_TAG.test(text);
}

/**
 * Baris kosong / "♪" / "[Instrumental]" => jeda musik. Selain itu, celah panjang
 * antar-baris (intro, interlude, outro) otomatis diberi penanda musik juga,
 * seperti di Spotify. Baris yang diulang tetap disimpan semuanya (tiap kemunculan
 * punya waktunya sendiri).
 */
function withMusicGaps(rows: SyncedLine[]): SyncedLine[] {
  const out: SyncedLine[] = [];
  const push = (r: SyncedLine) => {
    const prev = out[out.length - 1];
    if (r.music && prev?.music) return; // jangan menumpuk dua penanda musik
    out.push(r);
  };
  if (rows.length > 0 && !rows[0].music && rows[0].t >= 5) push({ t: 0, text: "", music: true });
  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i];
    push(cur);
    const next = rows[i + 1];
    if (!next || cur.music || next.music) continue;
    // perkiraan lamanya satu baris dinyanyikan: ~0.08 dtk per huruf, 2.5–7 dtk
    const sung = Math.min(7, Math.max(2.5, cur.text.length * 0.08 + 1.2));
    if (next.t - cur.t - sung >= 5) push({ t: Math.round((cur.t + sung) * 100) / 100, text: "", music: true });
  }
  return out;
}

function syncedOf(v: unknown): SyncedLine[] {
  if (!v || typeof v !== "object") return [];
  const raw = (v as Record<string, unknown>).syncedLyrics;
  if (typeof raw !== "string") return [];
  const rows: SyncedLine[] = [];
  for (const row of raw.split(/\r?\n/)) {
    const re = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(row))) {
      const t = Number(m[1]) * 60 + Number(m[2].replace(":", "."));
      if (Number.isFinite(t)) stamps.push(Math.round(t * 100) / 100);
    }
    if (stamps.length === 0) continue; // metadata seperti [ar:...] / [ti:...] ikut terbuang
    const text = row
      .replace(/\[[^\]]*\]/g, "") // penanda waktu
      .replace(/<[^>]*>/g, "") // penanda per-kata (format enhanced)
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 160) continue;
    const music = isMusicText(text);
    // satu baris dengan banyak timestamp = lirik yang diulang; semuanya dipakai
    for (const t of stamps) rows.push(music ? { t, text: "", music: true } : { t, text });
  }
  rows.sort((a, b) => a.t - b.t);
  return withMusicGaps(rows).slice(0, 400);
}

function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function related(a: string, b: string): boolean {
  return !!a && !!b && (a.includes(b) || b.includes(a));
}

/** Hasil pencarian bebas hanya dipakai kalau judul & artisnya mirip. */
function sameSong(item: unknown, title: string, artist: string): boolean {
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  return related(norm(o.trackName), norm(title)) && related(norm(o.artistName), norm(artist));
}

async function findRecord(title: string, artist: string): Promise<unknown | null> {
  const exact = new URLSearchParams({ track_name: title, artist_name: artist });
  const direct = await getJson(`${API}/get?${exact}`);
  let best: unknown | null = plainOf(direct) ? direct : null;
  if (best && syncedOf(best).length > 0) return best;

  const free = new URLSearchParams({ q: `${title} ${artist}` });
  const [a, b] = await Promise.all([
    getJson(`${API}/search?${exact}`),
    getJson(`${API}/search?${free}`),
  ]);
  const pool = [a, b].flatMap((l) => (Array.isArray(l) ? l.slice(0, 8) : []));
  for (const item of pool) {
    if (!sameSong(item, title, artist)) continue;
    if (syncedOf(item).length > 0) return item;
    if (!best && plainOf(item)) best = item;
  }
  return best;
}

export async function findLyrics(title: string, artist: string): Promise<LyricSuggestion | null> {
  const rec = await findRecord(title, artist);
  if (!rec) return null;
  const raw = plainOf(rec);
  const synced = syncedOf(rec);
  const lines = clean(raw);
  if (lines.length === 0 && synced.length === 0) return null;
  return { lines, suggestion: pickSuggestion(raw, lines), synced };
}
