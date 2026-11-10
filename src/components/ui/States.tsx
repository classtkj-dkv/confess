import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface text-muted">
        <Icon name={icon} className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted">{description}</p>
      )}
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Terjadi kesalahan",
  description = "Coba muat ulang halaman atau kembali lagi nanti.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="card flex flex-col items-center gap-3 px-6 py-12 text-center"
    >
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger">
        <Icon name="xcircle" className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {action ?? (
        <button
          onClick={() => window.location.reload()}
          className="btn-ghost"
          type="button"
        >
          Muat ulang
        </button>
      )}
    </div>
  );
}
