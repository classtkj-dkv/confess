"use client";

import { useEffect, useState } from "react";
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
                className="focus-ring flex w-full items-center gap-3 p-2.5 text-left hover:bg-white/5"
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
