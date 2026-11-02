"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ConfessionCard } from "@/components/feed/ConfessionCard";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { CardSkeleton } from "@/components/ui/Skeletons";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/lib/auth/ToastProvider";
import { loadComments, loadConfession } from "@/lib/firebase/feed";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { MAX_COMMENT_LENGTH } from "@/lib/validations";
import { formatRelativeTime } from "@/utils/format";
import type { ConfessionComment, Confession } from "@/types";

export function ConfessionDetailClient() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const { toast } = useToast();
  const { configured, isAdmin } = useAuth();

  const [confession, setConfession] = useState<Confession | null>(null);
  const [comments, setComments] = useState<ConfessionComment[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);

  const loadAll = useCallback(async () => {
    if (!isFirebaseConfigured || !id || id.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      setStatus("empty");
      return;
    }
    try {
      const [conf, cm] = await Promise.all([
        loadConfession(id),
        loadComments(id),
      ]);
      setConfession(conf);
      setComments(cm);
      setStatus(conf ? "ready" : "empty");
    } catch {
      setStatus("empty");
    }
  }, [id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function submitComment() {
    if (!configured) {
      toast("error", "Sesi tidak tersedia. Coba lagi.");
      return;
    }
    const message = commentText.trim();
    if (message.length < 3) {
      toast("warning", "Komentar minimal 3 karakter.");
      return;
    }
    setCommentBusy(true);
    try {
      await api("/api/comments", { body: { confessionId: id, message } });
      setCommentText("");
      toast("info", "Komentar terkirim, menunggu moderasi.");
    } catch (err) {
      toast(
        "error",
        err instanceof ApiClientError ? err.message : "Gagal mengirim komentar."
      );
    } finally {
      setCommentBusy(false);
    }
  }

  if (status === "loading") {
    return <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>;
  }

  if (status === "empty" || !confession) {
    return (
      <EmptyState
        icon="🔍"
        title="Confession tidak ditemukan"
        description="Mungkin confession ini sudah dihapus atau belum disetujui moderasi."
      />
    );
  }

  return (
    <div className="space-y-5">
      <ConfessionCard confession={confession} />

      <section aria-labelledby="comments" className="card p-5">
        <h2 id="comments" className="text-base font-bold text-ink">
          Komentar ({comments.length})
          {comments.length === 0 && (
            <span className="ml-2 text-xs font-normal text-muted">
              belum ada yang membahas
            </span>
          )}
        </h2>

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submitComment();
          }}
        >
          <label htmlFor="comment-box" className="sr-only">
            Tulis komentar
          </label>
          <textarea
            id="comment-box"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
            maxLength={MAX_COMMENT_LENGTH}
            placeholder="Tulis komentar yang sopan dan membangun…"
            className="input resize-y"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted">
              {MAX_COMMENT_LENGTH - Array.from(commentText).length} karakter • maks 10 komentar/jam
            </span>
            <button
              type="submit"
              disabled={commentBusy || commentText.trim().length < 3}
              className="btn-primary"
            >
              {commentBusy ? "Mengirim…" : "Kirim komentar"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Komentar tayang langsung; admin dapat menyembunyikan komentar yang melanggar aturan.
          </p>
        </form>

        {comments.length > 0 && (
          <ul className="mt-6 space-y-4">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-hairline bg-surface p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary/20 text-[11px] font-bold text-secondary" aria-hidden>
                    A
                  </span>
                  <p className="text-xs font-semibold text-ink">Anonim</p>
                  <time className="text-[11px] text-muted" dateTime={new Date(c.createdAt).toISOString()}>
                    {formatRelativeTime(c.createdAt)}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-ink/90">{c.message}</p>
              </li>
            ))}
          </ul>
        )}

        {isAdmin && (
          <p className="mt-4 rounded-xl bg-warning/10 p-3 text-xs text-ink">
            Kamu login sebagai admin — komentar termoderasi bisa diatur dari{" "}
            <a href="/admin/comments" className="font-semibold underline">
              dashboard admin
            </a>
            .
          </p>
        )}
      </section>
    </div>
  );
}
