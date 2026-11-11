/**
 * Klien Deezer (server only). API publik Deezer gratis tanpa API key, tetapi
 * tidak mengizinkan CORS dari browser, jadi semua panggilan lewat route kita.
 * Catatan: Deezer tidak menyediakan lirik; URL preview 30 detik-nya kedaluwarsa,
 * karena itu selalu diambil segar lewat /api/songs/track.
 */
export interface SongInfo {
  id: string;
  title: string;
  artist: string;
  cover: string;
}

export interface SongPreview extends SongInfo {
  preview: string;
  link: string;
  /** Lama lagu penuh dalam detik (untuk penempatan lirik pada preview 30 dtk). */
  duration: number;
  /** Penanda lagu eksplisit dari Deezer (mature content). */
  explicit: boolean;
}

const API = "https://api.deezer.com";

function safeUrl(value: unknown): string {
  try {
    const u = new URL(String(value ?? ""));
    const hostOk = u.hostname === "dzcdn.net" || u.hostname.endsWith(".dzcdn.net");
    return u.protocol === "https:" && hostOk ? u.toString() : "";
  } catch {
    return "";
  }
}

function clip(v: unknown, max: number): string {
  return Array.from(String(v ?? "")).slice(0, max).join("").trim();
}

function mapTrack(t: Record<string, unknown> | null | undefined): SongPreview | null {
  if (!t || t.error || t.id == null) return null;
  const id = String(t.id);
  if (!/^\d{1,12}$/.test(id)) return null;
  const album = (t.album ?? {}) as Record<string, unknown>;
  const artist = (t.artist ?? {}) as Record<string, unknown>;
  const title = clip(t.title_short || t.title, 120);
  if (!title) return null;
  return {
    id,
    title,
    artist: clip(artist.name, 80),
    cover: safeUrl(album.cover_medium || album.cover_big || album.cover),
    preview: safeUrl(t.preview),
    link: `https://www.deezer.com/track/${id}`,
    duration: Math.max(0, Math.round(Number(t.duration) || 0)),
    explicit: t.explicit_lyrics === true,
  };
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function searchTracks(query: string): Promise<SongInfo[]> {
  const data = await getJson(`${API}/search?limit=8&q=${encodeURIComponent(query)}`);
  const list = Array.isArray(data?.data) ? (data!.data as Record<string, unknown>[]) : [];
  const out: SongInfo[] = [];
  for (const raw of list) {
    const t = mapTrack(raw);
    if (t) out.push({ id: t.id, title: t.title, artist: t.artist, cover: t.cover });
  }
  return out;
}

export async function getTrack(id: string): Promise<SongPreview | null> {
  if (!/^\d{1,12}$/.test(id)) return null;
  return mapTrack(await getJson(`${API}/track/${id}`));
}
