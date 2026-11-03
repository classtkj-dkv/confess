"use client";

import { useEffect, useSyncExternalStore } from "react";
import { onValue, ref } from "firebase/database";
import { getRtdb, isFirebaseConfigured } from "@/lib/firebase/client";
import { DEFAULT_SETTINGS, parseSettings } from "@/lib/settingsShared";
import type { AppSettings } from "@/types";

/**
 * Satu listener bersama untuk settings/general (maintenance, pengumuman,
 * allowComments, …). Berapa pun komponen yang memakainya, hanya ada SATU
 * onValue aktif; dilepas otomatis saat tidak ada pemakai.
 */
interface Snapshot {
  settings: AppSettings;
  loaded: boolean;
}

let current: Snapshot = { settings: DEFAULT_SETTINGS, loaded: false };
const listeners = new Set<() => void>();
let unsubscribeDb: (() => void) | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function start() {
  if (unsubscribeDb || !isFirebaseConfigured) return;
  unsubscribeDb = onValue(
    ref(getRtdb(), "settings/general"),
    (snap) => {
      current = { settings: parseSettings(snap.val()), loaded: true };
      emit();
    },
    () => {
      current = { settings: DEFAULT_SETTINGS, loaded: true };
      emit();
    }
  );
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  start();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && unsubscribeDb) {
      unsubscribeDb();
      unsubscribeDb = null;
    }
  };
}

const SERVER_SNAPSHOT: Snapshot = { settings: DEFAULT_SETTINGS, loaded: false };

export function useSettings(): Snapshot {
  useEffect(() => {
    /* subscribe dikelola useSyncExternalStore */
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => SERVER_SNAPSHOT
  );
}
