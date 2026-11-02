import type { CategoryId, ReportReason } from "@/types";

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  emoji: string;
  description: string;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  {
    id: "love",
    label: "Love",
    emoji: "❤️",
    description: "Deklarasi, suka-suka, dan cerita hati.",
  },
  {
    id: "curhat",
    label: "Curhat",
    emoji: "💬",
    description: "Cerita dan beban yang ingin kamu luapkan.",
  },
  {
    id: "school",
    label: "School",
    emoji: "🏫",
    description: "Hal-hal seputar sekolah, tugas, dan guru.",
  },
  {
    id: "friendship",
    label: "Friendship",
    emoji: "🤝",
    description: "Sahabat, mantan teman, dan dinamika pertemanan.",
  },
  {
    id: "life",
    label: "Life",
    emoji: "🌙",
    description: "Kehidupan, mimpi, dan refleksi diri.",
  },
  {
    id: "random",
    label: "Random",
    emoji: "🎲",
    description: "Apapun yang tidak termasuk kategori lain.",
  },
] as const;

export const CATEGORY_IDS: readonly CategoryId[] = CATEGORIES.map((c) => c.id);

export function getCategory(id: string | null | undefined): CategoryMeta {
  return (
    CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
  );
}

export function isCategoryId(v: unknown): v is CategoryId {
  return typeof v === "string" && (CATEGORY_IDS as readonly string[]).includes(v);
}

export const REPORT_REASONS: readonly { id: ReportReason; label: string }[] = [
  { id: "bullying", label: "Perundungan (bullying)" },
  { id: "harassment", label: "Pelecehan" },
  { id: "slander", label: "Fitnah / hoaks" },
  { id: "threat", label: "Ancaman atau kekerasan" },
  { id: "privacy", label: "Menyebar informasi pribadi" },
  { id: "inappropriate", label: "Konten tidak pantas" },
] as const;

export function isReportReason(v: unknown): v is ReportReason {
  return (
    typeof v === "string" &&
    REPORT_REASONS.some((r) => r.id === v)
  );
}
