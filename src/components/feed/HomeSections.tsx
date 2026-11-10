"use client";

import Link from "next/link";
import { SearchBar } from "@/components/layout/SearchBar";
import type { CategoryMeta } from "@/lib/categories";
import { Icon } from "@/components/ui/Icon";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-hairline bg-surface p-6 sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-secondary/15 blur-3xl"
      />
      <div className="relative max-w-xl">
        <span className="badge">
          <Icon name="eyeoff" className="h-3.5 w-3.5" /> 100% anonim
        </span>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
          Ceritakan apa yang ada di{" "}
          <span className="text-primary">pikiranmu</span>.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
          Satu sekolah, ribuan cerita, tanpa perlu diketahui siapa kamu.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/confess" className="btn-primary sm:w-auto">
            <Icon name="pencil" className="mr-1.5 h-4 w-4" /> Tulis Confess
          </Link>
          <Link href="/feed" className="btn-ghost sm:w-auto">
            Lihat feed
          </Link>
        </div>
        <div className="mt-6 max-w-sm">
          <SearchBar />
        </div>
      </div>
    </section>
  );
}

export function CategoryStrip({
  categories,
}: {
  categories: readonly CategoryMeta[];
}) {
  return (
    <section aria-labelledby="cat-title" className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 id="cat-title" className="text-lg font-bold text-ink">
          Kategori populer
        </h2>
        <Link href="/categories" className="focus-ring rounded-md text-sm font-semibold text-primary">
          Semua kategori →
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              href={`/feed?category=${c.id}`}
              className="card focus-ring flex items-center gap-3 p-4 transition-shadow hover:shadow-lift"
            >
              <span aria-hidden className="text-primary">
                <Icon name={c.icon} className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{c.label}</span>
                <span className="line-clamp-1 block text-[11px] text-muted">{c.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
