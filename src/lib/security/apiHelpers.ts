import type { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import type { AppUser } from "@/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
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

export async function requireUid(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Kamu belum terautentikasi.", "unauthenticated");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.length > 4096) {
    throw new ApiError(401, "Token tidak valid.", "invalid-token");
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    return decoded.uid;
  } catch {
    throw new ApiError(401, "Sesi tidak valid, coba muat ulang halaman.", "invalid-token");
  }
}

export interface AdminContext {
  uid: string;
  isAdmin: boolean;
}

export async function requireAdmin(req: NextRequest): Promise<AdminContext> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Kamu belum terautentikasi.", "unauthenticated");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  let decodedId = "";
  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    decodedId = decoded.uid;
    // Custom claim `admin` is only ever set server-side via the Admin SDK
    // (see /api/admin/setup) — it can never be forged from the browser.
    if (decoded.admin !== true) {
      throw new ApiError(403, "Akses ditolak.", "not-admin");
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, "Sesi tidak valid, coba muat ulang halaman.", "invalid-token");
  }
  if (decodedId === "") {
    throw new ApiError(401, "Sesi tidak valid.", "invalid-token");
  }
  // Belt & suspenders: mirror the claim against users/{uid}.role.
  const userDoc = await getAdminDb().collection("users").doc(decodedId).get();
  const role = userDoc.data()?.role;
  if (role !== "admin") {
    throw new ApiError(403, "Akses ditolak.", "not-admin");
  }
  return { uid: decodedId, isAdmin: true };
}

export async function assertNotBlocked(uid: string): Promise<void> {
  const db = getAdminDb();
  const userDoc = await db.collection("users").doc(uid).get();
  if (userDoc.exists && userDoc.data()?.isBlocked === true) {
    throw new ApiError(
      403,
      "Akunmu diblokir karena melanggar aturan komunitas.",
      "blocked"
    );
  }
}

export async function ensureUserDoc(uid: string): Promise<AppUser | null> {
  const db = getAdminDb();
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (snap.exists) return snap.data() as AppUser | null;
  const user: AppUser = {
    uid,
    role: "user",
    createdAt: Date.now(),
    isBlocked: false,
  };
  await ref.set(user);
  return user;
}
