"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ApiClientError, api } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";

const PENDING_KEY = "studio:pendingTemplate";

/** Halaman link template: penerima memasukkan 4 kode dari pengirim. */
export function SharedTemplateClient({ id, by = "" }: { id: string; by?: string }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [owner, setOwner] = useState(by);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1);
    setDigits((p) => p.map((x, j) => (j === i ? d : x)));
    if (d && i < 3) refs.current[i + 1]?.focus();
  }

  function onPaste(e: React.ClipboardEvent) {
    const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (t.length === 4) {
      e.preventDefault();
      setDigits(t.split(""));
      refs.current[3]?.focus();
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length !== 4) {
      setError("Masukkan 4 angka kode dari pengirim.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api("/api/templates/open", { body: { id: id.toLowerCase(), code } });
      const payload = {
        app: "confess-template",
        v: 1,
        name: String(res.name ?? "Template"),
        by: typeof res.by === "string" ? res.by : "",
        design: res.design,
        bg: typeof res.bg === "string" ? res.bg : null,
      };
      try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
      } catch {
        // Penyimpanan penuh: coba tanpa gambar latar.
        localStorage.setItem(PENDING_KEY, JSON.stringify({ ...payload, bg: null }));
      }
      setName(payload.name);
      if (payload.by) setOwner(payload.by);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Template tidak bisa dibuka.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-6">
      <div className="card relative overflow-hidden p-7 text-center sm:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl"
        />
        <div className="relative">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-glow">
            <Icon name={name ? "check" : "lock"} className="h-7 w-7" />
          </span>

          {name ? (
            <>
              <h1 className="mt-5 text-xl font-extrabold tracking-tight text-ink">Template siap dipakai</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                “{name}”{owner ? ` by ${owner}` : ""} tersimpan di perangkat ini. Buka confession mana saja, ketuk tombol Studio kartu, dan
                template otomatis dibuat ulang dengan isi confession itu.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Link href="/feed" className="btn-primary">Pilih confession</Link>
                <Link href="/" className="btn-ghost">Beranda</Link>
              </div>
            </>
          ) : (
            <form onSubmit={submit}>
              <h1 className="mt-5 text-xl font-extrabold tracking-tight text-ink">Template kartu dibagikan</h1>
              {owner && (
                <p className="mt-2 text-sm font-semibold text-primary">by {owner}</p>
              )}
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Masukkan 4 angka kode dari pengirim untuk membuka template ini.
              </p>
              <div className="mt-6 flex justify-center gap-3" onPaste={onPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      refs.current[i] = el;
                    }}
                    value={d}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    aria-label={`Digit kode ${i + 1}`}
                    className="input !h-14 !w-12 !rounded-2xl !px-0 text-center text-2xl font-extrabold"
                  />
                ))}
              </div>
              {error && (
                <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy || digits.join("").length !== 4} className="btn-primary mt-6 w-full">
                {busy ? "Membuka…" : "Buka template"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
