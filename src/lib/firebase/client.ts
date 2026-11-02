"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

let app: FirebaseApp | null = null;
let dbRef: Firestore | null = null;
let authRef: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

export function getDb(): Firestore {
  if (!dbRef) dbRef = getFirestore(getFirebaseApp());
  return dbRef;
}

export function getAuthClient(): Auth {
  if (!authRef) authRef = getAuth(getFirebaseApp());
  return authRef;
}

export const isFirebaseConfigured =
  Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
  Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
