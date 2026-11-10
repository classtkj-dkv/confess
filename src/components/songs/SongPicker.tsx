"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { api, ApiClientError } from "@/lib/api";
import { useSettings } from "@/lib/firebase/useSettings";
import type { Song } from "@/types";
import { SongCover, SongModal } from "./SongCard";

const LYRIC_MAX = 200;

interface AiRow {
  t: number;
  text: string;
  music?: boolean;
}

export function SongPicker({
  song,
  lyric,
  onSong,
  onLyric,
}: {
  song: Song | null;
  lyric: string;
  onSong: (s: Song | null) => void;
  onLyric: (v: string) => void;
}) {
  const { settings } = useSettings();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [lyricState, setLyricState] = useState<"idle" | "loading" | "ready" | "none">("idle");
  // Tahap AI: merapikan lirik + menatap posisi musik/lirik sebelum dilanjutkan.
  const [aiState, setAiState] = useState<"idle" | "loading" | "ready" | "skip">("idle");
  const [aiOffset, setAiOffset] = useState<number | null>(null);
  const [aiSynced, setAiSynced] = useState<AiRow[]>([]);
  const [testing, setTesting] = useState(false);
  const [ctx, setCtx] = useState<AudioContext | null>(null);
  const autoFilled = useRef<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setError("");
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const data = await api(`/api/songs/search?q=${encodeURIComponent(term)}`, {
          method: "GET",
        });
        if (!cancelled) setResults((data.tracks as Song[]) ?? []);
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setError(err instanceof ApiClientError ? err.message : "Gagal mencari lagu.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  useEffect(() => {
    if (!song) {
      setLines([]);
      setLyricState("idle");
      setAiState("idle");
      setAiOffset(null);
      setAiSynced([]);
      return;
    }
    let cancelled = false;
    setLyricState("loading");
    api(`/api/songs/lyrics?id=${encodeURIComponent(song.id)}`, { method: "GET", auth: false })
      .then((d) => {
        if (cancelled) return;
        const found = Array.isArray(d.lines) ? (d.lines as string[]) : [];
        setLines(found);
        setLyricState(found.length > 0 ? "ready" : "none");
        const suggestion = String(d.suggestion ?? "");
        if (suggestion && autoFilled.current !== song.id && !lyric.trim()) {
          autoFilled.current = song.id;
          onLyric(suggestion.slice(0, LYRIC_MAX));
        }
      })
      .catch(() => {
        if (!cancelled) setLyricState("none");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id]);

  // Panggilan kedua: AI (OpenRouter, key 2–3 berotasi) merapikan & menyusun lirik
  // serta menatap di detik berapa preview musik mulai — lihat "Tes putar".
  useEffect(() => {
    if (!song) return;
    let cancelled = false;
    setAiState("loading");
    api("/api/songs/lyrics-ai", {
      method: "POST",
      body: { id: song.id },
    })
      .then((d) => {
        if (cancelled) return;
        if (d.skipped || typeof d.offset !== "number") {
          setAiState("skip");
          return;
        }
        const rows = Array.isArray(d.synced) ? (d.synced as AiRow[]) : [];
        setAiOffset(d.offset);
        setAiSynced(rows);
        setAiState(rows.length >= 2 ? "ready" : "skip");
        const quoted = rows.filter((r) => !r.music && r.text).map((r) => r.text);
        if (quoted.length >= 2) setLines(quoted.slice(0, 60));
      })
      .catch(() => {
        if (!cancelled) setAiState("skip");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id]);

  function toggleLine(line: string) {
    const cur = lyric.split("\n").map((l) => l.trim()).filter(Boolean);
    const next = cur.includes(line) ? cur.filter((l) => l !== line) : [...cur, line];
    onLyric(next.join("\n").slice(0, LYRIC_MAX));
  }

  // "Tes putar": buka pemutar dengan lirik & posisi hasil AI langsung dari form.
  function openTestPlayer() {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      setCtx(AC ? new AC() : null);
    } catch {
      setCtx(null);
    }
    setTesting(true);
  }

  function closeTestPlayer() {
    setTesting(false);
    setCtx((c) => {
      void c?.close().catch(() => {});
      return null;
    });
  }

  if (!settings.allowSongs) return null;

  if (song) {
    return (
      <div className="space-y-2">
        <span className="label">Lagu</span>
        <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface p-2.5">
          <SongCover song={song} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{song.title}</p>
            <p className="truncate text-xs text-muted">{song.artist}</p>
          </div>
          <button
            type="button"
            onClick={openTestPlayer}
            aria-label="Tes putar lagu dan lirik"
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-secondary px-3 py-2 text-xs font-bold text-white shadow-glow hover:brightness-110"
          >
            <Icon name="play" className="h-3.5 w-3.5" />
            Tes putar
          </button>
          <button
            type="button"
            onClick={() => {
              onSong(null);
              onLyric("");
            }}
            className="focus-ring rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:text-ink"
          >
            Ganti
          </button>
        </div>
        <textarea
          value={lyric}
          onChange={(e) => onLyric(e.target.value)}
          maxLength={LYRIC_MAX}
          rows={2}
          placeholder="Kutipan lirik (opsional)"
          aria-label="Kutipan lirik (opsional)"
          className="input resize-y"
        />
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
          <span>
            {lyricState === "loading"
              ? "Mencari lirik otomatis…"
              : aiState === "loading"
                ? "AI merapikan lirik dan menyelaraskan musik…"
                : lyricState === "ready"
                  ? aiState === "ready"
                    ? "Lirik dirapikan & diselaraskan AI (tes di tombol putar) — ketuk baris untuk memilih, lalu lanjut isi form."
                    : "Lirik ditemukan — ketuk baris untuk memilih (maks. 200 huruf)."
                  : "Lirik tidak ditemukan. Kamu bisa mengetik kutipan sendiri."}
          </span>
          <span className="tabular-nums">{lyric.length}/{LYRIC_MAX}</span>
        </div>
        {lyricState === "ready" && (
          <ul className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-hairline bg-surface/60 p-1.5">
            {lines.map((l) => {
              const on = lyric.split("\n").map((x) => x.trim()).includes(l);
              return (
                <li key={l}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleLine(l)}
                    className={`focus-ring w-full rounded-lg px-2.5 py-1.5 text-left text-xs leading-snug transition-colors ${
                      on ? "bg-primary/15 font-semibold text-primary" : "text-ink/80 hover:bg-ink/5"
                    }`}
                  >
                    {l}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {testing && (
          <SongModal
            song={song}
            lyric={lyric}
            ctx={ctx}
            onClose={closeTestPlayer}
            aiOffset={aiState === "ready" ? aiOffset : null}
            aiSynced={aiState === "ready" ? aiSynced : undefined}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="song-search" className="label">
        Lagu <span className="font-normal text-muted">(opsional)</span>
      </label>
      <input
        id="song-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari judul atau artis"
        autoComplete="off"
        className="input"
      />
      {busy && <p className="mt-2 text-xs text-muted">Mencari…</p>}
      {error && <p className="mt-2 text-xs text-warning">{error}</p>}
      {!busy && !error && q.trim().length >= 2 && results.length === 0 && (
        <p className="mt-2 text-xs text-muted">Tidak ada hasil.</p>
      )}
      {results.length > 0 && (
        <ul className="mt-2 max-h-64 divide-y divide-hairline overflow-y-auto rounded-xl border border-hairline bg-surface">
          {results.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  onSong(t);
                  setQ("");
                  setResults([]);
                }}
                className="focus-ring flex w-full items-center gap-3 p-2.5 text-left hover:bg-ink/5"
              >
                <SongCover song={t} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{t.title}</span>
                  <span className="block truncate text-xs text-muted">{t.artist}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
