import type { ReactElement } from "react";

const PATHS: Record<string, ReactElement> = {
  home: (
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1v-8.5Z" />
  ),
  feed: (
    <path d="M4 5h16v2.5H4V5Zm0 5.5h16V13H4v-2.5Zm0 5.5h10v2.5H4V16Zm13 0h3v2.5h-3V16Z" />
  ),
  trending: (
    <path d="m3 17 6-6 4 4 7-7-1.4-1.4L13 12.2 9 8.2l-7.4 7.4L3 17Z" />
  ),
  categories: (
    <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 1.5 2.75-2.75 5.5 5.5L18.5 20l-5.5-5.5Z" />
  ),
  about: (
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" />
  ),
  admin: (
    <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
  ),
};

export function NavIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      {path}
    </svg>
  );
}
