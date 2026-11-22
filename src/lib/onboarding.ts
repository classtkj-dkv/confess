/** Penanda "tutorial sudah dilihat/dilewati" — hanya di perangkat ini. */
const KEY = "confess:onboarded:v1";
export const OPEN_ONBOARDING_EVENT = "confess:open-onboarding";

let seenInMemory = false;

export function hasSeenOnboarding(): boolean {
  if (seenInMemory) return true;
  try {
    if (localStorage.getItem(KEY)) return true;
  } catch {
    /* storage diblokir */
  }
  try {
    if (sessionStorage.getItem(KEY)) return true;
  } catch {
    /* abaikan */
  }
  return false;
}

export function markOnboardingSeen(): void {
  seenInMemory = true;
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* hanya berlaku selama halaman terbuka */
    }
  }
}

/** Membuka tutorial dari mana saja (tombol "Lihat tutorial"). */
export function openOnboarding(): void {
  window.dispatchEvent(new Event(OPEN_ONBOARDING_EVENT));
}
