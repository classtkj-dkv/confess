"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, api } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { useToast } from "@/lib/auth/ToastProvider";
import { MAX_CONFESSION_LENGTH } from "@/lib/validations";
import { getCategory } from "@/lib/categories";
import { charCount } from "@/utils/format";
import { Icon } from "@/components/ui/Icon";

type Step = "compose" | "preview" | "sent";

export function ConfessionForm({ defaultCategory }: { defaultCategory?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("compose");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState(defaultCategory ?? "");
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);

  const remaining = MAX_CONFESSION_LENGTH - charCount(message);
  const invalid = useMemo(
    () => message.trim().length < 10,
    [message]
  );
  const categoryMeta = category ? getCategory(category) : null;

  async function submit() {
    if (!category) {
      toast("warning", "Pilih kategori dulu ya.");
      return;
    }
    if (!agree) {
      toast("warning", "Centang pernyataan kejujuran dulu ya.");
      return;
    }
    if (invalid) return;

    setBusy(true);
    try {
      await api("/api/confessions", {
        body: { message, category },
      });
      setStep("sent");
      setMessage("");
      setCategory("");
      setAgree(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        toast(err.status === 429 ? "warning" : "error", err.message);
      } else {
        toast("error", "Gagal mengirim confession. Coba lagi.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (step === "sent") {
    return (
      <div className="card px-6 py-12 text-center" role="status">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success">
          <Icon name="clock" className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-ink">
          Confession terkirim, sedang menunggu moderasi
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Confessionmu akan tampil di feed setelah disetujui tim moderasi.
          Biasanya kurang dari 24 jam. Terima kasih sudah berbagi!
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setStep("compose")}
            className="btn-primary"
          >
            Tulis confession lagi
          </button>
          <button type="button" onClick={() => router.push("/feed")} className="btn-ghost">
            Buka feed
          </button>
        </div>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div className="space-y-4">
        <article className="card p-5">
          <header className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary" aria-hidden>
              A
            </span>
            <div>
              <p className="text-xs font-semibold text-ink">Anonim</p>
              <p className="text-[11px] text-muted">Preview — publik setelah moderasi</p>
            </div>
            {categoryMeta && (
              <span className="badge ml-auto">
                <Icon name={categoryMeta.icon} className="inline h-3.5 w-3.5 align-[-2px]" />
                {categoryMeta.label}
              </span>
            )}
          </header>
          <p className="mt-4 whitespace-pre-line text-sm text-ink/90">{message}</p>
        </article>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost flex-1"
            onClick={() => setStep("compose")}
            disabled={busy}
          >
            ← Ubah
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Mengirim…" : "Kirim confession"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="card space-y-5 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) setStep("preview");
      }}
    >
      <div>
        <label htmlFor="confession" className="label">
          Isi confessionmu
        </label>
        <textarea
          id="confession"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={8}
          maxLength={MAX_CONFESSION_LENGTH}
          placeholder="Ceritakan apa yang ada di pikiranmu…"
          className="input resize-y min-h-40"
          aria-describedby="char-counter"
        />
        <p
          id="char-counter"
          aria-live="polite"
          className={`mt-1.5 text-right text-xs ${remaining < 50 ? "text-warning" : "text-muted"}`}
        >
          {remaining} karakter tersisa
        </p>
        {message.trim().length < 10 && (
          <p className={"mt-1 text-xs text-muted"}>
            Minimal 10 karakter supaya ceritamu cukup jelas.
          </p>
        )}
      </div>

      <div>
        <span id="cat-label" className="label">
          Kategori
        </span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="cat-label">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`focus-ring inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                category === c.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-hairline bg-surface text-muted hover:text-ink"
              }`}
            >
              <Icon name={c.icon} className="inline h-3.5 w-3.5 align-[-2px]" />
              {c.label}
            </button>
          ))}
        </div>
        {categoryMeta && (
          <p className="mt-2 text-xs text-muted">{categoryMeta.description}</p>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-xl bg-surface p-3 text-xs text-muted">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-hairline bg-background accent-primary"
        />
        <span>
          Confession ini jujur, bukan fitnah, tidak menyebarkan informasi pribadi
          orang lain, dan tidak memuat konten tidak pantas.
        </span>
      </label>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={invalid}
          className="btn-primary flex-1"
        >
          Lanjut ke preview →
        </button>
      </div>
    </form>
  );
}
