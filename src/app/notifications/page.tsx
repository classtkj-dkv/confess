import type { Metadata } from "next";
import { NotificationsClient } from "@/components/notifications/NotificationsClient";

export const metadata: Metadata = {
  title: "Notifikasi",
  description: "Balasan dan komentar untuk confess dan komentarmu.",
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return <NotificationsClient />;
}
