/**
 * Riwayat confess yang pernah dikirim dari browser/HP ini.
 * Disimpan HANYA di localStorage perangkat (tidak dikirim/disimpan di server),
 * jadi tidak ikut pindah ke perangkat lain dan hilang bila data browser dihapus.
 */
export interface HistoryEntry {
  id: string;
  message: string;
  category: string;
  fromName?: string;
  toName?: string;
  song?: { title: string; artist: string };
  createdAt: number;
  /** Status saat dikirim: tayang langsung (lolos AI) atau menunggu moderator. */
  status: "PENDING" | "PUBLISHED";
}

const KEY = "confess:history:v1";
const MAX_ENTRIES = 100;
export const HISTORY_EVENT = "confess:history-changed";

function isEntry(v: unknown): v is HistoryEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.message === "string" &&
    typeof e.category === "string" &&
    typeof e.createdAt === "number" &&
    (e.status === "PENDING" || e.status === "PUBLISHED")
  );
}

export function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function write(list: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch {
    /* penyimpanan penuh / diblokir: riwayat bersifat tambahan */
  }
}

export function addHistory(entry: HistoryEntry): void {
  const rest = readHistory().filter((e) => e.id !== entry.id);
  write([entry, ...rest]);
}

export function removeHistory(id: string): void {
  write(readHistory().filter((e) => e.id !== id));
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch {
    /* abaikan */
  }
}
