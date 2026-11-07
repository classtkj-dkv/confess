"use client";

import { getAuthSession } from "@/lib/auth/session";
import { isFirebaseConfigured } from "@/lib/firebase/client";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/**
 * Authenticated fetch helper. Signs the visitor in anonymously when needed —
 * a school environment should never require email signup for participation.
 */
export async function api(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown; auth?: boolean } = {}
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (opts.auth !== false) {
    if (!isFirebaseConfigured) {
      throw new ApiClientError(503, "Sesi Firebase belum dikonfigurasi di lingkungan ini.");
    }
    const session = await getAuthSession();
    if (!session) {
      throw new ApiClientError(503, "Gagal memvalidasi sesi anonim. Periksa koneksi lalu coba lagi.");
    }
    headers.Authorization = `Bearer ${session.token}`;
  }

  const res = await fetch(path, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  // Baca sebagai teks dulu: bila server crash (bukan JSON) tampilkan status + cuplikan.
  const text = await res.text().catch(() => "");
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    const fallback = text
      ? `Server error ${res.status}: ${text.replace(/\s+/g, " ").slice(0, 140)}`
      : `Server error ${res.status} (respons kosong).`;
    throw new ApiClientError(res.status, String(data?.error ?? fallback));
  }
  return data;
}
