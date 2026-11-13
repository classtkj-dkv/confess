import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { ApiError } from "@/lib/security/apiHelpers";

/**
 * Pengawas IP (server only) — anti-spam dari alamat yang sama / mencurigakan.
 *
 * Setiap POST confession/komentar:
 *   1. IP klien diambil dari header proxy (Vercel/CDN) lalu dinormalisasi.
 *   2. IP yang masuk daftar blokir manual admin langsung ditolak.
 *   3. Rate limit khusus per IP (terpisah dari limit per akun), jadi satu orang
 *      yang buat banyak akun anonim tetap terkendali.
 *   4. Aktivitas dicatat ke `ip_logs` (dipakai admin panel): daftar akun yang
 *      pernah lewat IP itu, hitungan aksi, dan tanda "mencurigakan" bila satu
 *      IP dipakai banyak akun berbeda.
 */

export interface IpWatchResult {
  ip: string;
  /** Kunci RTDB (hash) dari IP ini. */
  key: string;
  limited: boolean;
  resetAt: number;
}

const IP_PATTERN =
  /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]{3,45})$/;

/** Ambil IP klien dari header standar CDN/proxy (Vercel, Cloudflare, nginx). */
export function getClientIp(req: NextRequest): string {
  const candidates = [
    req.headers.get("x-real-ip"),
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0],
    req.headers.get("cf-connecting-ip"),
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0] ?? "",
  ];
  for (const c of candidates) {
    const ip = (c ?? "").trim();
    if (IP_PATTERN.test(ip)) return ip;
  }
  return "";
}

/** Kunci RTDB dari IP (hash, supaya semua karakter aman dipakai sebagai key). */
export function ipKey(ip: string): string {
  return createHash("sha1").update(ip).digest("hex");
}

export interface IpLimits {
  confession: { limit: number; windowMs: number };
  comment: { limit: number; windowMs: number };
}

/** Batas per-IP — jauh lebih lega dari limit per akun; hanya memblokir banjir. */
export const IP_LIMITS: IpLimits = {
  confession: { limit: 12, windowMs: 24 * 60 * 60 * 1000 },
  comment: { limit: 40, windowMs: 60 * 60 * 1000 },
};

/** Satu IP = maksimal 5 akun berbeda sebelum ditandai mencurigakan. */
const SUSPICIOUS_UIDS = 5;
const MAX_UIDS_STORED = 60;

export interface IpRecord {
  ip: string;
  firstSeen: number;
  lastSeen: number;
  confessions: number;
  comments: number;
  blocked: boolean;
  flagged: boolean;
  uids: Record<string, number>;
}

/**
 * Cek & catat satu aksi dari sebuah IP. Melempar 403/429 bila IP diblokir
 * atau sedang melewati batas laju. Catatan gagal tidak pernah memblokir aksi.
 */
export async function enforceIp(
  req: NextRequest,
  uid: string,
  action: "confession" | "comment"
): Promise<IpWatchResult> {
  const ip = getClientIp(req);
  const key = ip ? ipKey(ip) : "";
  if (!ip || !key) {
    // Tidak ada IP terbaca (mis. header tidak diumpankan) → lewati tanpa gagal.
    return { ip: "", key: "", limited: false, resetAt: 0 };
  }

  const db = getAdminRtdb();
  const ref = db.ref(`ip_logs/${key}`);
  const snap = await ref.get();
  const rec = (snap.val() ?? {}) as Partial<IpRecord>;
  const wasBlocked = rec.blocked === true;

  if (wasBlocked) {
    throw new ApiError(
      403,
      "Aksesmu dibatasi sementara dari jaringan ini karena aktivitas yang tidak wajar.",
      "ip-blocked"
    );
  }

  const cfg =
    action === "confession"
      ? { ...IP_LIMITS.confession }
      : { ...IP_LIMITS.comment };
  const rl = await checkRateLimit({
    scope: `ip-${action}`,
    uid: key,
    ...cfg,
  });
  if (!rl.allowed) {
    throw new ApiError(
      429,
      action === "confession"
        ? "Terlalu banyak kiriman dari jaringan ini. Coba lagi nanti."
        : "Terlalu banyak komentar dari jaringan ini. Coba lagi nanti.",
      "ip-rate-limit"
    );
  }

  // Catat pemakaian: hitungan aksi + akun yang pernah lewat.
  const now = Date.now();
  const uids = { ...(rec.uids ?? {}) };
  if (uid) uids[uid] = (uids[uid] ?? 0) + 1;
  const uidList = Object.entries(uids)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_UIDS_STORED);
  const uidCount = uidList.length;
  try {
    await ref.update({
      ip,
      firstSeen: rec.firstSeen ?? now,
      lastSeen: now,
      confessions: (rec.confessions ?? 0) + (action === "confession" ? 1 : 0),
      comments: (rec.comments ?? 0) + (action === "comment" ? 1 : 0),
      blocked: wasBlocked,
      flagged: uidCount >= SUSPICIOUS_UIDS,
      uids: Object.fromEntries(uidList),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ip-watch] gagal mencatat IP:", err);
  }

  return { ip, key, limited: false, resetAt: rl.resetAt };
}

/** Ubah status blokir sebuah IP dari admin panel. */
export async function setIpBlocked(
  ip: string,
  blocked: boolean,
  actorUid: string
): Promise<void> {
  const key = ipKey(ip);
  const ref = getAdminRtdb().ref(`ip_logs/${key}`);
  const snap = await ref.get();
  const now = Date.now();
  if (!snap.exists()) {
    // Belum ada catatan → buat baris minimal supaya blokir tetap berlaku.
    await ref.set({
      ip,
      firstSeen: now,
      lastSeen: now,
      confessions: 0,
      comments: 0,
      blocked,
      flagged: false,
      uids: {},
      ...(blocked ? { blockedBy: actorUid, blockedAt: now } : {}),
    });
  } else {
    await ref.update({
      blocked,
      lastSeen: now,
      ...(blocked ? { blockedBy: actorUid, blockedAt: now } : { blockedBy: null, blockedAt: null }),
    });
  }
}
