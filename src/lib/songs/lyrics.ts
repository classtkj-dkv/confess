/**
 * Pencari lirik otomatis (server only) lewat LRCLIB — layanan lirik komunitas
 * gratis tanpa API key. Hasilnya hanya dipakai untuk menyarankan baris yang
 * bisa dipilih pengirim sebagai kutipan singkat (maks. 200 karakter).
 */
const API = "https://lrclib.net/api";
const UA = "CONFESS-school-app (https://github.com/)";

export interface LyricSuggestion {
  lines: string[];
  suggestion: string;
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

export async function findLyrics(title: string, artist: string): Promise<LyricSuggestion | null> {
  const q = new URLSearchParams({ track_name: title, artist_name: artist });
  let raw = plainOf(await getJson(`${API}/get?${q}`));
  if (!raw) {
    const list = await getJson(`${API}/search?${q}`);
    if (Array.isArray(list)) {
      for (const item of list.slice(0, 5)) {
        raw = plainOf(item);
        if (raw) break;
      }
    }
  }
  if (!raw) return null;
  const lines = clean(raw);
  if (lines.length === 0) return null;
  return { lines, suggestion: pickSuggestion(raw, lines) };
}
