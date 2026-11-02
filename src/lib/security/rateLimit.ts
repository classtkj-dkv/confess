import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Firestore-based fixed-window rate limiter (server side only).
 * Counter docs live in `rateLimits` and carry `expiresAt` so a Firestore
 * TTL policy can auto-delete stale windows.
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

function windowStartOf(cfg: RateLimitConfig): number {
  return Math.floor(Date.now() / cfg.windowMs) * cfg.windowMs;
}

export async function checkRateLimit(
  cfg: RateLimitConfig
): Promise<RateLimitResult> {
  const db = getAdminDb();
  const windowStart = windowStartOf(cfg);
  const resetAt = windowStart + cfg.windowMs;
  const ref = db.collection("rateLimits").doc(`${cfg.scope}:${cfg.uid}:${windowStart}`);

  const result: RateLimitResult = {
    allowed: false,
    remaining: 0,
    resetAt,
  };

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count: number =
      typeof snap.data()?.count === "number"
        ? (snap.data() as { count: number }).count
        : 0;

    result.remaining = Math.max(0, cfg.limit - count);
    if (count >= cfg.limit) return;

    tx.set(
      ref,
      {
        scope: cfg.scope,
        uid: cfg.uid,
        count: count + 1,
        resetAt,
        // Firestore TTL candidate field — create a TTL policy on `expiresAt`.
        expiresAt: resetAt,
      },
      { merge: true }
    );
    result.allowed = true;
    result.remaining = Math.max(0, cfg.limit - (count + 1));
  });

  return result;
}

export const RATE_LIMITS = {
  confessionPerDay: { limit: 5, windowMs: 24 * 60 * 60 * 1000 },
  commentPerHour: { limit: 10, windowMs: 60 * 60 * 1000 },
  reportPerDay: { limit: 10, windowMs: 24 * 60 * 60 * 1000 },
} as const;
