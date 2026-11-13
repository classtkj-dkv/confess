import Link from "next/link";
import type { Metadata } from "next";
import { CATEGORIES } from "@/lib/categories";
import { HeroSection, CategoryStrip } from "@/components/feed/HomeSections";
import { HomepageFeed } from "@/components/feed/HomepageFeed";

export const metadata: Metadata = {
  title: "CONFESS — Ceritakan apa yang ada di pikiranmu",
};

export default function HomePage() {
  return (
    <div className="space-y-10">
      <HeroSection />

      <section aria-labelledby="feed-title" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="feed-title" className="section-title">
              Confession terbaru
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              Cerita yang baru saja lolos moderasi.
            </p>
          </div>
          <Link href="/feed" className="focus-ring rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Lihat semua →
          </Link>
        </div>
        <HomepageFeed />
      </section>

      <CategoryStrip categories={CATEGORIES} />
    </div>
  );
}
