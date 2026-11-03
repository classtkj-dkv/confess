import type { NextRequest } from "next/server";
import {
  ApiError,
  errorResponse,
  requireOwner,
} from "@/lib/security/apiHelpers";
import { getAdminAuth, getAdminRtdb } from "@/lib/firebase/admin";
import { normalizeUserRole, rank } from "@/lib/auth/roles";
import { touchAdmin, writeAudit } from "@/lib/security/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = new Set(["user", "moderator", "admin", "owner"]);

/**
 * Ubah role akun — HANYA owner (diverifikasi server dari claim + database).
 *  1. Verifikasi identitas OWNER.
 *  2. Set Custom Claim `role` lewat Admin SDK.
 *  3. Turun role / dicabut → revokeRefreshTokens (token lama langsung ditolak).
 *  4. Perbarui profil users/{uid}/role di Realtime Database.
 *  5. Catat ke audit_logs.
 * Dashboard & klien target ikut berubah realtime lewat listener RTDB.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const actor = await requireOwner(req);

    let body: { uid?: unknown; role?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      throw new ApiError(400, "Body tidak valid.");
    }
    const uid = typeof body.uid === "string" ? body.uid : "";
    const roleRaw = typeof body.role === "string" ? body.role.toLowerCase() : "";
    if (!/^[a-zA-Z0-9_-]{17,128}$/.test(uid)) {
      throw new ApiError(400, "UID tidak valid.");
    }
    if (!VALID.has(roleRaw)) {
      throw new ApiError(400, "Role tidak valid.");
    }
    const newRole = normalizeUserRole(roleRaw);
    if (uid === actor.uid) {
      throw new ApiError(400, "Owner tidak bisa mengubah role dirinya sendiri.");
    }

    const auth = getAdminAuth();
    let targetUser;
    try {
      targetUser = await auth.getUser(uid);
    } catch {
      throw new ApiError(404, "Akun tidak ditemukan.");
    }
    if (targetUser.providerData.length === 0) {
      throw new ApiError(400, "Akun anonim tidak bisa diberi role staff.");
    }

    const userRef = getAdminRtdb().ref(`users/${uid}`);
    const snap = await userRef.get();
    const oldRole = normalizeUserRole(snap.val()?.role);

    // Turun role: cabut akses database dulu (rules mensyaratkan role DB = claim).
    const demoting = rank(newRole) < rank(oldRole);
    if (demoting) {
      await userRef.update({ role: newRole, updatedAt: Date.now() });
    }
    await auth.setCustomUserClaims(uid, {
      ...(targetUser.customClaims ?? {}),
      role: newRole,
    });
    if (demoting) {
      await auth.revokeRefreshTokens(uid);
    } else {
      await userRef.update({
        uid,
        email: targetUser.email ?? snap.val()?.email ?? "",
        role: newRole,
        updatedAt: Date.now(),
      });
    }

    await writeAudit(actor.uid, "setRole", uid, { from: oldRole, to: newRole });
    await touchAdmin();

    return Response.json({ ok: true, uid, role: newRole });
  } catch (err) {
    return errorResponse(err);
  }
}
