"use client";

import { useToast, type ToastKind } from "@/lib/auth/ToastProvider";
import { formatNumber as _f } from "@/utils/format";
import { Icon, type IconName } from "@/components/ui/Icon";

const STYLES: Record<ToastKind, { bg: string; icon: IconName; color: string }> = {
  info: { bg: "bg-primary/10 border-primary/30", icon: "info", color: "text-primary" },
  success: { bg: "bg-success/10 border-success/30", icon: "check", color: "text-success" },
  error: { bg: "bg-danger/10 border-danger/30", icon: "xcircle", color: "text-danger" },
  warning: { bg: "bg-warning/10 border-warning/30", icon: "alert", color: "text-warning" },
};

void _f;

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col items-center gap-2 md:bottom-6 md:left-auto md:right-6 md:items-end"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm shadow-lift glass-panel ${STYLES[t.kind].bg}`}
        >
          <span aria-hidden className={`mt-0.5 ${STYLES[t.kind].color}`}>
            <Icon name={STYLES[t.kind].icon} className="h-4 w-4" />
          </span>
          <span className="flex-1 text-ink">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
