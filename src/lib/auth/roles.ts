import type { UserRole } from "@/types";

/**
 * Role ladder — owner > admin > moderator > user.
 *
 * OTORISASI = field `users/{uid}/role` di Realtime Database. Server membacanya
 * di setiap request, jadi perubahan role langsung berlaku. Klien tidak punya
 * hak tulis ke `users/*` (Security Rules) — role hanya diubah lewat Firebase
 * Console, panel owner (/api/admin/roles), atau bootstrap (/api/admin/setup).
 */
export const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
  owner: 3,
};

export const ROLE_LABEL: Record<UserRole, string> = {
  user: "User",
  moderator: "Moderator",
  admin: "Admin",
  owner: "Owner",
};

export function rank(role: UserRole): number {
  return ROLE_RANK[role] ?? 0;
}

/** Nilai tidak dikenal / kosong selalu jatuh ke "user" (paling aman). */
export function normalizeUserRole(value: unknown): UserRole {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "owner" || v === "admin" || v === "moderator" || v === "user") return v;
  return "user";
}

/** moderator ke atas: boleh membuka dashboard & moderasi. */
export function isStaff(role: UserRole): boolean {
  return rank(role) >= ROLE_RANK.moderator;
}

/** admin ke atas: pengaturan situs, blokir akun, audit log. */
export function isAdminRole(role: UserRole): boolean {
  return rank(role) >= ROLE_RANK.admin;
}

export function isOwner(role: UserRole): boolean {
  return role === "owner";
}
