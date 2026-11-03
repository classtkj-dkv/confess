import type { Metadata } from "next";
import { AdminClient } from "@/components/admin/AdminClient";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Panel moderasi CONFESS — hanya untuk admin.",
};

export default function AdminPage() {
  return <AdminClient />;
}
