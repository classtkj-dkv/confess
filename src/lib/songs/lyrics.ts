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
  text: string;
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

function syncedOf(v: unknown): SyncedLine[] {
  if (!v || typeof v !== "object") return [];
  const raw = (v as Record<string, unknown>).syncedLyrics;
  if (typeof raw !== "string") return [];
  const out: SyncedLine[] = [];
  for (const row of raw.split(/\r?\n/)) {
    const re = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(row))) {
      const t = Number(m[1]) * 60 + Number(m[2].replace(":", "."));
      if (Number.isFinite(t)) stamps.push(Math.round(t * 100) / 100);
    }
    if (stamps.length === 0) continue;
    const text = row.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 160) continue;
    for (const t of stamps) out.push({ t, text });
  }
  return out.sort((a, b) => a.t - b.t).slice(0, 300);
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
