import type { Metadata } from "next";
import { SharedTemplateClient } from "@/components/studio/SharedTemplateClient";

export const metadata: Metadata = {
  title: "Template kartu",
  description: "Buka template kartu CONFESS dengan kode dari pengirim.",
  robots: { index: false },
};

export default async function SharedTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SharedTemplateClient id={id} />;
}
