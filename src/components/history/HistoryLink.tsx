import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export function HistoryLink() {
  return (
    <Link
      href="/riwayat"
      aria-label="Riwayat confess saya"
      title="Riwayat confess saya"
      className="icon-btn"
    >
      <Icon name="clock" className="h-4 w-4" />
    </Link>
  );
}
