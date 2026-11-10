"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfessionCard } from "./ConfessionCard";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { CardSkeleton } from "@/components/ui/Skeletons";
import {
  FEED_PAGE_SIZE,
  loadFeed,
  subscribeLatest,
  type FeedCursor,
} from "@/lib/firebase/feed";
import {
  CATEGORIES,
  getCategory,
  isCategoryId,
} from "@/lib/categories";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { CategoryId, Confession, FeedFilter } from "@/types";
import { Icon } from "@/components/ui/Icon";

const FILTERS: readonly { id: FeedFilter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "latest", label: "Terbaru" },
  { id: "popular", label: "Populer" },
  { id: "random", label: "Random" },
];

type Status = "loading" | "ready" | "empty" | "unconfigured";

export function FeedClient() {
  const router = useRouter();
  const params = useSearchParams();
  const searchParam = params.get("search");
  const rawCategory = params.get("category");

  const [filter, setFilter] = useState<FeedFilter>("latest");
  const [category, setCategory] = useState<CategoryId | null>(
    isCategoryId(rawCategory) ? rawCategory : null
  );
  // Sinkronkan kategori bila URL berubah (mis. dari halaman Kategori).
  useEffect(() => {
    setCategory(isCategoryId(rawCategory) ? rawCategory : null);
  }, [rawCategory]);

  const [items, setItems] = useState<Confession[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const cursorRef = useRef<FeedCursor | null>(null);

  // Mode realtime: halaman pertama "terbaru" tanpa kategori/pencarian.
  const realtime =
    (filter === "latest" || filter === "all") && !category && !searchParam;
  const [live, setLive] = useState<Confession[]>([]);
  const [liveMore, setLiveMore] = useState(false);
  const [extra, setExtra] = useState<Confession[]>([]);
  const [extraMore, setExtraMore] = useState<boolean | null>(null);

  const fetchData = useCallback(
    async (mode: "initial" | "more") => {
      if (!isFirebaseConfigured) {
        setStatus("unconfigured");
        return;
      }
      setStatus((s) => (mode === "initial" ? "loading" : s));
      try {
        const page = await loadFeed({
          filter,
          category,
          search: searchParam,
          cursor: mode === "more" ? cursorRef.current : null,
        });
        if (mode === "initial") {
          setItems(page.items);
        } else {
          setItems((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
          });
        }
        cursorRef.current = page.cursor;
        setHasMore(page.hasMore);
        setStatus("ready");
      } catch {
        setStatus("ready");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter, category, searchParam]
  );

  // Mode non-realtime: baca sekali saat filter berubah.
  useEffect(() => {
    if (realtime) return;
    cursorRef.current = null;
    void fetchData("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, category, searchParam, realtime]);

  // Mode realtime: satu listener, selalu di-unsubscribe saat berubah/unmount.
  useEffect(() => {
    if (!realtime) return;
    if (!isFirebaseConfigured) {
      setStatus("unconfigured");
      return;
    }
    setStatus("loading");
    setExtra([]);
    setExtraMore(null);
    const unsub = subscribeLatest(
      (list) => {
        setLive(list.slice(0, FEED_PAGE_SIZE));
        setLiveMore(list.length > FEED_PAGE_SIZE);
        setStatus("ready");
      },
      () => setStatus("ready")
    );
    return unsub;
  }, [realtime]);

  const shown = realtime
    ? [...live, ...extra.filter((e) => !live.some((l) => l.id === e.id))]
    : items;
  const canLoadMore = realtime ? (extraMore ?? liveMore) : hasMore;

  async function loadMore() {
    if (!realtime) {
      await fetchData("more");
      return;
    }
    const last = shown[shown.length - 1];
    if (!last) return;
    const page = await loadFeed({
      filter,
      category: null,
      search: null,
      cursor: { kind: "time", createdAt: last.createdAt, id: last.id },
    });
    setExtra((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
    });
    setExtraMore(page.hasMore);
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="page-title">
          {searchParam
            ? `Hasil pencarian: "${searchParam}"`
            : category
              ? getCategory(category).label
              : "Feed confession"}
        </h1>
        <p className="page-lead max-w-2xl">
          Semua confession di sini sudah melewati moderasi. Identitas penulis
          tidak pernah ditampilkan.
        </p>
      </header>

      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="toolbar" aria-label="Filter feed">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`chip px-4 py-1.5 text-xs font-semibold`}
            >
              {f.label}
            </button>
          ))}
          {searchParam && (
            <button
              type="button"
              onClick={() => {
                setFilter("latest");
                router.push(category ? `/feed?category=${category}` : "/feed");
              }}
              className="chip px-4 py-1.5 text-xs"
            >
              Hapus filter pencarian
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="toolbar" aria-label="Kategori">
          <button
            type="button"
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
            className={`chip px-3 py-1 text-[11px] font-semibold`}
          >
            <Icon name="grid" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" /> Semua kategori
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`chip px-3 py-1 text-[11px] font-semibold`}
            >
              <Icon name={c.icon} className="inline h-3.5 w-3.5 align-[-2px]" /> {c.label}
            </button>
          ))}
        </div>
      </div>

      {status === "loading" ? (
        <div className="space-y-4" aria-live="polite" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : status === "unconfigured" ? (
        <ErrorState
          title="Feed belum tersedia"
          description="Konfigurasi Firebase environment variables terlebih dahulu."
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="sprout"
          title="Tidak ada confession di sini"
          description="Belum ada cerita yang cocok dengan filter ini."
        />
      ) : (
        <div className="space-y-4">
          {shown.map((c) => (
            <ConfessionCard key={c.id} confession={c} />
          ))}
          {canLoadMore ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="btn-ghost w-full"
              aria-label="Muat confession berikutnya"
            >
              Muat lebih banyak ↓
            </button>
          ) : (
            <p className="py-2 text-center text-xs text-muted">
              Semua confession pada filter ini sudah ditampilkan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
