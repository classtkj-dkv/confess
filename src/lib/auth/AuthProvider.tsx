"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
} from "firebase/auth";
import { getAuthClient, isFirebaseConfigured } from "@/lib/firebase/client";
import type { AdminRole } from "@/types";

export interface AuthState {
  uid: string | null;
  isAnonymous: boolean;
  role: AdminRole;
  isAdmin: boolean;
  loading: boolean;
  configured: boolean;
}

interface AuthContextValue extends AuthState {
  /** Signs the visitor in as an anonymous account. */
  ensureSignedIn: () => Promise<string | null>;
  refreshAuthToken: () => Promise<string | null>;
  signOutNow: () => Promise<void>;
  configured: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL: AuthState = {
  uid: null,
  isAnonymous: true,
  role: "user",
  isAdmin: false,
  loading: true,
  configured: isFirebaseConfigured,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL);
  const configured = isFirebaseConfigured;

  useEffect(() => {
    if (!configured) {
      setState({ ...INITIAL, loading: false });
      return;
    }
    let cancelled = false;
    const auth = getAuthClient();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;
      if (!user) {
        setState({ ...INITIAL, loading: false, configured });
        return;
      }
      let role: AdminRole = "user";
      try {
        const token = await user.getIdTokenResult();
        role = token.claims.admin === true ? "admin" : "user";
      } catch {
        role = "user";
      }
      setState({
        uid: user.uid,
        isAnonymous: user.isAnonymous,
        role,
        isAdmin: role === "admin",
        loading: false,
        configured,
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [configured]);

  const ensureSignedIn = useCallback(async (): Promise<string | null> => {
    const auth = getAuthClient();
    const current = auth.currentUser;
    if (current) return current.uid;
    try {
      const cred = await signInAnonymously(auth);
      return cred.user.uid;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Anonymous sign-in failed", err);
      return null;
    }
  }, []);

  const refreshAuthToken = useCallback(async (): Promise<string | null> => {
    const auth = getAuthClient();
    const current = auth.currentUser;
    if (!current) return null;
    try {
      return await current.getIdToken(true);
    } catch {
      return null;
    }
  }, []);

  const signOutNow = useCallback(async () => {
    try {
      // Signing out an anonymous session destroys the shadow account; that is
      // intended: a fresh anonymous identity is created on next interaction.
      await signOut(getAuthClient());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Sign out failed", err);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      ensureSignedIn,
      refreshAuthToken,
      signOutNow,
      configured,
    }),
    [state, ensureSignedIn, refreshAuthToken, signOutNow, configured]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
