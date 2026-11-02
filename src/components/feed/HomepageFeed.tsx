"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConfessionCard } from "./ConfessionCard";
import { EmptyState } from "@/components/ui/States";
import { CardSkeleton } from "@/components/ui/Skeletons";
import { FEED_PAGE_SIZE, loadFeed } from "@/lib/firebase/feed";
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
    let alive = true;
    loadFeed({ filter: "latest", search: null, category: null })
      .then((page) => {
        if (!alive) return;
        setItems(page.items);
        setStatus(page.items.length === 0 ? "empty" : "ready");
      })
      .catch(() => alive && setStatus("empty"));
    return () => {
      alive = false;
    };
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
        icon="🌱"
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
        icon="🛠️"
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
