import { getAuthClient, isFirebaseConfigured } from "@/lib/firebase/client";

export interface AuthSession {
  uid: string;
  token: string;
}

/**
 * Ensures an anonymous session exists and returns a fresh ID token.
 * Used by non-React call sites (API client, hooks).
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  if (!isFirebaseConfigured) return null;
  const auth = getAuthClient();
  let user = auth.currentUser;
  if (!user) {
    try {
      const { signInAnonymously } = await import("firebase/auth");
      user = (await signInAnonymously(auth)).user;
    } catch {
      return null;
    }
  }
  try {
    const token = await user.getIdToken(true);
    return { uid: user.uid, token };
  } catch {
    return null;
  }
}
