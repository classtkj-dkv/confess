import type { User } from "firebase/auth";
import { getAuthClient, isFirebaseConfigured } from "@/lib/firebase/client";

export interface AuthSession {
  uid: string;
  token: string;
}

let lastAuthErrorCode: string | null = null;
let signingIn: Promise<User | null> | null = null;

/** Kode error terakhir dari Firebase Auth (untuk pesan yang jelas di UI). */
export function getLastAuthErrorCode(): string | null {
  return lastAuthErrorCode;
}

/** Pesan ramah + langkah perbaikan berdasarkan kode error Firebase Auth. */
export function describeAuthError(code: string | null): string {
  switch (code) {
    case "auth/admin-restricted-operation":
    case "auth/operation-not-allowed":
      return "Login anonim belum diaktifkan. Firebase Console → Authentication → Sign-in method → aktifkan Anonymous.";
    case "auth/unauthorized-domain":
      return "Domain situs belum diizinkan. Firebase Console → Authentication → Settings → Authorized domains → tambahkan domain ini.";
    case "auth/network-request-failed":
      return "Koneksi bermasalah. Periksa internetmu lalu coba lagi.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "API key Firebase tidak valid. Cek NEXT_PUBLIC_FIREBASE_API_KEY di Vercel (lalu redeploy).";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan dari perangkat ini. Coba lagi beberapa menit.";
    default:
      return `Gagal memvalidasi sesi anonim${code ? ` (${code})` : ""}. Muat ulang halaman lalu coba lagi.`;
  }
}

async function signInAnon(): Promise<User | null> {
  if (!signingIn) {
    signingIn = (async () => {
      try {
        const auth = getAuthClient();
        const { signInAnonymously } = await import("firebase/auth");
        const cred = await signInAnonymously(auth);
        lastAuthErrorCode = null;
        return cred.user;
      } catch (err) {
        lastAuthErrorCode = (err as { code?: string })?.code ?? "unknown";
        // eslint-disable-next-line no-console
        console.error("Anonymous sign-in failed:", err);
        return null;
      } finally {
        signingIn = null;
      }
    })();
  }
  return signingIn;
}

/**
 * Ensures a session exists and returns a fresh ID token. Menunggu Firebase
 * selesai memulihkan sesi tersimpan (mencegah login anonim ganda yang menimpa
 * sesi email), lalu login anonim hanya bila memang belum ada sesi.
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  if (!isFirebaseConfigured) return null;
  const auth = getAuthClient();
  try {
    await auth.authStateReady();
  } catch {
    /* lanjut — currentUser dicek di bawah */
  }
  let user = auth.currentUser;
  if (!user) user = await signInAnon();
  if (!user) return null;
  try {
    const token = await user.getIdToken(false);
    return { uid: user.uid, token };
  } catch (err) {
    lastAuthErrorCode = (err as { code?: string })?.code ?? "unknown";
    return null;
  }
}
