import type { UserRole } from "@/types";

/**
 * Role ladder — owner (paling tinggi) > admin > user.
 * Dipakai bersama oleh server (API routes) dan klien.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  admin: 1,
  owner: 2,
};

export function rank(role: UserRole): number {
  return ROLE_RANK[role] ?? 0;
}

export function normalizeUserRole(value: unknown): UserRole {
  if (value === "owner" || value === "admin" || value === "user") return value;
  return "user";
}

/**
 * Effective role = rank TERENDAH antara custom claim (login) dan dokumen
 * users/{uid}.role (database).
 *
 * Konsekuensi keamanan:
 * - Mengedit users/{uid}.role langsung di database TIDAK BISA menaikkan hak
 *   di atas claim login (claim hanya bisa di-set server via Admin SDK).
 * - Kenaikan role hanya lewat /api/admin/roles (owner-only) yang meng-update
 *   claim DAN dokumen secara atomik.
 * - Urutan tetap: owner paling tinggi, admin di bawahnya, user paling bawah.
 */
export function effectiveRole(
  claim: unknown,
  dbRole: unknown
): UserRole {
  const claimRole = normalizeUserRole(
    typeof claim === "string" ? claim : claim === true ? "admin" : "user"
  );
  const db = normalizeUserRole(dbRole);
  return ROLE_RANK[claimRole] <= ROLE_RANK[db] ? claimRole : db;
}

export function isStaff(role: UserRole): boolean {
  return rank(role) >= ROLE_RANK.admin;
}

export function isOwner(role: UserRole): boolean {
  return role === "owner";
}
