import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/Toaster";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ThemeProvider } from "@/lib/auth/ThemeProvider";
import { ToastProvider } from "@/lib/auth/ToastProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://confess.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CONFESS — Ceritakan apa yang ada di pikiranmu",
    template: "%s — CONFESS",
  },
  description:
    "Satu sekolah, ribuan cerita, tanpa perlu diketahui siapa kamu. Platform confession anonim untuk lingkungan sekolah.",
  openGraph: {
    title: "CONFESS",
    description: "Ceritakan apa yang ada di pikiranmu — tanpa perlu diketahui siapa kamu.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#090C16",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" data-theme="dark" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
              <Toaster />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
