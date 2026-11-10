"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./navItems";
import { NavIcon } from "./NavIcon";

const MOBILE_ITEMS = [
  NAV_ITEMS[0],
  NAV_ITEMS[1],
  { href: "/confess", label: "Tulis", icon: "pen" },
  NAV_ITEMS[2],
  NAV_ITEMS[4],
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi utama"
      className="glass-panel fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-hairline pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {MOBILE_ITEMS.map((item) => {
        const isPen = item.icon === "pen";
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
              active ? "text-primary" : "text-muted"
            }`}
          >
            {isPen ? (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary shadow-soft">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" />
                </svg>
              </span>
            ) : (
              <NavIcon name={item.icon} className="h-5 w-5" />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
