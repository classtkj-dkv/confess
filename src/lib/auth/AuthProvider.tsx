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
import { normalizeUserRole } from "@/lib/auth/roles";
import type { UserRole } from "@/types";

export interface AuthState {
  uid: string | null;
  isAnonymous: boolean;
  role: UserRole;
  isAdmin: boolean;
  isOwner: boolean;
  loading: boolean;
  configured: boolean;
}

interface AuthContextValue extends AuthState {
  ensureSignedIn: () => Promise<string | null>;
  refreshAuthToken: () => Promise<string | null>;
  signOutNow: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL: AuthState = {
  uid: null,
  isAnonymous: true,
  role: "user",
  isAdmin: false,
  isOwner: false,
  loading: true,
  configured: isFirebaseConfigured,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setState({ ...INITIAL, loading: false, configured: false });
      return;
    }
    let cancelled = false;
    const auth = getAuthClient();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;
      if (!user) {
        setState({ ...INITIAL, loading: false });
        return;
      }
      let role: UserRole = "user";
      try {
        const token = await user.getIdTokenResult();
        // claim `role` (owner/admin/user) — fallback ke claim admin lama.
        role = normalizeUserRole(
          typeof token.claims.role === "string"
            ? token.claims.role
            : token.claims.admin === true
              ? "admin"
              : "user"
        );
      } catch {
        role = "user";
      }
      setState({
        uid: user.uid,
        isAnonymous: user.isAnonymous,
        role,
        isAdmin: role === "admin" || role === "owner",
        isOwner: role === "owner",
        loading: false,
        configured: true,
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

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
    }),
    [state, ensureSignedIn, refreshAuthToken, signOutNow]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
