"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NavIcon } from "./NavIcon";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { SearchBar } from "./SearchBar";
import { AnnouncementBanner } from "./AnnouncementBanner";
export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-panel sticky top-0 z-30 border-b border-hairline">
          <AnnouncementBanner />
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <Link
              href="/"
              className="focus-ring rounded-lg md:hidden"
              aria-label="CONFESS — Beranda"
            >
              <Logo compact />
            </Link>
            <div className="hidden flex-1 md:flex md:max-w-md">
              <SearchBar />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/confess"
                className="btn-primary hidden !py-2 text-xs md:inline-flex"
              >
                Tulis Confess
              </Link>
              <div className="hidden md:block">
                <ThemeToggle />
              </div>
              <Link
                href="/about"
                aria-label="Tentang CONFESS"
                className={`focus-ring grid h-9 w-9 place-items-center rounded-lg border border-hairline transition-colors ${
                  pathname === "/about"
                    ? "bg-primary/15 text-primary"
                    : "bg-surface text-muted md:hidden"
                }`}
                title="Tentang"
              >
                <NavIcon name="about" className="h-4 w-4" />
              </Link>
              <div className="md:hidden">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 md:pb-12">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
