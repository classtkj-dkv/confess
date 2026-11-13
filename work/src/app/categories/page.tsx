import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = {
  title: "Kategori",
  description: "Jelajahi confession berdasarkan kategori.",
};

export default function CategoriesPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title">Kategori</h1>
        <p className="page-lead mt-1">
          Pilih topik yang paling pas buat ceritamu.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <li key={c.id}>
            <Link
              href={`/feed?category=${c.id}`}
              className="card card-interactive focus-ring group flex items-start gap-4 p-5"
            >
              <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-xl text-primary transition-colors group-hover:bg-primary/20">
                <Icon name={c.icon} className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold text-ink">{c.label}</span>
                <span className="mt-0.5 block text-sm text-muted">{c.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
