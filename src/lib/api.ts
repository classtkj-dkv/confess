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

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiClientError(res.status, String(data?.error ?? "Terjadi kesalahan."));
  }
  return data;
}
