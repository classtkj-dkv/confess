"use client";

import Link from "next/link";
import { SearchBar } from "@/components/layout/SearchBar";
import type { CategoryMeta } from "@/lib/categories";
import { Icon } from "@/components/ui/Icon";

export function HeroSection() {
  return (
    <section className="rounded-2xl border border-hairline bg-card p-6 sm:p-10">
      <div className="relative max-w-xl">
        <span className="badge border-primary/25 bg-primary/10 !text-primary">
          <Icon name="eyeoff" className="h-3.5 w-3.5" /> 100% anonim
        </span>
        <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
          Ceritakan apa yang ada di{" "}
          <span className="text-gradient">pikiranmu</span>.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
          Satu sekolah, ribuan cerita, tanpa perlu diketahui siapa kamu.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/confess" className="btn-primary sm:w-auto">
            <Icon name="pencil" className="mr-1.5 h-4 w-4" /> Tulis Confess
          </Link>
        </div>
        <div className="mt-6 max-w-sm md:hidden">
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
        <h2 id="cat-title" className="section-title">
          Kategori populer
        </h2>
        <Link href="/categories" className="focus-ring rounded-md text-sm font-semibold text-primary hover:underline underline-offset-4">
          Semua kategori →
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              href={`/feed?category=${c.id}`}
              className="card card-interactive focus-ring group flex items-center gap-3 p-4"
            >
              <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
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
