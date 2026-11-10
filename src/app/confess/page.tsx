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
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="page-title">Tulis Confess</h1>
        <p className="page-lead">Anonim, tanpa nama.</p>
      </header>
      <ConfessionForm defaultCategory={category} />
    </div>
  );
}
