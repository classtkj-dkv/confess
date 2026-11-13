import type { Metadata } from "next";
import { HistoryClient } from "@/components/history/HistoryClient";

export const metadata: Metadata = {
  title: "Riwayat confess",
  description: "Confess yang pernah kamu kirim dari perangkat ini.",
  robots: { index: false, follow: false },
};

export default function HistoryPage() {
  return <HistoryClient />;
}
