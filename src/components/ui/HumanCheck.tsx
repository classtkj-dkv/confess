"use client";

import { useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

/** true bila captcha diaktifkan (NEXT_PUBLIC_TURNSTILE_SITE_KEY terisi saat build). */
export const HUMAN_CHECK_ENABLED = SITE_KEY.length > 0;

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      s.remove();
      reject(new Error("turnstile-load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Widget verifikasi manusia. Token hanya berlaku sekali: setelah tiap
 * percobaan kirim, naikkan `resetSignal` agar widget meminta token baru.
 * Tidak merender apa pun bila captcha tidak diaktifkan.
 */
export function HumanCheck({
  action,
  onToken,
  resetSignal = 0,
  className = "",
}: {
  action: "confession" | "comment";
  onToken: (token: string | null) => void;
  resetSignal?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!HUMAN_CHECK_ENABLED) return;
    let cancelled = false;
    setState("loading");
    loadTurnstile()
      .then(() => {
        const host = hostRef.current;
        if (cancelled || !host || !window.turnstile) return;
        widgetRef.current = window.turnstile.render(host, {
          sitekey: SITE_KEY,
          action,
          language: "id",
          theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
          // 300px "normal" tidak muat di layar ≤ 360px.
          size: window.innerWidth < 380 ? "compact" : "normal",
          callback: (t: string) => onTokenRef.current(t),
          "expired-callback": () => onTokenRef.current(null),
          "timeout-callback": () => onTokenRef.current(null),
          "error-callback": () => {
            onTokenRef.current(null);
            setState("error");
          },
        });
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
      onTokenRef.current(null);
      if (widgetRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetRef.current);
        } catch {
          /* widget sudah hilang */
        }
      }
      widgetRef.current = null;
    };
  }, [action, attempt]);

  // Minta token baru setiap `resetSignal` berubah (kecuali render pertama).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (widgetRef.current && window.turnstile) {
      onTokenRef.current(null);
      try {
        window.turnstile.reset(widgetRef.current);
      } catch {
        /* abaikan */
      }
    }
  }, [resetSignal]);

  if (!HUMAN_CHECK_ENABLED) return null;

  return (
    <div className={className}>
      <div ref={hostRef} className="min-h-[65px]" />
      {state === "loading" && <p className="text-xs text-muted">Memuat verifikasi manusia…</p>}
      {state === "error" && (
        <p role="alert" className="text-xs text-warning">
          Verifikasi tidak bisa dimuat. Periksa koneksi lalu{" "}
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="focus-ring rounded font-semibold underline"
          >
            coba lagi
          </button>
          .
        </p>
      )}
    </div>
  );
}
