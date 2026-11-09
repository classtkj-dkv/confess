import { getAdminRtdb } from "@/lib/firebase/admin";

/**
 * Fixed-window rate limiter berbasis Realtime Database (server only).
 * Counter di `rateLimits/{scope}_{uid}_{windowStart}` memakai transaction,
 * jadi aman terhadap request paralel. `expiresAt` bisa dipakai untuk
 * pembersihan berkala (lihat scripts/cleanup-ratelimits.mjs bila dibuat).
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitConfig {
  scope: string;
  uid: string;
  limit: number;
  windowMs: number;
}

export async function checkRateLimit(
  cfg: RateLimitConfig
): Promise<RateLimitResult> {
  const windowStart = Math.floor(Date.now() / cfg.windowMs) * cfg.windowMs;
  const resetAt = windowStart + cfg.windowMs;
  const ref = getAdminRtdb().ref(
    `rateLimits/${cfg.scope}_${cfg.uid}_${windowStart}`
  );

  const res = await ref.transaction((cur: { count?: number } | null) => {
    const count = typeof cur?.count === "number" ? cur.count : 0;
    if (count >= cfg.limit) return; // abort → tidak diizinkan
    return {
      scope: cfg.scope,
      uid: cfg.uid,
      count: count + 1,
      resetAt,
      expiresAt: resetAt,
    };
  });

  const used = Number(res.snapshot.val()?.count ?? cfg.limit);
  return {
    allowed: res.committed,
    remaining: Math.max(0, cfg.limit - used),
    resetAt,
  };
}

export const RATE_LIMITS = {
  confessionPerDay: { limit: 5, windowMs: 24 * 60 * 60 * 1000 },
  commentPerHour: { limit: 10, windowMs: 60 * 60 * 1000 },
  songSearch: { limit: 60, windowMs: 10 * 60 * 1000 },
  reportPerDay: { limit: 10, windowMs: 24 * 60 * 60 * 1000 },
} as const;
