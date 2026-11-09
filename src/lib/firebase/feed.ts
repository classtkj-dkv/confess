"use client";

import {
  endBefore,
  get,
  limitToLast,
  onValue,
  orderByChild,
  query,
  ref,
  equalTo,
  startAt,
  type DataSnapshot,
} from "firebase/database";
import { getRtdb } from "@/lib/firebase/client";
import type {
  CategoryId,
  Confession,
  ConfessionComment,
  FeedFilter,
} from "@/types";

/**
 * Data publik dibaca dari `public/confessions` dan `public/comments/{id}`
 * (proyeksi tanpa authorUid, hanya yang sudah disetujui). Index: createdAt,
 * likesCount, category, messageLower (lihat database.rules.json).
 */
export const FEED_PAGE_SIZE = 8;
const POPULAR_POOL = 100;
const CATEGORY_POOL = 100;
const SEARCH_POOL = 500;

export type Unsubscribe = () => void;

/** Cursor halaman: createdAt+id untuk "terbaru", offset untuk daftar yang diurutkan di memori. */
export type FeedCursor =
  | { kind: "time"; createdAt: number; id: string }
  | { kind: "offset"; offset: number };

export interface FeedPage {
  items: Confession[];
  cursor: FeedCursor | null;
  hasMore: boolean;
}

interface LoadFeedOptions {
  filter: FeedFilter;
  cursor?: FeedCursor | null;
  category?: CategoryId | null;
  search?: string | null;
}

function toConfession(id: string, data: Record<string, unknown>): Confession {
  return {
    id,
    message: String(data.message ?? ""),
    category: (data.category ?? "random") as Confession["category"],
    kind: data.kind === "songfess" ? "songfess" : "menfess",
    fromName: data.fromName ? String(data.fromName) : undefined,
    toName: data.toName ? String(data.toName) : undefined,
    song:
      data.song && typeof data.song === "object"
        ? {
            id: String((data.song as Record<string, unknown>).id ?? ""),
            title: String((data.song as Record<string, unknown>).title ?? ""),
            artist: String((data.song as Record<string, unknown>).artist ?? ""),
            cover: String((data.song as Record<string, unknown>).cover ?? ""),
          }
        : undefined,
    songLyric: data.songLyric ? String(data.songLyric) : undefined,
    createdAt: Number(data.createdAt ?? 0),
    status: "PUBLISHED",
    likesCount: Number(data.likesCount ?? 0),
    commentsCount: Number(data.commentsCount ?? 0),
  };
}

function toComment(
  confessionId: string,
  id: string,
  data: Record<string, unknown>
): ConfessionComment {
  return {
    id,
    confessionId,
    message: String(data.message ?? ""),
    fromName: data.fromName ? String(data.fromName) : undefined,
    parentId: data.parentId ? String(data.parentId) : undefined,
    replyToName: data.replyToName ? String(data.replyToName) : undefined,
    createdAt: Number(data.createdAt ?? 0),
    status: "VISIBLE",
  };
}

function snapToConfessions(snap: DataSnapshot): Confession[] {
  const out: Confession[] = [];
  snap.forEach((c) => {
    out.push(toConfession(String(c.key), c.val() as Record<string, unknown>));
  });
  return out;
}

const byNewest = (a: Confession, b: Confession) =>
  b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1);

function pageFromSorted(sorted: Confession[], offset: number): FeedPage {
  const items = sorted.slice(offset, offset + FEED_PAGE_SIZE);
  const hasMore = sorted.length > offset + FEED_PAGE_SIZE;
  return {
    items,
    cursor: hasMore ? { kind: "offset", offset: offset + FEED_PAGE_SIZE } : null,
    hasMore,
  };
}

function confessionsRef() {
  return ref(getRtdb(), "public/confessions");
}

/** Memuat satu halaman feed (sekali baca). Untuk realtime halaman pertama pakai subscribeLatest. */
export async function loadFeed(opts: LoadFeedOptions): Promise<FeedPage> {
  const search = opts.search?.trim().toLowerCase() ?? "";

  try {
    if (search.length >= 2) {
      // RTDB tidak punya "contains": ambil SEARCH_POOL confession terbaru lalu
      // cocokkan di memori (mencakup kata di tengah kalimat, bukan hanya awalan).
      const snap = await get(
        query(confessionsRef(), orderByChild("createdAt"), limitToLast(SEARCH_POOL))
      );
      let items = snapToConfessions(snap).filter((c) =>
        c.message.toLowerCase().includes(search)
      );
      if (opts.category) items = items.filter((c) => c.category === opts.category);
      return {
        items: items.sort(byNewest).slice(0, 20),
        cursor: null,
        hasMore: false,
      };
    }

    if (opts.filter === "random") {
      const snap = await get(
        query(confessionsRef(), orderByChild("createdAt"), limitToLast(POPULAR_POOL))
      );
      let pool = snapToConfessions(snap);
      if (opts.category) pool = pool.filter((c) => c.category === opts.category);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return { items: pool.slice(0, FEED_PAGE_SIZE), cursor: null, hasMore: false };
    }

    if (opts.filter === "popular") {
      const snap = await get(
        query(
          confessionsRef(),
          orderByChild("likesCount"),
          limitToLast(POPULAR_POOL)
        )
      );
      let pool = snapToConfessions(snap);
      if (opts.category) pool = pool.filter((c) => c.category === opts.category);
      pool.sort((a, b) => b.likesCount - a.likesCount || byNewest(a, b));
      const offset = opts.cursor?.kind === "offset" ? opts.cursor.offset : 0;
      return pageFromSorted(pool, offset);
    }

    // Terbaru / Semua
    if (opts.category) {
      const snap = await get(
        query(confessionsRef(), orderByChild("category"), equalTo(opts.category))
      );
      const sorted = snapToConfessions(snap).sort(byNewest).slice(0, CATEGORY_POOL);
      const offset = opts.cursor?.kind === "offset" ? opts.cursor.offset : 0;
      return pageFromSorted(sorted, offset);
    }

    const constraints =
      opts.cursor?.kind === "time"
        ? [
            orderByChild("createdAt"),
            endBefore(opts.cursor.createdAt, opts.cursor.id),
            limitToLast(FEED_PAGE_SIZE + 1),
          ]
        : [orderByChild("createdAt"), limitToLast(FEED_PAGE_SIZE + 1)];
    const snap = await get(query(confessionsRef(), ...constraints));
    const sorted = snapToConfessions(snap).sort(byNewest);
    const hasMore = sorted.length > FEED_PAGE_SIZE;
    const items = sorted.slice(0, FEED_PAGE_SIZE);
    const last = items[items.length - 1];
    return {
      items,
      cursor: hasMore && last ? { kind: "time", createdAt: last.createdAt, id: last.id } : null,
      hasMore,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("loadFeed failed:", err);
    return { items: [], cursor: null, hasMore: false };
  }
}

/**
 * Realtime: halaman pertama "terbaru". Confession yang baru disetujui admin
 * muncul tanpa refresh. Mengembalikan fungsi unsubscribe.
 */
export function subscribeLatest(
  onData: (items: Confession[]) => void,
  onError?: (err: Error) => void,
  size = FEED_PAGE_SIZE + 1
): Unsubscribe {
  const q = query(confessionsRef(), orderByChild("createdAt"), limitToLast(size));
  return onValue(
    q,
    (snap) => onData(snapToConfessions(snap).sort(byNewest)),
    (err) => onError?.(err)
  );
}

/** Realtime: trending (likes terbanyak dalam periode). */
export function subscribeTrending(
  days: number,
  pageSize: number,
  onData: (items: Confession[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  // Ambil confession dalam periode (index createdAt), lalu urutkan per like di memori.
  const q = query(
    confessionsRef(),
    orderByChild("createdAt"),
    startAt(since),
    limitToLast(200)
  );
  return onValue(
    q,
    (snap) =>
      onData(
        snapToConfessions(snap)
          .filter((c) => c.createdAt >= since)
          .sort((a, b) => b.likesCount - a.likesCount || byNewest(a, b))
          .slice(0, pageSize)
      ),
    (err) => onError?.(err)
  );
}

/** Realtime: satu confession (like/komentar count ikut berubah langsung). */
export function subscribeConfession(
  id: string,
  onData: (c: Confession | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onValue(
    ref(getRtdb(), `public/confessions/${id}`),
    (snap) =>
      onData(snap.exists() ? toConfession(id, snap.val() as Record<string, unknown>) : null),
    (err) => onError?.(err)
  );
}

/** Realtime: komentar tampil milik satu confession. */
export function subscribeComments(
  confessionId: string,
  onData: (items: ConfessionComment[]) => void,
  onError?: (err: Error) => void,
  pageSize = 30
): Unsubscribe {
  const q = query(
    ref(getRtdb(), `public/comments/${confessionId}`),
    orderByChild("createdAt"),
    limitToLast(pageSize)
  );
  return onValue(
    q,
    (snap) => {
      const out: ConfessionComment[] = [];
      snap.forEach((c) => {
        out.push(toComment(confessionId, String(c.key), c.val() as Record<string, unknown>));
      });
      onData(out.sort((a, b) => b.createdAt - a.createdAt));
    },
    (err) => onError?.(err)
  );
}

/** Realtime: statistik beranda dihitung dari 200 confession terbaru yang tayang. */
export function subscribeHomepageStats(
  onData: (s: { total: number; today: number; likes: number }) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(confessionsRef(), orderByChild("createdAt"), limitToLast(200));
  return onValue(
    q,
    (snap) => {
      const startOfDay = new Date().setHours(0, 0, 0, 0);
      let today = 0;
      let likes = 0;
      const items = snapToConfessions(snap);
      items.forEach((c) => {
        if (c.createdAt >= startOfDay) today++;
        likes += c.likesCount;
      });
      onData({ total: items.length, today, likes });
    },
    (err) => onError?.(err)
  );
}
