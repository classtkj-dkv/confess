"use client";

import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { getAuthClient, isFirebaseConfigured } from "@/lib/firebase/client";
import { api } from "@/lib/api";

export class EmailAuthError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "Email sudah terdaftar. Gunakan Masuk.";
    case "auth/invalid-email":
      return "Format email tidak valid.";
    case "auth/weak-password":
      return "Password terlalu lemah — minimal 6 karakter.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email atau password salah.";
    case "auth/too-many-requests":
      return "Terlalu percobaan gagal — coba lagi beberapa menit.";
    case "auth/network-request-failed":
      return "Koneksi bermasalah, cek internetmu.";
    case "auth/operation-not-allowed":
    case "auth/admin-restricted-operation":
      return "Daftar email/password belum diaktifkan. Firebase Console → Authentication → Sign-in method → aktifkan Email/Password (dan Anonymous).";
    case "auth/credential-already-in-use":
      return "Email ini sudah dipakai akun lain. Gunakan Masuk.";
    case "auth/unauthorized-domain":
      return "Domain situs belum diizinkan. Firebase Console → Authentication → Settings → Authorized domains → tambahkan domain Vercel-mu.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "API key Firebase tidak valid. Cek NEXT_PUBLIC_FIREBASE_* di Vercel.";
    default:
      return `Operasi akun gagal${code ? ` (${code})` : ""}. Coba lagi.`;
  }
}

/**
 * Daftar manual (email + password).
 * Setiap pendaftaran baru selalu ber-role "user" biasa dan langsung dicatat
 * di database (users/{uid}). Naik role = edit field `role` di database.
 * Bila pengunjung sudah punya sesi anonim, kredensial email di-LINK ke
 * akun anonim itu sehingga confession mereka sebelumnya tetap miliknya.
 */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<string> {
  if (!isFirebaseConfigured) {
    throw new EmailAuthError("Firebase belum dikonfigurasi.");
  }
  const auth = getAuthClient();
  const emailClean = email.trim().toLowerCase();
  const cred = EmailAuthProvider.credential(emailClean, password);

  let uid: string;
  try {
    if (auth.currentUser?.isAnonymous) {
      const linked = await linkWithCredential(auth.currentUser, cred);
      uid = linked.user.uid;
    } else {
      const created = await createUserWithEmailAndPassword(
        auth,
        emailClean,
        password
      );
      uid = created.user.uid;
    }
  } catch (err) {
    if ((err as { code?: string })?.code === "auth/email-already-in-use") {
      throw new EmailAuthError("Email sudah terdaftar. Gunakan Masuk.");
    }
    throw new EmailAuthError(friendlyAuthError(err));
  }

  if (displayName?.trim()) {
    try {
      await updateProfile(auth.currentUser!, {
        displayName: displayName.trim().slice(0, 40),
      });
    } catch {
      /* sabar — nama sifatnya kosmetik */
    }
  }

  // Buat / pastikan dokumen users/{uid} dengan role "user".
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await api("/api/auth/profile", {
        body: { displayName: displayName?.trim() },
      });
      break;
    } catch {
      /* dicoba ulang sekali; bila tetap gagal, AuthProvider membuatnya saat login. */
    }
  }

  return uid;
}

/** Masuk dengan akun email yang pernah didaftarkan. */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<string> {
  if (!isFirebaseConfigured) {
    throw new EmailAuthError("Firebase belum dikonfigurasi.");
  }
  try {
    const res = await signInWithEmailAndPassword(
      getAuthClient(),
      email.trim().toLowerCase(),
      password
    );
    return res.user.uid;
  } catch (err) {
    throw new EmailAuthError(friendlyAuthError(err));
  }
}
