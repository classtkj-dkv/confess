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
    default:
      return "Operasi akun gagal. Coba lagi.";
  }
}

/**
 * Daftar manual (email + password).
 * Setiap pendaftaran baru selalu ber-role "user" biasa — role admin/owner
 * hanya bisa diberikan oleh owner lewat dashboard (server-side claim).
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
  try {
    await api("/api/auth/profile", { body: { displayName: displayName?.trim() } });
  } catch {
    /* dokumen user dibuat otomatis saat aksi pertama (posts/comments). */
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
