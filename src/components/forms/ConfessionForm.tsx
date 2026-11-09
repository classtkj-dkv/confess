"use client";

import { useEffect, useMemo, useState } from "react";
import { SongCard } from "@/components/songs/SongCard";
import { SongPicker } from "@/components/songs/SongPicker";
import { CardStudioButton } from "@/components/studio/CardStudio";
import type { ConfessionKind, Song } from "@/types";
import { useSettings } from "@/lib/firebase/useSettings";
import { useRouter } from "next/navigation";
import { ApiClientError, api } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { useToast } from "@/lib/auth/ToastProvider";
import { MAX_CONFESSION_LENGTH } from "@/lib/validations";
import { getCategory } from "@/lib/categories";
import { Icon } from "@/components/ui/Icon";

type Step = "compose" | "preview" | "sent";

const NAME_KEY = "confess:fromName";
const NAME_MAX = 30;

export function ConfessionForm({ defaultCategory }: { defaultCategory?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("compose");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState(defaultCategory ?? "");
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");
  const [song, setSong] = useState<Song | null>(null);
  const [lyric, setLyric] = useState("");
  const [kind, setKind] = useState<ConfessionKind>("menfess");
  const [revision, setRevision] = useState("");
  const [sentStatus, setSentStatus] = useState<"PENDING" | "PUBLISHED">("PENDING");
  const { settings } = useSettings();

  // Nama pengirim diingat di browser ini supaya tidak perlu diketik ulang.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) setFromName(saved);
    } catch {
      /* storage tidak tersedia */
    }
  }, []);

  const isSongfess = kind === "songfess" && settings.allowSongs;
  const invalid = useMemo(
    () => !/[\p{L}\p{N}]/u.test(message) || (isSongfess && !song),
    [message, isSongfess, song]
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
      const res = await api("/api/confessions", {
        body: {
          message,
          category,
          kind: isSongfess ? "songfess" : "menfess",
          fromName: fromName.trim(),
          toName: toName.trim(),
          songId: isSongfess ? (song?.id ?? "") : "",
          songLyric: isSongfess ? lyric.trim() : "",
        },
      });
      setSentStatus(res.status === "PUBLISHED" ? "PUBLISHED" : "PENDING");
      setRevision("");
      try {
        if (fromName.trim()) localStorage.setItem(NAME_KEY, fromName.trim());
        else localStorage.removeItem(NAME_KEY);
      } catch {
        /* abaikan */
      }
      setStep("sent");
      setMessage("");
      setToName("");
      setSong(null);
      setLyric("");
      setCategory("");
      setAgree(false);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "needs-revision") {
        // AI meminta revisi: kembali ke editor, isi tetap utuh.
        setRevision(err.message);
        setStep("compose");
      } else if (err instanceof ApiClientError) {
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
          {sentStatus === "PUBLISHED" ? "Sudah tayang di feed" : "Terkirim, menunggu moderasi"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          {sentStatus === "PUBLISHED"
            ? "Pesanmu lolos pengecekan dan sekarang bisa dilihat semua orang."
            : "Akan tampil di feed setelah disetujui moderator."}
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
              {(fromName.trim() || "A").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-ink">{fromName.trim() || "Anonim"}</p>
              <p className="text-[11px] text-muted">Preview</p>
            </div>
            {categoryMeta && (
              <span className="badge ml-auto">
                <Icon name={categoryMeta.icon} className="inline h-3.5 w-3.5 align-[-2px]" />
                {categoryMeta.label}
              </span>
            )}
          </header>
          {toName.trim() && (
            <p className="mt-4 text-xs text-muted">
              Untuk <span className="font-semibold text-ink">{toName.trim()}</span>
            </p>
          )}
          <p className="mt-3 whitespace-pre-line text-sm text-ink/90">{message}</p>
          {isSongfess && song && (
            <div className="mt-3">
              <SongCard song={song} lyric={lyric.trim()} />
            </div>
          )}
        </article>
        <CardStudioButton
          className="btn-ghost w-full"
          data={{
            fromName,
            toName,
            message,
            song: isSongfess ? song : null,
            songLyric: isSongfess ? lyric : "",
          }}
        >
          Atur kartu & unduh
        </CardStudioButton>
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
      {settings.allowSongs && (
        <div
          role="tablist"
          aria-label="Jenis kiriman"
          className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1"
        >
          {(["menfess", "songfess"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`focus-ring rounded-lg px-3 py-2 text-sm font-semibold capitalize transition-colors ${
                kind === k ? "bg-primary text-white" : "text-muted hover:text-ink"
              }`}
            >
              {k === "menfess" ? "Menfess" : "Songfess"}
            </button>
          ))}
        </div>
      )}

      {revision && (
        <div
          role="alert"
          className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-ink"
        >
          <p className="font-semibold">Perlu direvisi dulu ya</p>
          <p className="mt-1 text-muted">{revision}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="from-name" className="label">
            Dari <span className="font-normal text-muted">(opsional)</span>
          </label>
          <input
            id="from-name"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            maxLength={NAME_MAX}
            placeholder="Anonim"
            autoComplete="off"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="to-name" className="label">
            Untuk <span className="font-normal text-muted">(opsional)</span>
          </label>
          <input
            id="to-name"
            value={toName}
            onChange={(e) => setToName(e.target.value)}
            maxLength={NAME_MAX}
            placeholder="Siapa saja"
            autoComplete="off"
            className="input"
          />
        </div>
      </div>

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
          placeholder="Tulis confessionmu di sini…"
          className="input resize-y min-h-40"
        />
      </div>

      {isSongfess && (
        <SongPicker song={song} lyric={lyric} onSong={setSong} onLyric={setLyric} />
      )}

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
        <span>Saya menulis dengan jujur dan tanpa menyebar data pribadi orang lain.</span>
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
