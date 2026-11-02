import type { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
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

async function verifyRequestToken(
  req: NextRequest
): Promise<{ uid: string; email: string | null } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.length > 4096) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    return { uid: decoded.uid, email: decoded.email ?? null };
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
 * Signed-in + baca role dari database (users/{uid}.role).
 * Akun email yang belum punya dokumen otomatis dibuat dengan role "user",
 * jadi akun yang mendaftar langsung muncul di database untuk di-acc.
 * Role dibaca ulang tiap request → perubahan di database langsung berlaku.
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
  const ref = getAdminDb().collection("users").doc(verified.uid);
  const snap = await ref.get();
  let role: UserRole = "user";
  if (!snap.exists) {
    if (verified.email) {
      await ensureUserDoc(verified.uid, verified.email);
    }
  } else {
    role = normalizeUserRole(snap.data()?.role);
    if (verified.email && snap.data()?.email !== verified.email) {
      await ref.set({ email: verified.email }, { merge: true });
    }
  }
  return { uid: verified.uid, email: verified.email, role };
}

/** Untuk endpoint yang butuh uid + email + role. */
export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  return getAuthContext(req);
}

/** Semua signed-in user (termasuk user biasa & anonim). */
export async function requireUid(req: NextRequest): Promise<string> {
  return (await getAuthContext(req)).uid;
}

/** Role admin atau owner di database (users/{uid}.role). */
export async function requireStaff(req: NextRequest): Promise<AuthContext> {
  const ctx = await getAuthContext(req);
  if (rank(ctx.role) < 1) {
    throw new ApiError(403, "Akses ditolak — butuh role admin/owner.", "not-staff");
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
  const userDoc = await getAdminDb().collection("users").doc(uid).get();
  if (userDoc.exists && userDoc.data()?.isBlocked === true) {
    throw new ApiError(
      403,
      "Akunmu diblokir karena melanggar aturan komunitas.",
      "blocked"
    );
  }
}

/**
 * Membuat dokumen users/{uid} dengan role default "user" bila belum ada.
 * Bila sudah ada, role TIDAK disentuh (hanya melengkapi email kalau kosong).
 */
export async function ensureUserDoc(
  uid: string,
  email?: string | null
): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    if (email && !snap.data()?.email) {
      await ref.set({ email }, { merge: true });
    }
    return normalizeUserRole(snap.data()?.role);
  }
  await ref.set({
    uid,
    ...(email ? { email } : {}),
    role: "user",
    createdAt: Date.now(),
    isBlocked: false,
  });
  return "user";
}
