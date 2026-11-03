"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "",
};

let app: FirebaseApp | null = null;
let authRef: Auth | null = null;
let rtdbRef: Database | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

/** Realtime Database — satu-satunya database aplikasi. */
export function getRtdb(): Database {
  if (!rtdbRef) rtdbRef = getDatabase(getFirebaseApp());
  return rtdbRef;
}

export function getAuthClient(): Auth {
  if (!authRef) authRef = getAuth(getFirebaseApp());
  return authRef;
}

export const isFirebaseConfigured =
  Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
  Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
  Boolean(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL);
