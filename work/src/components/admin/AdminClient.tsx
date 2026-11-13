"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { getRtdb } from "@/lib/firebase/client";
import { isAdminRole } from "@/lib/auth/roles";
import type { Song, UserRole } from "@/types";
import { SongCard } from "@/components/songs/SongCard";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/lib/auth/ToastProvider";
import { CATEGORIES, getCategory, isCategoryId } from "@/lib/categories";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { StatSkeleton } from "@/components/ui/Skeletons";
import { AuthAccountPanel } from "./AuthAccountPanel";
import { formatDateTime, formatNumber, shortUid } from "@/utils/format";
import { Icon, type IconName } from "@/components/ui/Icon";

type Tab =
  | "overview"
  | "moderation"
  | "confessions"
  | "comments"
  | "reports"
  | "users"
  | "ips"
  | "categories"
  | "announcements"
  | "settings"
  | "audit";

interface TabMeta {
  id: Tab;
  label: string;
  icon: IconName;
  group: string;
  desc: string;
}

const TABS: readonly TabMeta[] = [
  { id: "overview", label: "Ringkasan", icon: "chart", group: "Utama", desc: "Statistik aktivitas CONFESS secara realtime." },
  { id: "moderation", label: "Moderasi", icon: "shield", group: "Konten", desc: "Confession yang menunggu persetujuan." },
  { id: "confessions", label: "Confession", icon: "pencil", group: "Konten", desc: "Semua confession beserta statusnya." },
  { id: "comments", label: "Komentar", icon: "message", group: "Konten", desc: "Tinjau dan kelola komentar pengguna." },
  { id: "reports", label: "Laporan", icon: "flag", group: "Konten", desc: "Laporan dari pengguna yang perlu ditindaklanjuti." },
  { id: "users", label: "Pengguna", icon: "users", group: "Pengguna", desc: "Kelola akun, role, dan pemblokiran." },
  { id: "ips", label: "Log IP", icon: "globe", group: "Pengguna", desc: "Pantau aktivitas dan alamat IP mencurigakan." },
  { id: "categories", label: "Kategori", icon: "grid", group: "Sistem", desc: "Daftar kategori confession." },
  { id: "announcements", label: "Pengumuman", icon: "megaphone", group: "Sistem", desc: "Banner pengumuman di seluruh situs." },
  { id: "settings", label: "Pengaturan", icon: "sliders", group: "Sistem", desc: "Pengaturan situs, fitur, dan moderasi AI." },
  { id: "audit", label: "Audit Log", icon: "file", group: "Sistem", desc: "Riwayat tindakan admin dan moderator." },
];

/** Tab yang boleh dilihat moderator; sisanya admin/owner. */
const MODERATOR_TABS: readonly Tab[] = [
  "overview",
  "moderation",
  "confessions",
  "comments",
  "reports",
  "categories",
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
  ai?: string;
  fromName?: string;
  toName?: string;
  song?: Song | null;
  songLyric?: string;
  ip?: string;
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
  email: string;
  role: string;
  isBlocked: boolean;
  createdAt: number;
}

interface AdminIpRow {
  id: string;
  ip: string;
  firstSeen: number;
  lastSeen: number;
  confessions: number;
  comments: number;
  blocked: boolean;
  flagged: boolean;
  uidCount: number;
}

export function AdminClient() {
  const { isAdmin, role, loading, configured, uid, isAnonymous, signOutNow } = useAuth();
  const { toast } = useToast();
  const pathname = usePathname();
  const section = pathname.split("/")[2] ?? "";
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.id === section) ? (section as Tab) : "overview"
  );
  const [tick, setTick] = useState(0);
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

  // Realtime dashboard: server menaikkan meta/adminTick di setiap mutasi
  // (confession baru, aksi moderasi, perubahan role, …) → tab aktif dimuat ulang.
  useEffect(() => {
    if (!isAdmin) return;
    let first = true;
    const unsub = onValue(
      ref(getRtdb(), "meta/adminTick"),
      () => {
        if (first) {
          first = false;
          return;
        }
        setTick((t) => t + 1);
      },
      () => undefined
    );
    return unsub;
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) void refreshStats();
  }, [isAdmin, tick, refreshStats]);

  const visibleTabs = TABS.filter(
    (t) => isAdminRole(role) || MODERATOR_TABS.includes(t.id)
  );
  const groups = Array.from(new Set(visibleTabs.map((t) => t.group)));
  const current = visibleTabs.find((t) => t.id === tab) ?? visibleTabs[0];

  const badgeFor = (id: Tab): number =>
    id === "moderation"
      ? stats?.pendingConfessions ?? 0
      : id === "reports"
        ? stats?.openReports ?? 0
        : 0;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-10">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{StatSkeletonSkeletonList()}</div>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <ErrorState
          title="Firebase belum terkonfigurasi"
          description="Isi NEXT_PUBLIC_FIREBASE_* dan FIREBASE_ADMIN_* environment variables terlebih dahulu."
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white">
            <Icon name="shield" className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-ink">CONFESS Admin</p>
            <p className="text-xs text-muted">Console pengelolaan</p>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
        <EmptyState
          icon="lock"
          title="Akses admin diperlukan"
          description="Dashboard hanya untuk akun dengan role moderator/admin/owner yang diverifikasi server dari database. Pendaftaran baru selalu ber-role user biasa — role dinaikkan oleh owner (atau lewat Firebase Console)."
        />
        {/* Daftar manual: selalu ber-role user biasa */}
        <AuthAccountPanel />
        {!isAnonymous && <OwnerSetupPanel />}
        {uid && (
          <p className="rounded-xl bg-surface p-4 font-mono text-xs text-muted">
            UID sesimu: {uid}
          </p>
        )}
      </div>
    );
  }

  const navButton = (t: TabMeta) => {
    const active = tab === t.id;
    const count = badgeFor(t.id);
    return (
      <button
        key={t.id}
        type="button"
        aria-current={active ? "page" : undefined}
        onClick={() => setTab(t.id)}
        className={`focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
          active ? "bg-primary/10 text-primary" : "text-muted hover:bg-ink/5 hover:text-ink"
        }`}
      >
        <Icon name={t.icon} className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{t.label}</span>
        {count > 0 && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-hairline bg-surface lg:flex">
        <div className="flex items-center gap-2.5 border-b border-hairline px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white">
            <Icon name="shield" className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-ink">CONFESS Admin</p>
            <p className="text-xs text-muted">Console pengelolaan</p>
          </div>
        </div>
        <nav aria-label="Menu admin" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((g) => (
            <div key={g}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted/80">{g}</p>
              <div className="space-y-0.5">{visibleTabs.filter((t) => t.group === g).map(navButton)}</div>
            </div>
          ))}
        </nav>
        <div className="space-y-3 border-t border-hairline p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span className="font-mono">{shortUid(uid)}</span>
            <RoleBadge role={role} />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void signOutNow()} className="btn-ghost flex-1 !py-2 text-xs">
              Keluar
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar mobile */}
        <header className="sticky top-0 z-30 border-b border-hairline bg-surface/95 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">
              <Icon name="shield" className="h-4 w-4" />
            </span>
            <p className="text-sm font-bold text-ink">CONFESS Admin</p>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => void signOutNow()} className="btn-ghost !px-3 !py-1.5 text-xs">
                Keluar
              </button>
              <ThemeToggle />
            </div>
          </div>
          <div
            role="toolbar"
            aria-label="Menu admin"
            className="flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visibleTabs.map((t) => {
              const count = badgeFor(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className="chip flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
                >
                  {t.label}
                  {count > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-white">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 lg:px-8 lg:py-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{current.label}</h1>
            <p className="mt-1 text-sm text-muted">{current.desc}</p>
          </div>
          <AdminSection
            tab={tab}
            toast={toast}
            tick={tick}
            role={role}
            stats={stats}
            loadingStats={loadingStats}
            refreshStats={refreshStats}
          />
        </main>
      </div>
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
  tick,
  role,
  stats,
  loadingStats,
  refreshStats,
}: {
  tab: Tab;
  toast: ReturnType<typeof useToast>["toast"];
  tick: number;
  role: UserRole;
  stats: StatsShape | null;
  loadingStats: boolean;
  refreshStats: () => Promise<void>;
}) {

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

  // Moderator tidak boleh membuka tab admin walau state lama menunjuk ke sana.
  if (!isAdminRole(role) && !MODERATOR_TABS.includes(tab)) return null;

  switch (tab) {
    case "overview":
      return loadingStats ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{StatSkeletonSkeletonList()}</div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Total confession" value={stats.totalConfessions} />
          <StatCard label="Pending" value={stats.pendingConfessions} accent />
          <StatCard label="Published" value={stats.publishedConfessions} />
          <StatCard label="Rejected" value={stats.rejectedConfessions} />
          <StatCard label="Total komentar" value={stats.totalComments} />
          <StatCard label="Laporan aktif" value={stats.openReports} accent />
          <StatCard label="Akun terdaftar" value={stats.totalUsers} />
          <StatCard label="Confession 7 hari" value={stats.last7DaysConfessions} />
        </div>
      ) : (
        <ErrorState description="Statistik gagal dimuat. Coba buka menu lain lalu kembali." />
      );
    case "moderation":
    case "confessions":
      return (
        <ConfessionRows
          key={`${tab}-${tick}`}
          statusFilter={tab === "moderation" ? "PENDING" : "ALL"}
          title={tab === "moderation" ? "Menunggu moderasi" : "Semua confession"}
          onAction={onAction}
        />
      );
    case "comments":
      return <CommentRows key={tick} onAction={onAction} />;
    case "reports":
      return <ReportRows key={tick} onAction={onAction} />;
    case "users":
      return <UserRows key={tick} onAction={onAction} role={role} />;
    case "ips":
      return <IpRows key={tick} onAction={onAction} />;
    case "categories":
      return <CategoriesView />;
    case "announcements":
      return <AnnouncementPanel toast={toast} />;
    case "settings":
      return <SettingsPanel toast={toast} />;
    case "audit":
      return <AuditRows key={tick} />;
    default:
      return null;
  }
}

const STAT_ICONS: Record<string, IconName> = {
  "Total confession": "file",
  Pending: "clock",
  Published: "check",
  Rejected: "xcircle",
  "Total komentar": "message",
  "Laporan aktif": "flag",
  "Akun terdaftar": "users",
  "Confession 7 hari": "chart",
};

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
    <div className="card p-4 sm:p-5" data-accent={accent ? "1" : undefined}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span
          aria-hidden
          className={`grid h-8 w-8 place-items-center rounded-lg ${
            accent ? "bg-primary/15 text-primary" : "bg-ink/5 text-muted"
          }`}
        >
          <Icon name={STAT_ICONS[label] ?? "chart"} className="h-4 w-4" />
        </span>
      </div>
      <p
        className={`mt-3 text-3xl font-bold tracking-tight tabular-nums ${accent ? "text-primary" : "text-ink"}`}
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

  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRows(null);
    setLoadError(null);
    try {
      const data = (await api(
        `/api/admin/confessions?status=${status}&pageSize=20`,
        { method: "GET" }
      )) as { items: AdminConfessionRow[] };
      setRows(data.items ?? []);
    } catch (err) {
      setRows([]);
      setLoadError(
        err instanceof ApiClientError ? err.message : "Gagal memuat confession."
      );
    }
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
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="section-title">{title}</h2>
        <div className="ml-auto flex max-w-full gap-1.5 overflow-x-auto">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className="chip px-3 py-1 text-[11px] font-semibold"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : loadError ? (
        <ErrorState description={loadError} />
      ) : rows.length === 0 ? (
        <EmptyState icon="check" title="Tidak ada confession" />
      ) : (
        rows.map((r) => {
          const cat = isCategoryId(r.category) ? getCategory(r.category) : getCategory("random");
          return (
            <article key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge">
                  <Icon name={cat.icon} className="inline h-3.5 w-3.5 align-[-2px]" /> {cat.label}
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
                {r.ai && (
                  <span className="badge">
                    AI: {r.ai === "approve" ? "menyetujui" : "serahkan ke moderator"}
                  </span>
                )}
                {r.ip && (
                  <span className="badge font-mono" title="IP pengirim">
                    IP: {r.ip}
                  </span>
                )}
                <span className="ml-auto text-[11px] text-muted">
                  {formatDateTime(r.createdAt)} ·{" "}
                  <Icon name="heart" className="inline h-3 w-3 align-[-1px]" /> {r.likesCount} ·{" "}
                  <Icon name="message" className="inline h-3 w-3 align-[-1px]" /> {r.commentsCount}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface/70 px-2.5 py-1">
                  <span className="text-muted">Dari</span>
                  <strong className="font-semibold text-ink">{r.fromName?.trim() || "Anonim"}</strong>
                </span>
                <span aria-hidden className="text-muted">→</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface/70 px-2.5 py-1">
                  <span className="text-muted">Untuk</span>
                  <strong className="font-semibold text-ink">{r.toName?.trim() || "—"}</strong>
                </span>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/90">{r.message}</p>
              {r.song && (
                <div className="mt-3 space-y-2">
                  <SongCard song={r.song} lyric={r.songLyric || undefined} />
                  {r.songLyric && (
                    <p className="rounded-xl bg-ink/5 px-3 py-2 text-xs italic text-muted">“{r.songLyric}”</p>
                  )}
                </div>
              )}
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
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="section-title">Komentar</h2>
        <div className="ml-auto flex max-w-full gap-1.5 overflow-x-auto">
          {["ALL", "VISIBLE", "HIDDEN"].map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className="chip px-3 py-1 text-[11px] font-semibold"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon="message" title="Tidak ada komentar" />
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
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="section-title">Laporan</h2>
        <div className="ml-auto flex max-w-full gap-1.5 overflow-x-auto">
          {["OPEN", "RESOLVED", "DISMISSED", "ALL"].map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className="chip px-3 py-1 text-[11px] font-semibold"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon="check" title="Tidak ada laporan" />
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
    moderator: "bg-primary/10 text-primary",
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
  role,
}: {
  onAction: (type: string, id: string) => Promise<void>;
  role: UserRole;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const refresh = useCallback(async () => {
    setRows(null);
    const data = (await api("/api/admin/listings?type=users")) as {
      items: AdminUserRow[];
    };
    setRows(data.items ?? []);
  }, []);

  async function act(type: string, id: string) {
    setBusy(id);
    await onAction(type, id);
    setBusy(null);
    void refresh();
  }

  // Hanya OWNER: ubah role lewat server (database + audit log).
  async function changeRole(uid: string, next: string) {
    if (!window.confirm(`Ubah role akun ini menjadi ${next.toUpperCase()}?`)) return;
    setBusy(uid);
    try {
      await api("/api/admin/roles", { body: { uid, role: next } });
      toast("success", "Role diperbarui.");
    } catch (err) {
      toast("error", err instanceof ApiClientError ? err.message : "Gagal mengubah role.");
    } finally {
      setBusy(null);
      void refresh();
    }
  }

  const filtered = useMemo(() => {
    if (!rows) return null;
    const list = blockedOnly ? rows.filter((r) => r.isBlocked) : rows;
    const q = search.trim().toLowerCase();
    return q
      ? list.filter(
          (r) =>
            r.uid.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
        )
      : list;
  }, [rows, blockedOnly, search]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="section-title">Pengguna</h2>
        <span className="badge">role diubah owner lewat server</span>
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
          placeholder="Cari email / UID…"
          maxLength={40}
          className="input !w-44 !py-1.5 text-xs"
          aria-label="Cari email atau UID pengguna"
        />
      </div>

      {filtered === null ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="users" title="Tidak ada pengguna" />
      ) : (
        filtered.map((u) => (
          <div key={u.uid} className="card flex flex-wrap items-center gap-3 p-4">
            <span className="text-xs text-ink" title={u.uid}>
              {u.email || <span className="font-mono">{shortUid(u.uid)}</span>}
            </span>
            <RoleBadge role={u.role} />
            {role === "owner" && (
              <select
                aria-label={`Ubah role ${u.email || u.uid}`}
                value={u.role}
                disabled={busy === u.uid}
                onChange={(e) => void changeRole(u.uid, e.target.value)}
                className="input !w-auto !py-1 text-xs"
              >
                <option value="user">user</option>
                <option value="moderator">moderator</option>
                <option value="admin">admin</option>
                <option value="owner">owner</option>
              </select>
            )}
            <span className={`badge ${u.isBlocked ? "text-danger" : "text-success"}`}>
              {u.isBlocked ? "DIBLOKIR" : "AKTIF"}
            </span>
            <span className="ml-auto text-[11px] text-muted">
              {formatDateTime(u.createdAt)}
            </span>

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

/* ---------------- IP log (anti-spam) ---------------- */

function IpRows({
  onAction,
}: {
  onAction: (type: string, id: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<AdminIpRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    setRows(null);
    const data = (await api("/api/admin/listings?type=ips")) as { items: AdminIpRow[] };
    setRows(data.items ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(type: string, id: string) {
    setBusy(id);
    await onAction(type, id);
    setBusy(null);
    void refresh();
  }

  const filtered = useMemo(() => {
    if (!rows) return null;
    const list = onlyFlagged ? rows.filter((r) => r.flagged || r.blocked) : rows;
    const q = search.trim();
    return q ? list.filter((r) => r.ip.includes(q)) : list;
  }, [rows, onlyFlagged, search]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="section-title">Catatan IP</h2>
        <span className="badge">blokir IP hanya admin/owner</span>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={onlyFlagged}
            onChange={(e) => setOnlyFlagged(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Hanya mencurigakan / diblokir
        </label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari IP…"
          maxLength={45}
          className="input !w-40 !py-1.5 text-xs"
          aria-label="Cari alamat IP"
        />
      </div>
      <p className="text-xs text-muted">
        Setiap kiriman confession & komentar mencatat IP jaringannya. Satu IP yang
        dipakai banyak akun berbeda otomatis ditandai mencurigakan; IP yang diblokir
        tidak bisa mengirim apa pun dari jaringan itu.
      </p>

      {filtered === null ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="globe" title="Belum ada catatan IP" />
      ) : (
        filtered.map((n) => (
          <div key={n.id} className="card flex flex-wrap items-center gap-3 p-4">
            <span className="font-mono text-sm font-semibold text-ink">{n.ip || "?"}</span>
            {n.flagged && <span className="badge text-warning">MENCURIGAKAN</span>}
            <span className={`badge ${n.blocked ? "text-danger" : "text-success"}`}>
              {n.blocked ? "DIBLOKIR" : "NORMAL"}
            </span>
            <span className="text-xs text-muted">
              {n.uidCount} akun · {n.confessions} confession · {n.comments} komentar
            </span>
            <span className="ml-auto text-[11px] text-muted">
              terakhir: {formatDateTime(n.lastSeen)}
            </span>
            <div className="flex gap-2">
              {n.blocked ? (
                <button
                  type="button"
                  disabled={busy === n.id}
                  onClick={() => act("unblockIp", n.id)}
                  className="btn-ghost !py-1.5 text-xs"
                >
                  Lepas blokir
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy === n.id}
                  onClick={() => {
                    if (window.confirm(`Blokir IP ${n.ip} dari mengirim konten?`)) {
                      void act("blockIp", n.id);
                    }
                  }}
                  className="btn-danger !py-1.5 text-xs"
                >
                  Blokir IP
                </button>
              )}
            </div>
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
      <h2 className="section-title">Kategori (konfigurasi tetap)</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="flex items-center gap-3">
              <Icon name={c.icon} className="h-5 w-5 text-primary" />
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
  const [allowConfessions, setAllowConfessions] = useState(true);
  const [allowSongs, setAllowSongs] = useState(true);
  const [aiModeration, setAiModeration] = useState(true);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTest, setAiTest] = useState<{ ok: boolean; text: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = (await api("/api/settings", { method: "GET", auth: false })) as {
          maintenanceMode?: boolean;
          announcement?: string;
          allowComments?: boolean;
          allowConfessions?: boolean;
          allowSongs?: boolean;
          aiModeration?: boolean;
        };
        setAllowConfessions(data.allowConfessions !== false);
        setAllowSongs(data.allowSongs !== false);
        setAiModeration(data.aiModeration !== false);
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
    allowConfessions?: boolean;
    allowSongs?: boolean;
    aiModeration?: boolean;
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

  async function testAi() {
    setAiTesting(true);
    setAiTest(null);
    try {
      const d = (await api("/api/admin/ai-test", { body: {} })) as {
        configured: boolean;
        keys?: number;
        model: string;
        music?: { configured: boolean; keys: number; model: string; envPrefix: string };
        checks: {
          label: string;
          expected: string;
          verdict: string | null;
          ok: boolean;
          ms: number;
          error: string;
        }[];
      };
      const lines: { ok: boolean; text: string }[] = [];
      if (!d.configured) {
        lines.push({
          ok: false,
          text: "API key AI moderasi belum terisi. Isi OPENROUTER_API_KEYS (atau OPENROUTER_API_KEY_1 s.d. _5) di environment Vercel.",
        });
      } else {
        lines.push({ ok: true, text: `AI moderasi — model ${d.model}, key aktif: ${d.keys ?? 1}` });
        lines.push(
          ...d.checks.map((c) => ({
            ok: c.ok,
            text: c.error
              ? `${c.label}: GAGAL. ${c.error}`
              : `${c.label}: AI menjawab "${c.verdict}" (${(c.ms / 1000).toFixed(1)} dtk)${c.ok ? "" : `, diharapkan "${c.expected}"`}`,
          }))
        );
      }
      const m = d.music;
      if (m) {
        lines.push(
          m.configured
            ? { ok: true, text: `AI musik (lirik) terpisah — model ${m.model}, key aktif: ${m.keys}` }
            : {
                ok: false,
                text: `AI musik (lirik & sinkron) belum punya key sendiri — isi ${m.envPrefix}_API_KEYS atau ${m.envPrefix}_API_KEY_1 di environment.`,
              }
        );
      }
      setAiTest(lines);
    } catch (err) {
      setAiTest([{ ok: false, text: err instanceof ApiClientError ? err.message : "Tes AI gagal." }]);
    } finally {
      setAiTesting(false);
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
        {withMaintenance && (
          <div className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="font-semibold text-ink">Moderasi AI</p>
              <p className="mt-0.5 text-xs text-muted">
                AI menyetujui confession yang sopan tanpa batas kuota (batasnya hanya
                limit API key OpenRouter), meminta revisi bila kurang pas, dan
                menyerahkan kasus sensitif ke moderator.
              </p>
            </div>
            <ToggleSwitch
              checked={aiModeration}
              onChange={(v) => {
                setAiModeration(v);
                void save({ aiModeration: v });
              }}
              label="Moderasi AI"
            />
          </div>
        )}
        {withMaintenance && (
          <div className="space-y-2 p-5">
            <button
              type="button"
              disabled={aiTesting}
              onClick={() => void testAi()}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              {aiTesting ? "Menguji AI…" : "Tes koneksi AI"}
            </button>
            {aiTest && (
              <ul className="space-y-1 text-xs">
                {aiTest.map((l, i) => (
                  <li key={i} className={l.ok ? "text-success" : "text-warning"}>
                    {l.ok ? "✓ " : "✗ "}
                    {l.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {withMaintenance && (
          <div className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="font-semibold text-ink">Izinkan lagu</p>
              <p className="mt-0.5 text-xs text-muted">
                Pengirim bisa menempelkan lagu (Deezer) beserta preview 30 detik.
              </p>
            </div>
            <ToggleSwitch
              checked={allowSongs}
              onChange={(v) => {
                setAllowSongs(v);
                void save({ allowSongs: v });
              }}
              label="Lagu"
            />
          </div>
        )}
        {withMaintenance && (
          <div className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="font-semibold text-ink">Izinkan confession baru</p>
              <p className="mt-0.5 text-xs text-muted">
                Nonaktif bila pengiriman confession baru ditutup sementara.
              </p>
            </div>
            <ToggleSwitch
              checked={allowConfessions}
              onChange={(v) => {
                setAllowConfessions(v);
                void save({ allowConfessions: v });
              }}
              label="Confession baru"
            />
          </div>
        )}
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
        checked ? "bg-gradient-to-r from-primary to-secondary" : "bg-muted/40"
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


/* ---------------- Audit log ---------------- */

interface AuditRow {
  id: string;
  actorUid: string;
  action: string;
  target: string;
  timestamp: number;
}

function AuditRows() {
  const [source, setSource] = useState<"audit" | "activity">("audit");
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    setRows(null);
    void (async () => {
      try {
        const data = (await api(
          `/api/admin/listings?type=audit&source=${source}&pageSize=50`
        )) as { items: AuditRow[] };
        if (alive) setRows(data.items ?? []);
      } catch {
        if (alive) setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [source]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="section-title mr-auto">Log</h2>
        {(
          [
            ["audit", "file", "Tindakan staff"],
            ["activity", "user", "Aktivitas pengguna"],
          ] as const
        ).map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={source === id}
            onClick={() => setSource(id)}
            className="chip px-3 py-1 text-xs font-semibold"
          >
            <Icon name={icon} className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
            {label}
          </button>
        ))}
      </div>
      {rows === null ? (
        <StatSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState icon="file" title="Belum ada catatan" />
      ) : (
        rows.map((r) => (
          <div key={r.id} className="card flex flex-wrap items-center gap-3 p-4 text-xs">
            <span className="badge font-mono">{r.action}</span>
            <span className="text-muted">oleh {shortUid(r.actorUid)}</span>
            <span className="break-all font-mono text-muted">
              → {source === "activity" ? r.target || "—" : shortUid(r.target)}
            </span>
            <span className="ml-auto text-[11px] text-muted">{formatDateTime(r.timestamp)}</span>
          </div>
        ))
      )}
    </section>
  );
}

/* ---------------- Bootstrap owner pertama ---------------- */

function OwnerSetupPanel() {
  const { refreshAuthToken } = useAuth();
  const { toast } = useToast();
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api("/api/admin/setup", { body: { secret } });
      await refreshAuthToken();
      setSecret("");
      toast("success", "Kamu sekarang OWNER. Memuat dashboard…");
    } catch (err) {
      toast("error", err instanceof ApiClientError ? err.message : "Setup gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <Icon name="key" className="h-4 w-4 text-primary" />
        Aktifkan owner pertama
      </h2>
      <p className="text-xs text-muted">
        Hanya bisa dipakai selama belum ada owner, dengan kunci setup dari
        environment variable ADMIN_SETUP_SECRET.
      </p>
      <input
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        autoComplete="off"
        placeholder="Kunci setup"
        className="input"
        aria-label="Kunci setup owner"
      />
      <button
        type="button"
        disabled={busy || secret.length < 8}
        onClick={() => void submit()}
        className="btn-primary"
      >
        {busy ? "Memproses…" : "Jadikan saya owner"}
      </button>
    </div>
  );
}
