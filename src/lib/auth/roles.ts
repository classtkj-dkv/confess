import type { UserRole } from "@/types";

/**
 * Role ladder — owner (paling tinggi) > admin > user.
 * Dipakai bersama oleh server (API routes) dan klien.
 *
 * SUMBER KEBENARAN: field `role` di Realtime Database `users/{uid}`.
 * Mengubah role = edit field itu langsung di Firebase Console
 * (Realtime Database → Data → users → pilih akun → role). Berlaku seketika.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  admin: 1,
  owner: 2,
};

export function rank(role: UserRole): number {
  return ROLE_RANK[role] ?? 0;
}

/** Nilai tidak dikenal / kosong selalu jatuh ke "user" (paling aman). */
export function normalizeUserRole(value: unknown): UserRole {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (v === "owner" || v === "admin" || v === "user") return v;
  return "user";
}

export function isStaff(role: UserRole): boolean {
  return rank(role) >= ROLE_RANK.admin;
}

export function isOwner(role: UserRole): boolean {
  return role === "owner";
}
