import type { Metadata } from "next";
import { ConfessionDetailClient } from "@/components/feed/ConfessionDetailClient";

export const metadata: Metadata = {
  title: "Detail Confession",
  robots: { index: false, follow: false },
};

export default function ConfessionDetailPage() {
  return <ConfessionDetailClient />;
}
