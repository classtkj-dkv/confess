"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ConfessionCard } from "@/components/feed/ConfessionCard";
import { Icon } from "@/components/ui/Icon";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { CardSkeleton } from "@/components/ui/Skeletons";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/lib/auth/ToastProvider";
import { subscribeComments, subscribeConfession } from "@/lib/firebase/feed";
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
  const [commentName, setCommentName] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);

  // Nama komentator diingat di browser ini.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("confess:fromName");
      if (saved) setCommentName(saved);
    } catch {
      /* storage tidak tersedia */
    }
  }, []);

  // Komentar tingkat atas (terbaru dulu) + balasannya (terlama dulu).
  const threads = useMemo(() => {
    const ids = new Set(comments.map((c) => c.id));
    const replies = new Map<string, ConfessionComment[]>();
    const roots: ConfessionComment[] = [];
    for (const c of comments) {
      if (c.parentId && ids.has(c.parentId)) {
        const list = replies.get(c.parentId) ?? [];
        list.push(c);
        replies.set(c.parentId, list);
      } else {
        roots.push(c);
      }
    }
    replies.forEach((list) => list.sort((a, b) => a.createdAt - b.createdAt));
    return { roots, replies };
  }, [comments]);

  // Realtime: confession + komentar; dua listener, keduanya di-unsubscribe saat unmount.
  useEffect(() => {
    if (!isFirebaseConfigured || !id || id.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      setStatus("empty");
      return;
    }
    setStatus("loading");
    const unsubConf = subscribeConfession(
      id,
      (conf) => {
        setConfession(conf);
        setStatus(conf ? "ready" : "empty");
      },
      () => setStatus("empty")
    );
    const unsubComments = subscribeComments(id, setComments, () => setComments([]));
    return () => {
      unsubConf();
      unsubComments();
    };
  }, [id]);

  async function submitComment() {
    if (!configured) {
      toast("error", "Sesi tidak tersedia. Coba lagi.");
      return;
    }
    const message = commentText.trim();
    if (!/[\p{L}\p{N}]/u.test(message)) {
      toast("warning", "Tulis komentar dulu ya.");
      return;
    }
    setCommentBusy(true);
    try {
      await api("/api/comments", {
        body: {
          confessionId: id,
          message,
          fromName: commentName.trim(),
          parentId: replyTo?.id ?? "",
        },
      });
      try {
        if (commentName.trim()) localStorage.setItem("confess:fromName", commentName.trim());
        else localStorage.removeItem("confess:fromName");
      } catch {
        /* abaikan */
      }
      setCommentText("");
      setReplyTo(null);
      toast("info", "Komentar terkirim.");
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
        icon="search"
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
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded-lg bg-surface px-3 py-1.5 text-xs text-muted">
              <span>
                Membalas <span className="font-semibold text-ink">{replyTo.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="focus-ring rounded px-1 font-semibold hover:text-ink"
                aria-label="Batal membalas"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <label htmlFor="comment-box" className="sr-only">
            Tulis komentar
          </label>
          <textarea
            id="comment-box"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
            maxLength={MAX_COMMENT_LENGTH}
            placeholder={replyTo ? `Balas ${replyTo.name}…` : "Tulis komentar…"}
            className="input resize-y"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <input
              value={commentName}
              onChange={(e) => setCommentName(e.target.value)}
              maxLength={30}
              placeholder="Nama (opsional)"
              aria-label="Nama (opsional)"
              autoComplete="off"
              className="input max-w-44 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={commentBusy || !/[\p{L}\p{N}]/u.test(commentText)}
              className="btn-primary"
            >
              {commentBusy ? "Mengirim…" : "Kirim komentar"}
            </button>
          </div>
        </form>

        {threads.roots.length > 0 && (
          <ul className="mt-6 space-y-4">
            {threads.roots.map((c) => (
              <li key={c.id}>
                <CommentBox c={c} onReply={setReplyTo} />
                {(threads.replies.get(c.id) ?? []).length > 0 && (
                  <ul className="mt-2 space-y-2 border-l-2 border-hairline pl-3 sm:ml-4">
                    {(threads.replies.get(c.id) ?? []).map((r) => (
                      <li key={r.id}>
                        <CommentBox c={r} onReply={() => setReplyTo({ id: c.id, name: r.fromName || "Anonim" })} nested />
                      </li>
                    ))}
                  </ul>
                )}
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

function CommentBox({
  c,
  onReply,
  nested = false,
}: {
  c: ConfessionComment;
  onReply: (target: { id: string; name: string }) => void;
  nested?: boolean;
}) {
  const name = c.fromName || "Anonim";
  return (
    <div className="rounded-xl border border-hairline bg-surface p-3">
      <div className="flex items-center gap-2">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary/20 text-[11px] font-bold text-secondary"
          aria-hidden
        >
          {name.charAt(0).toUpperCase()}
        </span>
        <p className="truncate text-xs font-semibold text-ink">{name}</p>
        <time className="text-[11px] text-muted" dateTime={new Date(c.createdAt).toISOString()}>
          {formatRelativeTime(c.createdAt)}
        </time>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-ink/90">
        {nested && c.replyToName && (
          <span className="mr-1 font-semibold text-primary">@{c.replyToName}</span>
        )}
        {c.message}
      </p>
      <button
        type="button"
        onClick={() => onReply({ id: c.id, name })}
        className="focus-ring mt-2 rounded text-[11px] font-semibold text-muted hover:text-ink"
      >
        Balas
      </button>
    </div>
  );
}
