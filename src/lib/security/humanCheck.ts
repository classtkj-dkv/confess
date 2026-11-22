import { ApiError } from "@/lib/security/apiHelpers";

/**
 * Verifikasi manusia (Cloudflare Turnstile, gratis, tanpa teka-teki gambar).
 * OPSIONAL: aktif hanya bila TURNSTILE_SECRET_KEY diisi di environment server.
 * Tanpa key, pemeriksaan dilewati sehingga situs tetap berjalan normal.
 * Token dari browser hanya berlaku sekali dan ±5 menit; Cloudflare yang menilai.
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TOKEN_MAX = 2048;

export type HumanAction = "confession" | "comment";

export function isHumanCheckEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

interface SiteVerify {
  success?: boolean;
  action?: string;
  "error-codes"?: string[];
}

/**
 * Lempar ApiError bila token tidak ada / tidak valid. `raw` = body JSON
 * permintaan (field `captchaToken`). `ip` opsional untuk memperketat penilaian.
 */
export async function assertHuman(
  raw: unknown,
  action: HumanAction,
  ip?: string
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return; // fitur belum diaktifkan

  const token = String((raw as Record<string, unknown> | null)?.captchaToken ?? "");
  if (!token || token.length > TOKEN_MAX) {
    throw new ApiError(400, "Selesaikan verifikasi manusia dulu ya.", "captcha-required");
  }

  let data: SiteVerify;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    data = (await res.json()) as SiteVerify;
  } catch {
    // Gagal menghubungi Cloudflare: tolak (fail-closed) agar bot tidak lolos.
    throw new ApiError(
      503,
      "Layanan verifikasi sedang bermasalah. Coba lagi sebentar.",
      "captcha-unavailable"
    );
  }

  // Token harus untuk aksi yang sama (mencegah pemakaian lintas form).
  const actionOk = typeof data.action !== "string" || data.action === "" || data.action === action;
  if (!data.success || !actionOk) {
    throw new ApiError(
      403,
      "Verifikasi manusia gagal atau kedaluwarsa. Coba lagi.",
      "captcha-failed"
    );
  }
}
