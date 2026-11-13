import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getDatabase, type Database } from "firebase-admin/database";

let cachedApp: App | null = null;

function getServiceAccount(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) return null;

  // Dukung key multiline asli, key dengan escape \n literal (gaya Vercel),
  // dan key yang terbungkus tanda kutip.
  const privateKey = rawKey
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  if (!privateKey.includes("BEGIN") || !privateKey.includes("PRIVATE KEY")) {
    throw new Error(
      "FIREBASE_ADMIN_PRIVATE_KEY tidak valid. Salin seluruh nilai private_key dari file JSON service account."
    );
  }

  return { projectId, clientEmail, privateKey };
}

export function getAdminApp(): App {
  if (cachedApp) return cachedApp;

  if (getApps().length > 0) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    throw new Error(
      "Firebase Admin SDK belum dikonfigurasi. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, dan FIREBASE_ADMIN_PRIVATE_KEY di environment variables."
    );
  }
  if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_DATABASE_URL belum diisi (URL Realtime Database dari Firebase Console)."
    );
  }

  cachedApp = initializeApp({
    credential: cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    }),
    projectId: serviceAccount.projectId,
    // URL yang sama dengan Web SDK.
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });

  return cachedApp;
}

/** Realtime Database — satu-satunya database aplikasi. */
export function getAdminRtdb(): Database {
  return getDatabase(getAdminApp());
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
