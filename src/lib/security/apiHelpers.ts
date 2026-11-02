import type { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { effectiveRole, normalizeUserRole, rank } from "@/lib/auth/roles";
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
): Promise<{ uid: string; claim: unknown } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.length > 4096) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    return { uid: decoded.uid, claim: decoded.role };
  } catch {
    return null;
  }
}

interface AuthContext {
  uid: string;
  claim: unknown;
  dbRole: string;
  role: UserRole;
}

/** Signed-in + mirror ke users/{uid}: role dipilih rank terendah claim vs DB. */
async function getAuthContext(req: NextRequest): Promise<AuthContext> {
  const verified = await verifyRequestToken(req);
  if (!verified) {
    throw new ApiError(
      401,
      verified === null
        ? "Kamu belum terautentikasi."
        : "Sesi tidak valid, coba muat ulang halaman.",
      "unauthenticated"
    );
  }
  const userDoc = await getAdminDb().collection("users").doc(verified.uid).get();
  const dbRole = userDoc.data()?.role;
  const role = effectiveRole(verified.claim, dbRole);
  return { uid: verified.uid, claim: verified.claim, dbRole, role };
}

/** Semua signed-in user (termasuk user biasa & anonim). */
export async function requireUid(req: NextRequest): Promise<string> {
  return (await getAuthContext(req)).uid;
}

/** Login email dengan role admin atau owner di claim ATAU database — effective min rank. */
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

/** Membuat dokumen users/{uid} dengan role default "user" bila belum ada. */
export async function ensureUserDoc(uid: string): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    return normalizeUserRole(snap.data()?.role);
  }
  await ref.set({
    uid,
    role: "user",
    createdAt: Date.now(),
    isBlocked: false,
  });
  return "user";
}
