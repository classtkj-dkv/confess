"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { NAV_ITEMS } from "./navItems";
import { NavIcon } from "./NavIcon";

export function SearchBar({ onFocusSearch }: { onFocusSearch?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function submit(value: string) {
    const trimmed = value.trim().slice(0, 100);
    if (trimmed.length === 0) return;
    router.push(`/feed?search=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit(q);
      }}
      className="relative w-full"
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari confession…"
        aria-label="Cari confession"
        maxLength={100}
        onFocus={onFocusSearch}
        className="input pl-10 !rounded-full !bg-surface/80 !py-2"
      />
      <svg
        viewBox="0 0 24 24"
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    </form>
  );
}
