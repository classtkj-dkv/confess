"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "confess:pwa-dismissed";
const HIDE_DAYS = 14;

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return at > 0 && Date.now() - at < HIDE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Ajakan memasang CONFESS ke layar utama. Android/Chrome memakai prompt
 * bawaan browser; iOS Safari tidak punya prompt, jadi ditampilkan petunjuk.
 * Disembunyikan 14 hari setelah ditutup dan tidak muncul bila sudah terpasang.
 */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const ua = navigator.userAgent;
    const isIos =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) {
      setIos(true);
      setHidden(false);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => {
      setEvent(null);
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* abaikan */
    }
  }

  async function install() {
    if (!event) return;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "dismissed") dismiss();
    } catch {
      /* abaikan */
    }
    setEvent(null);
    setHidden(true);
  }

  if (hidden || (!event && !ios)) return null;

  return (
    <aside
      aria-label="Pasang aplikasi"
      className="card mb-5 flex items-start gap-3 border-primary/30 bg-primary/5 p-4"
    >
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white">
        <Icon name="download" className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-ink">Pasang CONFESS di layar utama</p>
        {event ? (
          <p className="text-xs leading-relaxed text-muted">
            Buka lebih cepat seperti aplikasi, tanpa bar browser.
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-muted">
            Ketuk tombol Bagikan di Safari, lalu pilih <b className="text-ink">Tambah ke Layar Utama</b>.
          </p>
        )}
        {event && (
          <button type="button" onClick={() => void install()} className="btn-primary mt-2 !px-4 !py-2 text-xs">
            Pasang sekarang
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tutup ajakan pasang"
        className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
      >
        <Icon name="close" className="h-4 w-4" />
      </button>
    </aside>
  );
}
