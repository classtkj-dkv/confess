"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { HistoryLink } from "@/components/history/HistoryLink";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { SearchBar } from "./SearchBar";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useSettings } from "@/lib/firebase/useSettings";
import { Icon } from "@/components/ui/Icon";
export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { settings } = useSettings();
  const { isAdmin, loading } = useAuth();

  // Panel admin punya shell sendiri — tidak memakai navigasi publik.
  if (pathname.startsWith("/admin")) return <>{children}</>;

  // Maintenance realtime: semua halaman publik langsung berganti halaman
  // perawatan; staff & halaman /admin tetap bisa diakses.
  if (
    settings.maintenanceMode &&
    !loading &&
    !isAdmin &&
    !pathname.startsWith("/admin")
  ) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-md space-y-4">
          <div aria-hidden className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-warning/15 text-warning ring-8 ring-warning/5">
            <Icon name="wrench" className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-ink">
            {settings.websiteName} sedang dalam perawatan
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            Kami sedang merapikan beberapa hal. Halaman ini akan kembali
            otomatis begitu perawatan selesai — tidak perlu refresh.
          </p>
          {settings.announcement.trim() && (
            <p className="rounded-2xl border border-hairline bg-surface p-4 text-sm text-ink shadow-soft">
              <Icon name="megaphone" className="mr-1.5 inline h-4 w-4 align-[-3px]" />
              {settings.announcement.trim()}
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-panel sticky top-0 z-30 border-x-0 border-t-0 border-b border-hairline">
          <AnnouncementBanner />
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 md:px-6">
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
              {pathname !== "/" && (
                <Link
                  href="/confess"
                  className="btn-primary hidden !rounded-full !px-5 !py-2 text-xs md:inline-flex"
                >
                  Tulis Confess
                </Link>
              )}
              <HistoryLink />
              <NotificationBell />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:px-6 md:pb-14 md:pt-8">
          <InstallPrompt />
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
