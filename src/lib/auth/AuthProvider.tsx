"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
} from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { getAuthClient, getRtdb, isFirebaseConfigured } from "@/lib/firebase/client";
import { api } from "@/lib/api";
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

  const profileSynced = useRef<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setState({ ...INITIAL, loading: false, configured: false });
      return;
    }
    const auth = getAuthClient();
    let unsubRole: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Lepas listener role akun sebelumnya (ganti akun / logout).
      unsubRole?.();
      unsubRole = null;

      if (!user) {
        profileSynced.current = null;
        setState({ ...INITIAL, loading: false });
        return;
      }

      let currentRole: UserRole = "user";
      let cancelled = false;

      const apply = (role: UserRole) => {
        if (cancelled) return;
        currentRole = role;
        setState({
          uid: user.uid,
          isAnonymous: user.isAnonymous,
          role,
          isAdmin: role === "moderator" || role === "admin" || role === "owner",
          isOwner: role === "owner",
          loading: false,
          configured: true,
        });
      };

      // Otorisasi = Custom Claim `role` di ID token (diset server).
      const readClaim = async (force: boolean) => {
        try {
          const res = await user.getIdTokenResult(force);
          apply(normalizeUserRole(res.claims.role));
        } catch {
          // Token dicabut (role diturunkan) / offline → perlakukan sebagai user.
          apply("user");
        }
      };

      void readClaim(false);

      // Perubahan role di database (oleh owner) → refresh token agar claim baru
      // terbaca, UI ikut berubah seketika tanpa reload.
      unsubRole = onValue(
        ref(getRtdb(), `users/${user.uid}/role`),
        (snap) => {
          const dbRole = normalizeUserRole(snap.val());
          if (dbRole !== currentRole) void readClaim(true);
          // Akun email yang belum tercatat → buat profil (role "user").
          if (
            !snap.exists() &&
            !user.isAnonymous &&
            profileSynced.current !== user.uid
          ) {
            profileSynced.current = user.uid;
            api("/api/auth/profile", { body: {} }).catch(() => {
              profileSynced.current = null;
            });
          }
        },
        () => undefined
      );

      const prevUnsub = unsubRole;
      unsubRole = () => {
        cancelled = true;
        prevUnsub?.();
      };
    });

    return () => {
      unsubRole?.();
      unsubAuth();
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
