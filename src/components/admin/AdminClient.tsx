"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/lib/auth/ToastProvider";
import { CATEGORIES, getCategory, isCategoryId } from "@/lib/categories";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { StatSkeleton } from "@/components/ui/Skeletons";
import { AuthAccountPanel } from "./AuthAccountPanel";
import { formatDateTime, formatNumber, shortUid } from "@/utils/format";

type Tab =
  | "overview"
  | "moderation"
  | "confessions"
  | "comments"
  | "reports"
  | "users"
  | "categories"
  | "announcements"
  | "settings";

const TABS: readonly { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "moderation", label: "Moderation", icon: "🚦" },
  { id: "confessions", label: "Confessions", icon: "📝" },
  { id: "comments", label: "Comments", icon: "💬" },
  { id: "reports", label: "Reports", icon: "🚨" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "categories", label: "Categories", icon: "🗂️" },
  { id: "announcements", label: "Announcements", icon: "📣" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

interface StatsShape {
  totalConfessions: number;
  pendingConfessions: number;
  publishedConfessions: number;
  rejectedConfessions: number;
  totalComments: number;
  openReports: number;
  totalUsers: number;
  last7DaysConfessions: number;
}

interface AdminConfessionRow {
  id: string;
  message: string;
  category: string;
  status: string;
  createdAt: number;
  likesCount: number;
  commentsCount: number;
}

interface AdminCommentRow {
  id: string;
  confessionId: string;
  message: string;
  status: string;
  createdAt: number;
}

interface AdminReportRow {
  id: string;
  confessionId: string;
  reason: string;
  detail: string;
  status: string;
  createdAt: number;
}

interface AdminUserRow {
  uid: string;
  role: string;
  isBlocked: boolean;
  createdAt: number;
}

interface AdminStatsShape {
  totalConfessions: number;
  pendingConfessions: number;
  publishedConfessions: number;
  rejectedConfessions: number;
  totalComments: number;
  openReports: number;
  totalUsers: number;
  last7DaysConfessions: number;
}

export function AdminClient() {
  const { isAdmin, isOwner, loading, configured, uid } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");

  if (loading) {
    return <div className="space-y-4">{StatSkeletonSkeletonList()}</div>;
  }

  if (!configured) {
    return (
      <ErrorState
        title="Firebase belum terkonfigurasi"
        description="Isi NEXT_PUBLIC_FIREBASE_* dan FIREBASE_ADMIN_* environment variables terlebih dahulu."
      />
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon="🔐"
          title="Akses admin diperlukan"
          description="Dashboard hanya untuk akun dengan role admin/owner yang diverifikasi server (custom claim). Pendaftaran baru selalu ber-role user biasa — role naik hanya oleh keputusan owner."
        />
        {/* Daftar manual: selalu ber-role user biasa */}
        <AuthAccountPanel />
        {uid && (
          <p className="rounded-xl bg-surface p-4 font-mono text-xs text-muted">
            UID sesimu: {uid}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="badge">Kelola CONFESS</p>
        <h1 className="mt-2 text-xl font-bold text-ink">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Sesi: <strong className="font-mono">{shortUid(uid)}</strong> · role:{" "}
          <RoleBadge role={isOwner ? "owner" : "admin"} />
        </p>
      </header>

      <div role="toolbar" aria-label="Menu admin" className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`focus-ring shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-hairline bg-surface text-muted hover:text-ink"
            }`}
          >
            <span aria-hidden>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <AdminSection tab={tab} toast={toast} isOwner={isOwner} />
    </div>
  );
}

function StatSkeletonSkeletonList(): React.ReactNode {
  return (
    <>
      <StatSkeleton />
      <StatSkeleton />
      <StatSkeleton />
    </>
  );
}

function AdminSection({
  tab,
  toast,
  isOwner,
}: {
  tab: Tab;
  toast: ReturnType<typeof useToast>["toast"];
  isOwner: boolean;
}) {
  const [stats, setStats] = useState<StatsShape | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const refreshStats = useCallback(async () => {
    try {
      const data = (await api("/api/admin/stats", {
        method: "GET",
      })) as unknown as StatsShape;
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const onAction = useCallback(
    async (type: string, id: string) => {
      try {
        const res = (await api("/api/admin/actions", {
          body: { type, id },
        })) as { message?: string };
        toast("success", res.message ?? "Aksi berhasil.");
        await refreshStats();
      } catch (err) {
        toast("error", err instanceof ApiClientError ? err.message : "Aksi gagal.");
      }
    },
    [refreshStats, toast]
  );

  useEffect(() => {
    if (tab === "overview") void refreshStats();
  }, [tab, refreshStats]);

  switch (tab) {
    case "overview":
      return loadingStats ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{StatSkeletonSkeletonList()}</div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Total confession" value={stats.totalConfessions} />
          <StatCard label="Pending" value={stats.pendingConfessions} accent />
          <StatCard label="Published" value={stats.publishedConfessions} />
          <StatCard label="Rejected" value={stats.rejectedConfessions} />
          <StatCard label="Total komentar" value={stats.totalComments} />
          <StatCard label="Laporan aktif" value={stats.openReports} accent />
          <StatCard label="Pengguna anonim" value={stats.totalUsers} />
          <StatCard label="Confession 7 hari" value={stats.last7DaysConfessions} />
        </div>
      ) : (
        <ErrorState description="Statistik gagal dimuat. Coba buka menu lain lalu kembali." />
      );
    case "moderation":
    case "confessions":
      return (
        <ConfessionRows
          statusFilter={tab === "moderation" ? "PENDING" : "ALL"}
          title={tab === "moderation" ? "Menunggu moderasi" : "Semua confession"}
          onAction={onAction}
        />
      );
    case "comments":
      return <CommentRows onAction={onAction} />;
    case "reports":
      return <ReportRows onAction={onAction} />;
    case "users":
      return <UserRows onAction={onAction} isOwner={isOwner} />;
    case "categories":
      return <CategoriesView />;
    case "announcements":
      return <AnnouncementPanel toast={toast} />;
    case "settings":
      return <SettingsPanel toast={toast} />;
    default:
      return null;
  }
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="card p-5" data-accent={accent ? "1" : undefined}>
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 text-2xl font-extrabold ${accent ? "text-primary" : "text-ink"}`}
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}

/* ---------------- Confession moderation ---------------- */

function ConfessionRows({
  statusFilter,
  title,
  onAction,
}: {
  statusFilter: string;
  title: string;
  onAction: (type: string, id: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<AdminConfessionRow[] | null>(null);
  const [status, setStatus] = useState(statusFilter);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRows(null);
    const data = (await api(
      `/api/admin/confessions?status=${status}&pageSize=20`,
      { method: "GET" }
    )) as { items: AdminConfessionRow[] };
    setRows(data.items ?? []);
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(type: string, id: string) {
    setBusy(id);
    await onAction(type, id);
    setBusy(null);
    void refresh();
  }

  const statuses = ["ALL", "PENDING", "PUBLISHED", "REJECTED"];

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <div className="ml-auto flex gap-1.5 overflow-x-auto">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className={`focus-ring rounded-full border px-3 py-1 text-[11px] font-semibold ${
                status === s
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-hairline bg-surface text-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon="✅" title="Tidak ada confession" />
      ) : (
        rows.map((r) => {
          const cat = isCategoryId(r.category) ? getCategory(r.category) : getCategory("random");
          return (
            <article key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge">
                  <span aria-hidden>{cat.emoji}</span> {cat.label}
                </span>
                <span
                  className={`badge ${
                    r.status === "PENDING"
                      ? "text-warning"
                      : r.status === "PUBLISHED"
                        ? "text-success"
                        : "text-danger"
                  }`}
                >
                  {r.status}
                </span>
                <span className="ml-auto text-[11px] text-muted">
                  {formatDateTime(r.createdAt)} · ♥{r.likesCount} · 💬{r.commentsCount}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-ink/90">{r.message}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {r.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act("approveConfession", r.id)}
                    className="btn-primary !py-1.5 text-xs"
                  >
                    Setujui
                  </button>
                )}
                {r.status !== "REJECTED" && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act("rejectConfession", r.id)}
                    className="btn-ghost !py-1.5 text-xs"
                  >
                    Tolak
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => {
                    if (window.confirm("Hapus confession ini?")) void act("deleteConfession", r.id);
                  }}
                  className="btn-danger !py-1.5 text-xs"
                >
                  Hapus
                </button>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}

/* ---------------- Comments ---------------- */

function CommentRows({
  onAction,
}: {
  onAction: (type: string, id: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<AdminCommentRow[] | null>(null);
  const [status, setStatus] = useState("VISIBLE");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRows(null);
    const data = (await api(`/api/admin/listings?type=comments&status=${status}`)) as {
      items: AdminCommentRow[];
    };
    setRows(data.items ?? []);
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(type: string, id: string) {
    setBusy(id);
    await onAction(type, id);
    setBusy(null);
    void refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-ink">Komentar</h2>
        <div className="ml-auto flex gap-1.5">
          {["ALL", "VISIBLE", "HIDDEN"].map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className={`focus-ring rounded-full border px-3 py-1 text-[11px] font-semibold ${
                status === s
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-hairline bg-surface text-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon="💬" title="Tidak ada komentar" />
      ) : (
        rows.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span className={`badge ${c.status === "HIDDEN" ? "text-danger" : "text-success"}`}>
                {c.status}
              </span>
              <Link
                href={`/confess/${c.confessionId}`}
                className="truncate font-mono hover:text-ink"
                title="Buka confession induk"
              >
                confession:{shortUid(c.confessionId)}
              </Link>
              <span className="ml-auto">{formatDateTime(c.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm text-ink/90">{c.message}</p>
            <div className="mt-3 flex gap-2">
              {c.status === "HIDDEN" ? (
                <button
                  type="button"
                  disabled={busy === c.id}
                  onClick={() => act("publishComment", c.id)}
                  className="btn-ghost !py-1.5 text-xs"
                >
                  Tayangkan
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy === c.id}
                  onClick={() => act("hideComment", c.id)}
                  className="btn-ghost !py-1.5 text-xs"
                >
                  Sembunyikan
                </button>
              )}
              <button
                type="button"
                disabled={busy === c.id}
                onClick={() => {
                  if (window.confirm("Hapus komentar ini?")) void act("deleteComment", c.id);
                }}
                className="btn-danger !py-1.5 text-xs"
              >
                Hapus
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

/* ---------------- Reports ---------------- */

function ReportRows({
  onAction,
}: {
  onAction: (type: string, id: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<AdminReportRow[] | null>(null);
  const [status, setStatus] = useState("OPEN");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRows(null);
    const data = (await api(`/api/admin/listings?type=reports&status=${status}`)) as {
      items: AdminReportRow[];
    };
    setRows(data.items ?? []);
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(type: string, id: string) {
    setBusy(id);
    await onAction(type, id);
    setBusy(null);
    void refresh();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-ink">Laporan</h2>
        <div className="ml-auto flex gap-1.5">
          {["OPEN", "RESOLVED", "DISMISSED", "ALL"].map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className={`focus-ring rounded-full border px-3 py-1 text-[11px] font-semibold ${
                status === s
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-hairline bg-surface text-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon="🕊️" title="Tidak ada laporan" />
      ) : (
        rows.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="badge text-warning uppercase">{r.reason}</span>
              <span className={`badge ${
                r.status === "OPEN"
                  ? "text-warning"
                  : r.status === "RESOLVED"
                    ? "text-success"
                    : "text-muted"
              }`}>
                {r.status}
              </span>
              <Link
                href={`/confess/${r.confessionId}`}
                className="font-mono text-primary hover:underline"
              >
                Lihat confession
              </Link>
              <span className="ml-auto text-muted">{formatDateTime(r.createdAt)}</span>
            </div>
            {r.detail && <p className="mt-2 text-xs text-muted">Catatan: {r.detail}</p>}
            <div className="mt-3 flex gap-2">
              {r.status === "OPEN" && (
                <>
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act("deleteConfession", r.confessionId)}
                    className="btn-danger !py-1.5 text-xs"
                    title="Hapus confession yang dilaporkan"
                  >
                    Hapus confession
                  </button>
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act("resolveReport", r.id)}
                    className="btn-ghost !py-1.5 text-xs"
                  >
                    Tandai selesai
                  </button>
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act("dismissReport", r.id)}
                    className="btn-ghost !py-1.5 text-xs"
                  >
                    Abaikan
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => {
                  if (window.confirm("Hapus data laporan ini?")) void act("deleteReport", r.id);
                }}
                className="btn-ghost !py-1.5 text-xs"
              >
                Hapus laporan
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}

/* ---------------- Users ---------------- */

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    owner: "bg-secondary/20 text-secondary",
    admin: "bg-primary/15 text-primary",
    user: "bg-surface text-muted",
  };
  return (
    <span className={`badge ${map[role] ?? map.user} font-mono uppercase`}>
      {role}
    </span>
  );
}

function UserRows({
  onAction,
  isOwner,
}: {
  onAction: (type: string, id: string) => Promise<void>;
  isOwner: boolean;
}) {
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { refreshAuthToken } = useAuth();
  const { toast: userToast } = useToast();

  const refresh = useCallback(async () => {
    setRows(null);
    const data = (await api("/api/admin/listings?type=users")) as {
      items: AdminUserRow[];
    };
    setRows(data.items ?? []);
  }, []);

  async function setRole(uid: string, role: string) {
    setBusy(uid);
    try {
      await api("/api/admin/roles", { body: { uid, role } });
      userToast("success", `Role ${shortUid(uid)} → ${role.toUpperCase()}.`);
      await refreshAuthToken();
      void refresh();
    } catch (err) {
      userToast("error", err instanceof ApiClientError ? err.message : "Gagal mengubah role.");
    } finally {
      setBusy(null);
    }
  }

  async function act(type: string, id: string) {
    setBusy(id);
    await onAction(type, id);
    setBusy(null);
    void refresh();
  }

  const filtered = useMemo(() => {
    if (!rows) return null;
    const list = blockedOnly ? rows.filter((r) => r.isBlocked) : rows;
    const q = search.trim().toLowerCase();
    return q ? list.filter((r) => r.uid.toLowerCase().includes(q)) : list;
  }, [rows, blockedOnly, search]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold text-ink">Pengguna</h2>
        <span className="badge">ladder: owner &gt; admin &gt; user</span>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={blockedOnly}
            onChange={(e) => setBlockedOnly(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Hanya diblokir
        </label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari UID…"
          maxLength={40}
          className="input !w-44 !py-1.5 text-xs"
          aria-label="Cari UID pengguna"
        />
      </div>

      {filtered === null ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="👥" title="Tidak ada pengguna" />
      ) : (
        filtered.map((u) => (
          <div key={u.uid} className="card flex flex-wrap items-center gap-3 p-4">
            <span className="font-mono text-xs text-ink" title={u.uid}>
              {shortUid(u.uid)}
            </span>
            <RoleBadge role={u.role} />
            <span className={`badge ${u.isBlocked ? "text-danger" : "text-success"}`}>
              {u.isBlocked ? "DIBLOKIR" : "AKTIF"}
            </span>
            <span className="ml-auto text-[11px] text-muted">
              {formatDateTime(u.createdAt)}
            </span>

            {isOwner && !u.isBlocked && (
              <label className="flex items-center gap-2 text-[11px] text-muted">
                <span className="sr-only">Ubah role {shortUid(u.uid)}</span>
                <select
                  value={u.role}
                  disabled={busy === u.uid}
                  onChange={(e) => void setRole(u.uid, e.target.value)}
                  className="input !w-28 !py-1.5 text-xs"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="owner">owner</option>
                </select>
              </label>
            )}
            {!isOwner && <span className="text-[11px] text-muted">role hanya diatur owner</span>}

            {u.isBlocked ? (
              <button
                type="button"
                disabled={busy === u.uid}
                onClick={() => act("unblockUser", u.uid)}
                className="btn-ghost !py-1.5 text-xs"
              >
                Lepas blokir
              </button>
            ) : (
              u.role !== "owner" && (
                <button
                  type="button"
                  disabled={busy === u.uid}
                  onClick={() => {
                    if (window.confirm("Blokir akun ini dari mengirim konten?")) {
                      void act("blockUser", u.uid);
                    }
                  }}
                  className="btn-danger !py-1.5 text-xs"
                >
                  Blokir
                </button>
              )
            )}
          </div>
        ))
      )}
    </section>
  );
}

/* ---------------- Categories ---------------- */

function CategoriesView() {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold text-ink">Kategori (konfigurasi tetap)</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="flex items-center gap-3">
              <span aria-hidden className="text-xl">{c.emoji}</span>
              <div>
                <p className="font-semibold text-ink">{c.label}</p>
                <p className="font-mono text-[11px] text-muted">id: {c.id}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">{c.description}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        Kategori terdaftar di kode (src/lib/categories). Perubahan kategori wajib
        diikuti validasi server agar konsisten.
      </p>
    </section>
  );
}

/* ---------------- Announcements & Settings ---------------- */

function AnnouncementBase({
  toast,
  withMaintenance,
}: {
  toast: ReturnType<typeof useToast>["toast"];
  withMaintenance: boolean;
}) {
  const [announcement, setAnnouncement] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = (await api("/api/settings", { method: "GET", auth: false })) as {
          maintenanceMode?: boolean;
          announcement?: string;
          allowComments?: boolean;
        };
        setAnnouncement(data.announcement ?? "");
        setMaintenance(data.maintenanceMode === true);
        setAllowComments(data.allowComments !== false);
      } catch {
        /* defaults */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(patch: {
    announcement?: string;
    maintenanceMode?: boolean;
    allowComments?: boolean;
  }) {
    setBusy(true);
    try {
      await api("/api/admin/settings", { body: patch });
      toast("success", "Pengaturan tersimpan.");
    } catch (err) {
      toast("error", err instanceof ApiClientError ? err.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <StatSkeleton />;
  }

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <label htmlFor="announcement" className="label">
          Pengumuman (tampil sebagai banner publik)
        </label>
        <textarea
          id="announcement"
          rows={3}
          maxLength={280}
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
          placeholder="Contoh: Moderasi ditutup sementara hari ini."
          className="input resize-y"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ announcement })}
            className="btn-primary"
          >
            {busy ? "Menyimpan…" : "Simpan pengumuman"}
          </button>
        </div>
      </div>

      <div className="card divide-y divide-hairline">
        {withMaintenance && (
          <div className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="font-semibold text-ink">Maintenance mode</p>
              <p className="mt-0.5 text-xs text-muted">
                Menonaktifkan pengiriman confession & komentar sementara.
              </p>
            </div>
            <ToggleSwitch
              checked={maintenance}
              onChange={(v) => {
                setMaintenance(v);
                void save({ maintenanceMode: v });
              }}
              label="Maintenance"
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold text-ink">Izinkan komentar</p>
            <p className="mt-0.5 text-xs text-muted">
              Nonaktif bila komentar tidak lagi diterima dari publik.
            </p>
          </div>
          <ToggleSwitch
            checked={allowComments}
            onChange={(v) => {
              setAllowComments(v);
              void save({ allowComments: v });
            }}
            label="Komentar"
          />
        </div>
      </div>
    </div>
  );
}

function AnnouncementPanel({
  toast,
}: {
  toast: ReturnType<typeof useToast>["toast"];
}) {
  return <AnnouncementBase toast={toast} withMaintenance={false} />;
}

function SettingsPanel({
  toast,
}: {
  toast: ReturnType<typeof useToast>["toast"];
}) {
  return <AnnouncementBase toast={toast} withMaintenance />;
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-muted/40"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
