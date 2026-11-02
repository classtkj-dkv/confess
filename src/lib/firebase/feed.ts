"use client";

import {
  collection,
  endAt,
  getDocs,
  getCountFromServer,
  limit as fsLimit,
  orderBy as fsOrderBy,
  query,
  startAfter,
  startAt,
  where,
  type DocumentData,
  type Query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type {
  CategoryId,
  Confession,
  ConfessionComment,
  FeedFilter,
} from "@/types";

export const FEED_PAGE_SIZE = 8;

export interface FeedPage {
  items: Confession[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

interface LoadFeedOptions {
  filter: FeedFilter;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  category?: CategoryId | null;
  search?: string | null;
}

function toConfession(d: QueryDocumentSnapshot<DocumentData>): Confession {
  const data = d.data() as Record<string, unknown>;
  const rawCreated = data.createdAt as { toMillis?: () => number } | number;
  const createdAt =
    typeof rawCreated === "number"
      ? rawCreated
      : typeof rawCreated?.toMillis === "function"
        ? rawCreated.toMillis()
        : 0;
  return {
    id: d.id,
    message: String(data.message ?? ""),
    category: (data.category ?? "random") as Confession["category"],
    authorUid: String(data.authorUid ?? ""),
    createdAt,
    status: (data.status ?? "PENDING") as Confession["status"],
    likesCount: Number(data.likesCount ?? 0),
    commentsCount: Number(data.commentsCount ?? 0),
  };
}

function toComment(
  d: QueryDocumentSnapshot<DocumentData>
): ConfessionComment {
  const data = d.data() as Record<string, unknown>;
  const rawCreated = data.createdAt as { toMillis?: () => number } | number;
  return {
    id: d.id,
    confessionId: String(data.confessionId ?? ""),
    authorUid: String(data.authorUid ?? ""),
    message: String(data.message ?? ""),
    createdAt: typeof rawCreated === "number" ? rawCreated : rawCreated?.toMillis?.() ?? 0,
    status: (data.status ?? "VISIBLE") as ConfessionComment["status"],
  };
}

/** Base constraints shared by every feed query. */
function baseConstraints(opts: LoadFeedOptions): QueryConstraint[] {
  const clauses: QueryConstraint[] = [where("status", "==", "PUBLISHED")];
  if (opts.category) clauses.push(where("category", "==", opts.category));
  return clauses;
}

export async function loadFeed(opts: LoadFeedOptions): Promise<FeedPage> {
  const search = opts.search?.trim().toLowerCase() ?? "";
  const pageSize = FEED_PAGE_SIZE;

  try {
    if (search.length >= 2) {
      const q = query(
        collection(getDb(), "confessions"),
        ...baseConstraints(opts),
        fsOrderBy("messageLower"),
        startAt(search),
        endAt(`${search}\uf8ff`),
        fsLimit(20)
      );
      const snap = await getDocs(q);
      return {
        items: snap.docs
          .map(toConfession)
          .sort((a, b) => b.createdAt - a.createdAt),
        cursor: null,
        hasMore: false,
      };
    }

    if (opts.filter === "random") {
      const countSnap = await getCountFromServer(
        query(collection(getDb(), "confessions"), ...baseConstraints(opts))
      );
      const total = countSnap.data().count;
      if (total === 0) return { items: [], cursor: null, hasMore: false };
      const maxOffset = Math.max(0, total - pageSize);
      const jump = Math.floor(Math.random() * (maxOffset + 1));
      // Firestore v13 removed the `offset()` helper; emulate the jump by
      // fetching the newest (jump + pageSize) docs and keeping the last window.
      const q = query(
        collection(getDb(), "confessions"),
        ...baseConstraints(opts),
        fsOrderBy("createdAt", "desc"),
        fsLimit(jump + pageSize)
      );
      const snap = await getDocs(q);
      const docs = snap.docs;
      const start = Math.max(0, docs.length - pageSize);
      return {
        items: docs.slice(start).map(toConfession),
        cursor: null,
        hasMore: false,
      };
    }

    const ordering: QueryConstraint[] =
      opts.filter === "popular"
        ? [fsOrderBy("likesCount", "desc"), fsOrderBy("createdAt", "desc")]
        : [fsOrderBy("createdAt", "desc")];

    const constraints: QueryConstraint[] = [
      ...baseConstraints(opts),
      ...ordering,
      fsLimit(pageSize + 1),
    ];
    if (opts.cursor) constraints.push(startAfter(opts.cursor));

    const q: Query<DocumentData> = query(
      collection(getDb(), "confessions"),
      ...constraints
    );

    const snap = await getDocs(q);
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    return {
      items: docs.slice(0, pageSize).map(toConfession),
      cursor: hasMore ? (docs[pageSize - 1] ?? null) : null,
      hasMore,
    };
  } catch (err) {
    // Missing index / offline / rules change — degrade to an empty page.
    // eslint-disable-next-line no-console
    console.warn("loadFeed failed:", err);
    return { items: [], cursor: null, hasMore: false };
  }
}

export async function loadTrending(days = 3, pageSize = 12): Promise<Confession[]> {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const q = query(
    collection(getDb(), "confessions"),
    where("status", "==", "PUBLISHED"),
    fsOrderBy("likesCount", "desc"),
    fsLimit(50)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(toConfession)
    .filter((c) => c.createdAt >= since)
    .slice(0, pageSize);
}

export async function loadHomepageStats(): Promise<{
  total: number;
  today: number;
  likes: number;
}> {
  const base = query(
    collection(getDb(), "confessions"),
    where("status", "==", "PUBLISHED")
  );
  const totalSnap = await getCountFromServer(base);
  const snap = await getDocs(base);
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  let today = 0;
  let likes = 0;
  snap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const created = data.createdAt as { toMillis?: () => number } | number;
    const ms = typeof created === "number" ? created : created?.toMillis?.() ?? 0;
    if (ms >= startOfDay) today++;
    likes += Number(data.likesCount ?? 0);
  });
  return { total: totalSnap.data().count, today, likes };
}

export async function loadConfession(id: string): Promise<Confession | null> {
  const { doc, getDoc } = await import("firebase/firestore");
  const d = await getDoc(doc(getDb(), "confessions", id));
  if (!d.exists()) return null;
  const c = toConfession(d as QueryDocumentSnapshot<DocumentData>);
  return c.status === "PUBLISHED" ? c : null;
}

export async function loadComments(
  confessionId: string,
  pageSize = 30
): Promise<ConfessionComment[]> {
  const q = query(
    collection(getDb(), "comments"),
    where("confessionId", "==", confessionId),
    where("status", "==", "VISIBLE"),
    fsOrderBy("createdAt", "desc"),
    fsLimit(pageSize)
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map(toComment);
  } catch {
    return [];
  }
}
