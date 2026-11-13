"use client";

import { useEffect } from "react";

/**
 * Mendaftarkan service worker (hanya di production). SW tidak menyimpan
 * halaman/API apa pun; ia hanya mempercepat aset statis dan menampilkan
 * halaman offline saat tidak ada koneksi.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* PWA bersifat tambahan; gagal daftar tidak mengganggu situs */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
