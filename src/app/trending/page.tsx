import type { Metadata } from "next";
import { TrendingClient } from "@/components/feed/TrendingClient";

export const metadata: Metadata = {
  title: "Trending",
  description: "Confession yang paling banyak berinteraksi.",
};

export default function TrendingPage() {
  return <TrendingClient />;
}
