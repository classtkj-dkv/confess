"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./navItems";
import { NavIcon } from "./NavIcon";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-hairline bg-surface/70 px-4 py-6 backdrop-blur-xl md:flex">
      <Link href="/" className="focus-ring mb-8 rounded-xl px-2 py-1" aria-label="CONFESS — Beranda">
        <SidebarLogo />
      </Link>
      <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/15 text-ink shadow-[inset_3px_0_0_0_rgb(79,107,255)]"
                  : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="rounded-xl border border-hairline bg-card/60 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
        Tanpa nama. Tanpa beban. Tetap jaga keamanan bersama.
      </p>
    </aside>
  );
}

import { Logo } from "@/components/ui/Logo";
function SidebarLogo() {
  return <Logo />;
}
