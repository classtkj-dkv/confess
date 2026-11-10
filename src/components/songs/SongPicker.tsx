"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useSettings } from "@/lib/firebase/useSettings";
import type { Song } from "@/types";
import { SongCover } from "./SongCard";

const LYRIC_MAX = 200;

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

  // Lirik otomatis: cari baris lirik lagu yang dipilih, lalu isi saran kutipan.
  useEffect(() => {
    if (!song) {
      setLines([]);
      setLyricState("idle");
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

  function toggleLine(line: string) {
    const cur = lyric.split("\n").map((l) => l.trim()).filter(Boolean);
    const next = cur.includes(line) ? cur.filter((l) => l !== line) : [...cur, line];
    onLyric(next.join("\n").slice(0, LYRIC_MAX));
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
            {lyricState === "loading" && "Mencari lirik otomatis…"}
            {lyricState === "ready" && "Lirik ditemukan — ketuk baris untuk memilih (maks. 200 huruf)."}
            {lyricState === "none" && "Lirik tidak ditemukan. Kamu bisa mengetik kutipan sendiri."}
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
