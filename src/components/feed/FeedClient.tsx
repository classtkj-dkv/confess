"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConfessionCard } from "./ConfessionCard";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { CardSkeleton } from "@/components/ui/Skeletons";
import { loadFeed } from "@/lib/firebase/feed";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import {
  CATEGORIES,
  getCategory,
  isCategoryId,
} from "@/lib/categories";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { CategoryId, Confession, FeedFilter } from "@/types";

const FILTERS: readonly { id: FeedFilter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "latest", label: "Terbaru" },
  { id: "popular", label: "Populer" },
  { id: "random", label: "Random" },
];

type Status = "loading" | "ready" | "empty" | "unconfigured";

export function FeedClient() {
  const params = useSearchParams();
  const searchParam = params.get("search");
  const rawCategory = params.get("category");

  const [filter, setFilter] = useState<FeedFilter>("latest");
  const [category, setCategory] = useState<CategoryId | null>(
    isCategoryId(rawCategory) ? rawCategory : null
  );
  const [items, setItems] = useState<Confession[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const cursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

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

  useEffect(() => {
    cursorRef.current = null;
    fetchData("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, category, searchParam]);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-xl font-bold text-ink">
          {searchParam
            ? `Hasil pencarian: "${searchParam}"`
            : category
              ? `${getCategory(category).emoji} ${getCategory(category).label}`
              : "Feed confession"}
        </h1>
        <p className="text-sm text-muted">
          Semua confession di sini sudah melewati moderasi. Identitas penulis
          tidak pernah ditampilkan.
        </p>
      </header>

      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1" role="toolbar" aria-label="Filter feed">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`focus-ring shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-hairline bg-surface text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
          {searchParam && (
            <button
              type="button"
              onClick={() => setFilter("latest")}
              className="focus-ring shrink-0 rounded-full border border-hairline bg-surface px-4 py-1.5 text-xs text-muted"
            >
              Hapus filter pencarian
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" role="toolbar" aria-label="Kategori">
          <button
            type="button"
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
            className={`focus-ring shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
              category === null
                ? "border-primary bg-primary/15 text-primary"
                : "border-hairline bg-surface text-muted hover:text-ink"
            }`}
          >
            🗂️ Semua kategori
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`focus-ring shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                category === c.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-hairline bg-surface text-muted hover:text-ink"
              }`}
            >
              <span aria-hidden>{c.emoji}</span> {c.label}
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
      ) : items.length === 0 ? (
        <EmptyState
          icon="🍃"
          title="Tidak ada confession di sini"
          description="Belum ada cerita yang cocok dengan filter ini."
        />
      ) : (
        <div className="space-y-4">
          {items.map((c) => (
            <ConfessionCard key={c.id} confession={c} />
          ))}
          {hasMore ? (
            <button
              type="button"
              onClick={() => fetchData("more")}
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
