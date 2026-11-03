import type { UserRole } from "@/types";

/**
 * Role ladder — owner > admin > moderator > user.
 *
 * OTORISASI = Firebase Custom Claim `role` (diset server lewat Admin SDK),
 * dan harus sama dengan profil `users/{uid}/role` di Realtime Database.
 * Mengubah role hanya lewat endpoint owner (/api/admin/roles) — mengedit
 * database manual TIDAK memberi akses, hanya bisa mencabutnya.
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
