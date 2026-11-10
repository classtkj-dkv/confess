import { openRouterChat } from "@/lib/ai/openrouter";
import type { SyncedLine } from "@/lib/songs/lyrics";

/**
 * Perbaikan & penyusunan lirik oleh AI (server only) — tugas AI ini KHUSUS
 * musik: pakai key & model sendiri (prefiks MUSIC_AI), terpisah dari AI
 * moderasi confession. Dipanggil saat lagu dipilih di form sebelum mengirim:
 *   1) "fixed"  — lirik LRCLIB dirapikan (typo, label ops, baris terpotong)
 *                 tanpa mengubah timeline.
 *   2) "offset" — estimasi detik MULAI preview 30 dtk Deezer di lagu penuh,
 *                 agar lirik tidak lebih dulu muncul ("terlalu cepet").
 * Semua balasan divalidasi ketat; bila cerai-berai, hasil LRCLIB mentah tetap
 * dipakai dari route /api/songs/lyrics.
 */
export interface LyricAiFix {
  offset: number;
  /** Lirik yang sudah disusun ulang oleh AI. */
  synced: SyncedLine[];
  model: string;
}

const SYSTEM = `Kamu asisten sinkronisasi lirik dengan musik untuk situs confession sekolah berbahasa Indonesia.

Data berisi JSON: { judul, artis, durasi (lama lagu penuh, detik), lirik: baris ber-timestamp dari LRCLIB (mungkin punya salah ketik, label [Verse]/[Chorus], baris dobel, atau baris "♪" yang berarti jeda musik) }.

Deezer preview adalah potongan audio 30 detik dari lagu penuh; biasanya mulai dekat bagian chorus/reff (sekitar 25–50% panjang lagu), tetapi bisa berbeda. Kamu kenal banyak lagu populer — pakai pengetahuanmu tentang struktur lagu ini (intro, verse, reff, durasi) untuk menaksir.

Balas HANYA objek JSON tanpa teks lain, bentuknya:
{"offset":<angka>,"lines":[{"t":<angka>,"text":"...","music":<true|false>}, ...]}

Aturan:
- "offset" = detik saat preview 30 dtk MULAI di dalam lagu penuh. Wajib angka dalam 20 sampai (durasi-25); pilih taksiran paling mungkin, bukan angka bulat asal.
- "lines" = lirik yang SUDAH DIRAPIKAN dengan TIMESTAMP ASLI:
  * perbaiki salah ketik dan tanda baca;
  * buang label seperti [Verse] / [Chorus]; satukan baris terpotong;
  * baris instrumental/jeda ditandai {"music":true} dengan "text":"", hanya pada bagian di mana TIDAK ada vokal;
  * jangan menambah baris yang tidak ada di sumber — buang saja yang meragukan;
  * maksimal 120 baris, tiap "text" maksimal 160 karakter, "t" menaik (tidak turun).`;

function parse(json: string, duration: number): LyricAiFix | null {
  const start = json.indexOf("{");
  const end = json.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(json.slice(start, end + 1)) as Record<string, unknown>;
    const rawOffset = Number(obj.offset);
    // Preview 30 dtk harus muat di dalam lagu penuh.
    const maxOffset = Math.max(0, duration - 10);
    if (!Number.isFinite(rawOffset)) return null;
    const offset = Math.min(maxOffset, Math.max(0, Math.round(rawOffset * 10) / 10));

    if (!Array.isArray(obj.lines)) return null;
    const rows: SyncedLine[] = [];
    for (const item of obj.lines) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const t = Number(o.t);
      if (!Number.isFinite(t) || t < 0 || t > duration + 60) continue;
      const music = o.music === true || o.text === "";
      const text = music ? "" : String(o.text ?? "").replace(/\s+/g, " ").trim();
      if (!music && (text.length < 1 || text.length > 160)) continue;
      rows.push({ t: Math.round(t * 100) / 100, text, music });
    }
    rows.sort((a, b) => a.t - b.t);
    // Buang hasil tak masuk akal: terlalu sedikit baris berarti AI cerai-berai.
    if (rows.length < 2 || rows.length > 120) return null;
    return { offset, synced: rows, model: "" };
  } catch {
    return null;
  }
}

/** Cache antar-request: lagu sama tidak perlu diproses AI lagi (hemat kuota). */
const cache = new Map<string, { at: number; data: LyricAiFix | null; error: string }>();
const TTL = 6 * 60 * 60 * 1000;

export function cachedLyricFix(id: string): LyricAiFix | null {
  return cache.get(id)?.data ?? null;
}

export async function fixLyrics(
  id: string,
  meta: { title: string; artist: string; duration: number },
  source: SyncedLine[]
): Promise<{ fix: LyricAiFix | null; error: string }> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) {
    return { fix: hit.data, error: hit.data ? "" : hit.error };
  }

  const duration = Math.max(30, Math.round(meta.duration || 240));
  // Ringkas barisan LRCLIB biar token tidak bengkak: 80 baris pertama cukup.
  const rows = source.slice(0, 80).map((r) => ({
    t: r.t,
    ...(r.music ? { music: true } : { text: r.text.slice(0, 160) }),
  }));

  let result: LyricAiFix | null = null;
  let error = "";
  if (rows.length >= 4) {
    const chat = await openRouterChat("music", {
      system: SYSTEM,
      user: JSON.stringify({
        judul: meta.title,
        artis: meta.artist,
        durasi: duration,
        lirik: rows,
      }),
      maxTokens: 4000,
      timeoutMs: 40000,
    });
    if (chat.ok) {
      const parsed = parse(chat.ok.text, duration);
      if (parsed) {
        result = { ...parsed, model: chat.ok.model };
        error = "";
      } else {
        error = "AI tidak membalas dalam bentuk lirik yang bisa dipakai.";
      }
    } else {
      error = chat.error;
    }
  } else {
    // Lirik sinkron LRCLIB terlalu tipis — offset dari AI meleset lebih berisiko
    // daripada taksiran kasar di pemutar, jadi bawaan lebih aman dipakai.
    error = "";
  }
  const data = result as LyricAiFix | null;
  cache.set(id, { at: Date.now(), data, error: data ? "" : error });
  return { fix: data, error: data ? "" : error };
}
