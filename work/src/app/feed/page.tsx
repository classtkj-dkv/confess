import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedClient } from "@/components/feed/FeedClient";
import { FeedSkeleton } from "@/components/ui/Skeletons";

export const metadata: Metadata = {
  title: "Feed",
  description: "Semua confession yang sudah disetujui moderasi.",
};

export default function FeedPage() {
  return (
    <Suspense fallback={<FeedSkeleton count={4} />}>
      <FeedClient />
    </Suspense>
  );
}
