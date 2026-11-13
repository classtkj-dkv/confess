import type { AppNotification, NotificationType } from "@/types";

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "comment",
  "reply",
  "approved",
  "rejected",
] as const;

/** Teks utama notifikasi (tanpa HTML; aman dirender langsung). */
export function notificationTitle(n: AppNotification): string {
  const who = n.fromName?.trim() || "Seseorang";
  switch (n.type) {
    case "comment":
      return `${who} mengomentari confess kamu`;
    case "reply":
      return `${who} membalas komentarmu`;
    case "approved":
      return "Confess kamu sudah tayang di feed";
    case "rejected":
      return "Confess kamu tidak disetujui moderator";
  }
}
