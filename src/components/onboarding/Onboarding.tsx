"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import {
  OPEN_ONBOARDING_EVENT,
  hasSeenOnboarding,
  markOnboardingSeen,
} from "@/lib/onboarding";

interface Slide {
  title: string;
  art: ReactNode;
  body: ReactNode;
}

function Num({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-white"
    >
      {n}
    </span>
  );
}

function Point({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-left">
      <span
        aria-hidden
        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
      >
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="text-sm leading-relaxed text-ink/85">{children}</span>
    </li>
  );
}

function Box({
  n,
  children,
  className = "",
}: {
  n: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[11px] text-muted ${className}`}
    >
      {children}
      <span className="absolute -right-1.5 -top-2">
        <Num n={n} />
      </span>
    </div>
  );
}

function Legend({ items }: { items: { n: number; title: string; text: string }[] }) {
  return (
    <ol className="mt-4 space-y-2.5 text-left">
      {items.map((it) => (
        <li key={it.n} className="flex items-start gap-3">
          <Num n={it.n} />
          <span className="text-[13px] leading-relaxed text-muted">
            <b className="text-ink">{it.title}</b> {it.text}
          </span>
        </li>
      ))}
    </ol>
  );
}

const SLIDES: Slide[] = [
  {
    title: "Selamat datang di CONFESS",
    art: (
      <div className="grid h-24 place-items-center">
        <span className="grid h-20 w-20 place-items-center rounded-3xl bg-primary/10 ring-1 ring-primary/30">
          <span className="inline-block scale-[2.2]">
            <Logo compact />
          </span>
        </span>
      </div>
    ),
    body: (
      <>
        <p className="text-sm leading-relaxed text-muted">
          CONFESS adalah platform untuk menyampaikan pesan di lingkungan sekolah. Pengiriman tidak
          memerlukan akun. Pesan ditampilkan sebagai <b className="text-ink">Anonim</b>, kecuali
          pengirim memilih untuk mengisi nama.
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] font-semibold">
          <li className="badge">Tanpa akun</li>
          <li className="badge">Dimoderasi</li>
          <li className="badge">Identitas opsional</li>
        </ul>
        <p className="mt-4 text-xs text-muted">
          Panduan ini dapat dilewati, dan dibuka kembali kapan saja melalui tautan “Lihat tutorial”.
        </p>
      </>
    ),
  },
  {
    title: "Mengisi formulir (1 dari 2)",
    art: (
      <div className="space-y-2.5 rounded-2xl border border-hairline bg-background/70 p-3 text-left">
        <div className="grid grid-cols-2 gap-2.5">
          <Box n={1}>Dari</Box>
          <Box n={2}>Untuk</Box>
        </div>
        <Box n={3} className="pb-7 pt-2">
          Tulis pesan di sini
        </Box>
      </div>
    ),
    body: (
      <Legend
        items={[
          {
            n: 1,
            title: "Dari (opsional).",
            text: "Nama atau inisial pengirim. Jika dikosongkan, pesan tampil sebagai Anonim. Jika diisi, nama tersebut terlihat oleh semua pengguna.",
          },
          {
            n: 2,
            title: "Untuk (opsional).",
            text: "Nama panggilan penerima pesan. Jika diisi, terlihat oleh semua pengguna. Jangan mencantumkan data pribadi seperti nomor telepon atau alamat.",
          },
          {
            n: 3,
            title: "Isi confess.",
            text: "Pesan utama. Gunakan bahasa yang jelas dan sopan, hindari tautan, dan perhatikan batas panjang pesan yang tertera pada formulir.",
          },
        ]}
      />
    ),
  },
  {
    title: "Mengisi formulir (2 dari 2)",
    art: (
      <div className="space-y-2.5 rounded-2xl border border-hairline bg-background/70 p-3 text-left">
        <Box n={4}>Cari judul atau artis</Box>
        <Box n={5} className="flex flex-wrap gap-1.5">
          <span className="chip px-2 py-0.5 text-[10px] font-semibold">School</span>
          <span className="chip px-2 py-0.5 text-[10px] font-semibold">Friendship</span>
          <span className="chip px-2 py-0.5 text-[10px] font-semibold">Life</span>
        </Box>
        <Box n={6}>Pernyataan dan verifikasi manusia</Box>
      </div>
    ),
    body: (
      <Legend
        items={[
          {
            n: 4,
            title: "Lagu (opsional).",
            text: "Cari judul atau artis. Tombol putar memperdengarkan cuplikan 30 detik sebelum lagu dipilih. Kutipan lirik bersifat opsional (maksimal 200 karakter).",
          },
          {
            n: 5,
            title: "Kategori.",
            text: "Pilih satu kategori yang paling sesuai dengan isi pesan.",
          },
          {
            n: 6,
            title: "Pernyataan dan verifikasi.",
            text: "Centang pernyataan bahwa pesan ditulis dengan jujur dan tanpa data pribadi orang lain. Bila verifikasi manusia ditampilkan, selesaikan terlebih dahulu, lalu tekan Kirim.",
          },
        ]}
      />
    ),
  },
  {
    title: "Pemeriksaan sebelum tayang",
    art: (
      <ul className="space-y-3">
        <Point icon="shield">
          Setiap pesan diperiksa secara otomatis (AI) dan/atau oleh moderator sebelum ditayangkan.
        </Point>
        <Point icon="check">
          Pesan yang sesuai aturan ditayangkan. Pesan yang perlu diperbaiki dikembalikan beserta
          keterangannya.
        </Point>
        <Point icon="flag">
          Tidak diperbolehkan: perundungan, pelecehan, ancaman, fitnah, pencantuman data pribadi,
          dan tautan mencurigakan.
        </Point>
      </ul>
    ),
    body: (
      <p className="text-xs leading-relaxed text-muted">
        Status pesan (tayang, menunggu moderasi, atau ditolak) dapat dilihat pada halaman Riwayat.
      </p>
    ),
  },
  {
    title: "Identitas dan data",
    art: (
      <ul className="space-y-3">
        <Point icon="user">
          Tanpa akun. Jika kolom <b>Dari</b> dikosongkan, pesan tampil sebagai Anonim; jika diisi,
          nama tersebut tampil secara publik.
        </Point>
        <Point icon="clock">
          Riwayat pesan disimpan hanya di perangkat ini, tidak di server. Menghapus data peramban
          akan menghapus riwayat tersebut.
        </Point>
      </ul>
    ),
    body: null,
  },
  {
    title: "Fitur lainnya",
    art: (
      <ul className="space-y-3">
        <Point icon="message">Komentar dan balasan pada pesan yang telah tayang.</Point>
        <Point icon="bell">Notifikasi (ikon lonceng) untuk komentar dan keputusan moderasi.</Point>
        <Point icon="clock">Riwayat (ikon jam) untuk pesan yang pernah dikirim dari perangkat ini.</Point>
        <Point icon="image">Card Studio untuk menyusun dan mengunduh pesan sebagai gambar.</Point>
        <Point icon="download">
          Pemasangan ke layar utama agar CONFESS dapat dibuka seperti aplikasi.
        </Point>
      </ul>
    ),
    body: null,
  },
];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tutorial pertama kali: muncul sekali per perangkat, bisa dilewati kapan saja,
 * dan bisa dibuka lagi lewat tombol "Lihat tutorial".
 */
export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLElement | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const last = SLIDES.length - 1;

  const close = useCallback(() => {
    markOnboardingSeen();
    setOpen(false);
  }, []);

  // Buka otomatis pada kunjungan pertama; atau saat diminta lewat tombol.
  useEffect(() => {
    const onOpen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_ONBOARDING_EVENT, onOpen);
    let timer: number | undefined;
    if (!hasSeenOnboarding()) timer = window.setTimeout(() => setOpen(true), 700);
    return () => {
      window.removeEventListener(OPEN_ONBOARDING_EVENT, onOpen);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Kunci scroll latar, kembalikan fokus, dan tangani keyboard saat terbuka.
  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => primaryRef.current?.focus(), 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight") {
        setStep((s) => Math.min(last, s + 1));
      } else if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(0, s - 1));
      } else if (e.key === "Tab" && dialogRef.current) {
        const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const first = items[0];
        const end = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          end.focus();
        } else if (!e.shiftKey && document.activeElement === end) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      lastFocus.current?.focus?.();
    };
  }, [open, close, last]);

  if (!open) return null;
  const slide = SLIDES[step];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onb-title"
        className="flex max-h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-hairline bg-surface text-ink shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <span className="text-xs font-semibold tabular-nums text-muted">
            {step + 1} / {SLIDES.length}
          </span>
          <button
            type="button"
            onClick={close}
            className="focus-ring inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-ink/5 hover:text-ink"
          >
            Lewati
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4 pt-2">
          <div key={step} className="onb-slide text-center">
            <h2 id="onb-title" className="mb-4 text-xl font-extrabold tracking-tight">
              {slide.title}
            </h2>
            <div className="mb-4">{slide.art}</div>
            {slide.body}
          </div>
        </div>

        <div className="border-t border-hairline px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mb-3 flex justify-center gap-1.5" role="tablist" aria-label="Langkah tutorial">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-label={`Langkah ${i + 1}`}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : "w-2 bg-ink/20 hover:bg-ink/40"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>
                Kembali
              </button>
            ) : (
              <button type="button" className="btn-ghost" onClick={close}>
                Lewati
              </button>
            )}
            {step < last ? (
              <button
                type="button"
                ref={(el) => {
                  primaryRef.current = el;
                }}
                className="btn-primary flex-1"
                onClick={() => setStep(step + 1)}
              >
                Lanjut
              </button>
            ) : (
              <Link
                href="/confess"
                ref={(el) => {
                  primaryRef.current = el;
                }}
                onClick={close}
                className="btn-primary flex-1 text-center"
              >
                Mulai menulis
              </Link>
            )}
          </div>
          {step === last && (
            <button
              type="button"
              onClick={close}
              className="focus-ring mx-auto mt-2 block rounded-lg px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink"
            >
              Tutup panduan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
