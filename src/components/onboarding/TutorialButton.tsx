"use client";

import type { ReactNode } from "react";
import { openOnboarding } from "@/lib/onboarding";

export function TutorialButton({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={openOnboarding} className={className}>
      {children}
    </button>
  );
}
