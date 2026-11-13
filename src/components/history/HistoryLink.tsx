import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export function HistoryLink() {
  return (
    <Link
      href="/riwayat"
      aria-label="Riwayat confess saya"
      title="Riwayat confess saya"
      className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-hairline bg-surface/70 text-ink transition-colors hover:bg-ink/5"
    >
      <Icon name="clock" className="h-4 w-4" />
    </Link>
  );
}
