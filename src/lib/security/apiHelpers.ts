import type { NextRequest } from "next/server";
import { getAdminAuth, getAdminRtdb } from "@/lib/firebase/admin";
import { normalizeUserRole, rank } from "@/lib/auth/roles";
import type { UserRole } from "@/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json(
      { error: err.message, code: err.code ?? null },
      { status: err.status }
    );
  }
  // eslint-disable-next-line no-console
  console.error("[api] unhandled error:", err);
  return Response.json(
    { error: "Terjadi kesalahan di server. Coba lagi nanti." },
    { status: 500 }
  );
}

interface VerifiedToken {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
}

async function verifyRequestToken(
  req: NextRequest
): Promise<VerifiedToken | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.length > 4096) return null;
  try {
    // checkRevoked = true → token yang dicabut (mis. role diturunkan) langsung ditolak.
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      isAnonymous: decoded.firebase?.sign_in_provider === "anonymous",
    };
  } catch {
    return null;
  }
}

export interface AuthContext {
  uid: string;
  email: string | null;
  role: UserRole;
}

/**
 * Signed-in + role efektif.
 * Role = field `users/{uid}/role` di Realtime Database (sumber kebenaran
 * tunggal). Akun baru selalu "user"; naik ke moderator/admin/owner dilakukan
 * dengan mengedit field itu di Firebase Console (atau lewat panel owner).
 * Klien tidak punya hak tulis ke `users/*` (Security Rules), jadi tidak ada
 * yang bisa menaikkan role-nya sendiri dari browser.
 */
async function getAuthContext(req: NextRequest): Promise<AuthContext> {
  const verified = await verifyRequestToken(req);
  if (!verified) {
    throw new ApiError(
      401,
      "Kamu belum terautentikasi atau sesi tidak valid, coba muat ulang halaman.",
      "unauthenticated"
    );
  }
  const ref = getAdminRtdb().ref(`users/${verified.uid}`);
  const snap = await ref.get();
  let dbRole: UserRole = "user";
  if (!snap.exists()) {
    if (verified.email && !verified.isAnonymous) {
      await ensureUserDoc(verified.uid, verified.email);
    }
  } else {
    const data = snap.val() as Record<string, unknown>;
    dbRole = normalizeUserRole(data?.role);
    if (verified.email && data?.email !== verified.email) {
      await ref.update({ email: verified.email, updatedAt: Date.now() });
    }
  }
  return { uid: verified.uid, email: verified.email, role: dbRole };
}

/** Untuk endpoint yang butuh uid + email + role. */
export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  return getAuthContext(req);
}

/** Semua signed-in user (termasuk user biasa & anonim). */
export async function requireUid(req: NextRequest): Promise<string> {
  return (await getAuthContext(req)).uid;
}

/** moderator / admin / owner. */
export async function requireStaff(req: NextRequest): Promise<AuthContext> {
  const ctx = await getAuthContext(req);
  if (rank(ctx.role) < rank("moderator")) {
    throw new ApiError(403, "Akses ditolak — butuh role moderator ke atas.", "not-staff");
  }
  return ctx;
}

/** admin / owner. */
export async function requireAdmin(req: NextRequest): Promise<AuthContext> {
  const ctx = await getAuthContext(req);
  if (rank(ctx.role) < rank("admin")) {
    throw new ApiError(403, "Akses ditolak — butuh role admin ke atas.", "not-admin");
  }
  return ctx;
}

/** Role owner (tertinggi). */
export async function requireOwner(req: NextRequest): Promise<AuthContext> {
  const ctx = await getAuthContext(req);
  if (ctx.role !== "owner") {
    throw new ApiError(403, "Akses ditolak — hanya untuk owner.", "not-owner");
  }
  return ctx;
}

export async function assertNotBlocked(uid: string): Promise<void> {
  const snap = await getAdminRtdb().ref(`users/${uid}/isBlocked`).get();
  if (snap.val() === true) {
    throw new ApiError(
      403,
      "Akunmu diblokir karena melanggar aturan komunitas.",
      "blocked"
    );
  }
}

/**
 * Membuat profil users/{uid} di Realtime Database dengan role default "user"
 * bila belum ada. Bila sudah ada, role TIDAK disentuh.
 */
export async function ensureUserDoc(
  uid: string,
  email?: string | null
): Promise<UserRole> {
  const ref = getAdminRtdb().ref(`users/${uid}`);
  const snap = await ref.get();
  if (snap.exists()) {
    const data = snap.val() as Record<string, unknown>;
    if (email && !data?.email) {
      await ref.update({ email, updatedAt: Date.now() });
    }
    return normalizeUserRole(data?.role);
  }
  const now = Date.now();
  await ref.set({
    uid,
    email: email ?? "",
    displayName: "",
    role: "user",
    status: "active",
    isBlocked: false,
    createdAt: now,
    updatedAt: now,
  });
  return "user";
}
