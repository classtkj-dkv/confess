"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConfessionCard } from "./ConfessionCard";
import { EmptyState } from "@/components/ui/States";
import { CardSkeleton } from "@/components/ui/Skeletons";
import { FEED_PAGE_SIZE, subscribeLatest } from "@/lib/firebase/feed";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import type { Confession } from "@/types";

type Status = "loading" | "ready" | "empty" | "unconfigured";

export function HomepageFeed() {
  const [items, setItems] = useState<Confession[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setStatus("unconfigured");
      return;
    }
    // Realtime: confession yang baru disetujui langsung muncul di beranda.
    const unsub = subscribeLatest(
      (list) => {
        const page = list.slice(0, FEED_PAGE_SIZE);
        setItems(page);
        setStatus(page.length === 0 ? "empty" : "ready");
      },
      () => setStatus("empty")
    );
    return unsub;
  }, []);

  if (status === "loading") {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: FEED_PAGE_SIZE }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (status === "empty") {
    return (
      <EmptyState
        icon="sprout"
        title="Belum ada confession"
        description="Jadilah yang pertama berbagi cerita hari ini."
        action={
          <Link href="/confess" className="btn-primary">
            Tulis Confess
          </Link>
        }
      />
    );
  }

  if (status === "unconfigured") {
    return (
      <EmptyState
        icon="wrench"
        title="Feed belum tersedia"
        description="Konfigurasi Firebase sebelum mencoba feed."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map((c) => (
        <ConfessionCard key={c.id} confession={c} compact />
      ))}
    </div>
  );
}
