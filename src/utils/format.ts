export function formatRelativeTime(ts: number | Date | null | undefined): string {
  if (!ts) return "";
  const date = typeof ts === "number" ? new Date(ts) : ts;
  const diff = Date.now() - date.getTime();

  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  if (diff < MIN) return "baru saja";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} menit lalu`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} jam lalu`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} hari lalu`;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatNumber(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}rb`;
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function charCount(str: string): number {
  return Array.from(str).length;
}

export function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/** UID pendek untuk tampilan: 6 huruf awal + … + 4 akhir. */
export function shortUid(uid: string | null | undefined): string {
  if (!uid) return "";
  return uid.length > 12 ? `${uid.slice(0, 6)}…${uid.slice(-4)}` : uid;
}
