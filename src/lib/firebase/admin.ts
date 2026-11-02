import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import {
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";
import {
  getAuth,
  type Auth,
} from "firebase-admin/auth";

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

  // Support both raw multiline keys and Vercel-style \n escaped keys.
  const privateKey = rawKey.startsWith("-----BEGIN")
    ? rawKey
    : rawKey.replace(/\\n/g, "\n");

  if (privateKey.includes("\\n")) {
    throw new Error(
      "FIREBASE_ADMIN_PRIVATE_KEY tidak valid. Gunakan literal newline atau escape \\n."
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

  cachedApp = initializeApp({
    credential: cert({
      projectId:
        serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey.replace(/\\n/g, "\n"),
    }),
    projectId: serviceAccount.projectId,
  });

  return cachedApp;
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
