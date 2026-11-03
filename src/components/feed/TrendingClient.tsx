"use client";

import { useEffect, useState } from "react";
import { ConfessionCard } from "@/components/feed/ConfessionCard";
import { EmptyState } from "@/components/ui/States";
import { CardSkeleton } from "@/components/ui/Skeletons";
import { subscribeTrending } from "@/lib/firebase/feed";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { Confession } from "@/types";

const PERIODS = [
  { days: 1, label: "Hari ini" },
  { days: 3, label: "3 hari" },
  { days: 7, label: "7 hari" },
] as const;

export function TrendingClient() {
  const [days, setDays] = useState<number>(3);
  const [items, setItems] = useState<Confession[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setStatus("empty");
      return;
    }
    setStatus("loading");
    // Realtime; listener dilepas saat periode berubah / komponen dilepas.
    const unsub = subscribeTrending(
      days,
      10,
      (res) => {
        setItems(res);
        setStatus(res.length === 0 ? "empty" : "ready");
      },
      () => setStatus("empty")
    );
    return unsub;
  }, [days]);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
            🔥 Trending
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Confession paling banyak disukai dalam periode terpilih.
          </p>
        </div>
        <div role="toolbar" aria-label="Periode trending" className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              aria-pressed={days === p.days}
              onClick={() => setDays(p.days)}
              className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                days === p.days
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-hairline bg-surface text-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {status === "loading" ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : status === "empty" ? (
        <EmptyState
          icon="📉"
          title="Belum ada yang trending"
          description="Interaksi confession dalam periode ini masih sepi. Coba periode lain."
        />
      ) : (
        <div className="space-y-4">
          {items.map((c, i) => (
            <div key={c.id} className="flex gap-3">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-extrabold text-primary"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <ConfessionCard confession={c} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
