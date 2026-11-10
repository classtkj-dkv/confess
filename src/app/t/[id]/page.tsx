import type { Metadata } from "next";
import { SharedTemplateClient } from "@/components/studio/SharedTemplateClient";
import { getAdminRtdb } from "@/lib/firebase/admin";
import { TEMPLATE_ID_RE } from "@/lib/security/templateShare";

export const dynamic = "force-dynamic";

/** Nama pembuat ("by") saja — publik. Isi template tetap terkunci kode. */
async function getTemplateBy(rawId: string): Promise<string> {
  const id = rawId.toLowerCase();
  if (!TEMPLATE_ID_RE.test(id)) return "";
  try {
    const snap = await getAdminRtdb().ref(`sharedTemplates/${id}/by`).get();
    const v = snap.val();
    return typeof v === "string" ? v.slice(0, 30) : "";
  } catch {
    return "";
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const by = await getTemplateBy(id);
  const title = by ? `Template kartu by ${by}` : "Template kartu";
  const description = by
    ? `${by} membagikan template kartu CONFESS. Buka dengan kode dari pengirim.`
    : "Buka template kartu CONFESS dengan kode dari pengirim.";
  return {
    title,
    description,
    openGraph: { title, description },
    robots: { index: false },
  };
}

export default async function SharedTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const by = await getTemplateBy(id);
  return <SharedTemplateClient id={id} by={by} />;
}
