import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CONFESS — School Edition",
    short_name: "CONFESS",
    description:
      "Platform confession anonim untuk lingkungan sekolah. Ceritakan apa yang ada di pikiranmu.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "id",
    background_color: "#090C16",
    theme_color: "#090C16",
    categories: ["social", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Tulis confess", short_name: "Tulis", url: "/confess" },
      { name: "Notifikasi", short_name: "Notifikasi", url: "/notifications" },
    ],
  };
}
