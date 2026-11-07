import type { Metadata } from "next";
import { ConfessionForm } from "@/components/forms/ConfessionForm";

export const metadata: Metadata = {
  title: "Tulis Confess",
  description: "Tulis confession anonim untuk lingkungan sekolah.",
};

export default async function ConfessPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const sp = await searchParams;
  const category = typeof sp?.category === "string" ? sp.category : undefined;

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-xl font-bold text-ink">Tulis Confess</h1>
        <p className="text-sm text-muted">Anonim, tanpa nama.</p>
      </header>
      <ConfessionForm defaultCategory={category} />
    </div>
  );
}
