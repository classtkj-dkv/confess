import type { NextRequest } from "next/server";
import { errorResponse, requireAdmin } from "@/lib/security/apiHelpers";
import { aiStatus, moderateDetailed } from "@/lib/ai/moderate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SAMPLES = [
  {
    label: "Pesan sopan (harusnya disetujui)",
    expected: "approve",
    message: "Kangen banget sama kelas kita, semangat ya buat ujian besok! Jangan lupa istirahat.",
  },
  {
    label: "Pesan menghina + data pribadi (harusnya minta revisi)",
    expected: "revise",
    message: "Si Budi anak 12A itu bodoh dan jelek banget, nomor HP-nya 081234567890 spam aja rame-rame.",
  },
] as const;

/** Tes koneksi OpenRouter dan kualitas keputusan AI. Hanya admin. */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const status = aiStatus();
    if (!status.configured) {
      return Response.json({ ...status, checks: [] });
    }
    const checks = await Promise.all(
      SAMPLES.map(async (s) => {
        const r = await moderateDetailed({
          message: s.message,
          fromName: "",
          toName: "",
          songLabel: "",
          lyric: "",
        });
        return {
          label: s.label,
          expected: s.expected,
          verdict: r.result?.verdict ?? null,
          model: r.result?.model ?? null,
          ok: r.result?.verdict === s.expected,
          ms: r.ms,
          error: r.error,
        };
      })
    );
    return Response.json({ ...status, checks });
  } catch (err) {
    return errorResponse(err);
  }
}
